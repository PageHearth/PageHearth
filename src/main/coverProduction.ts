import {promises as fs} from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import type {PublicationPlan} from '../shared/publication.js';
import {coverIdentity,readCovers,coverGeometry,panelPlacement,type CoverAssetInfo,type CoverResult} from '../shared/covers.js';
import {verifiedAsset,typstProcess,stagePrintFont} from './typstPrint.js';
import {ebookImage} from './ebookImages.js';
import {installedPrintFonts,embeddingAllowed} from './printFonts.js';
export const coverHash=(v:Uint8Array|string)=>createHash('sha256').update(v).digest('hex');
export async function inspectCover(bytes:Buffer,asset:string):Promise<CoverAssetInfo>{
 if(bytes.length>50*1024*1024)throw Error('Choose a cover file smaller than 50 MiB.');
 if(bytes.subarray(0,5).toString()==='%PDF-'){
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const task=pdfjs.getDocument({data:new Uint8Array(bytes),useSystemFonts:false});try{const pdf=await task.promise;if(pdf.numPages!==1)throw Error(`This file contains ${pdf.numPages} pages. A full-wrap print cover must contain exactly 1 page.`);if(await pdf.getJSActions())throw Error('Active PDF scripts are not supported.');const page=await pdf.getPage(1),v=page.getViewport({scale:1});if(page.rotate!==0)throw Error('Use an unrotated full-wrap PDF.');return {asset,width:v.width,height:v.height,pages:1,format:'PDF',color:'Color profile not qualified; no CMYK/PDF-X conversion'};}finally{await task.destroy();}}
 const im=ebookImage(bytes,false);return {asset,width:im.width,height:im.height,format:im.mime==='image/png'?'PNG':'JPEG',color:'Original image colors preserved; no color-managed conversion',dataUrl:`data:${im.mime};base64,${bytes.toString('base64')}`};
}
export type CoverJob={root:string;resources:string;temporary:string;plan:PublicationPlan;pages:number;interior:string};
export async function renderCover(job:CoverJob,signal:AbortSignal):Promise<CoverResult>{
 const c=readCovers(job.plan),g=coverGeometry(job.plan,job.pages),issues:string[]=[],blocking:string[]=[],fingerprint=coverHash(coverIdentity(job.plan,job.interior));let bytes:Buffer,previewSize:{width:number;height:number}|undefined;
 if(c.mode==='pdf'){
 if(!c.wrapAsset)throw Error('Choose a full-wrap PDF.');bytes=await fs.readFile(await verifiedAsset(job.root,c.wrapAsset));const info=await inspectCover(bytes,c.wrapAsset);if(info.format!=='PDF')throw Error('Choose a PDF.');previewSize={width:info.width,height:info.height};if(Math.abs(info.width-g.width)>.1||Math.abs(info.height-g.height)>.1)blocking.push(`Full-wrap dimensions do not match. Expected ${(g.width/72).toFixed(3)} × ${(g.height/72).toFixed(3)} in; imported ${(info.width/72).toFixed(3)} × ${(info.height/72).toFixed(3)} in. No resizing was performed.`);issues.push('Professional PDF copied unchanged. Review fonts, artwork, safe areas and color with your designer.');
 }else{
 if(!c.front.asset)throw Error('Choose Front Cover artwork.');await fs.mkdir(job.temporary,{recursive:true});const temp=await fs.mkdtemp(path.join(job.temporary,'cover-'));
 try{
 const panels=[];for(const [name,panel,x,w] of [['back',c.back,0,g.trimWidth+g.bleed],['front',c.front,g.frontX,g.trimWidth+g.bleed]] as const){if(!panel.asset)continue;const raw=await fs.readFile(await verifiedAsset(job.root,panel.asset)),info=await inspectCover(raw,panel.asset);if(info.format==='PDF')throw Error('Panel artwork must be PNG or JPEG.');const file=name+(info.format==='PNG'?'.png':'.jpg');await fs.writeFile(path.join(temp,file),raw);const placement=panelPlacement(panel,info,w,g.height);panels.push({file,x,width:w,height:g.height,placement});if(placement.ppi<300)issues.push(`${name}: ${Math.round(placement.ppi)} PPI; recommended 300 PPI (${placement.targetWidth} × ${placement.targetHeight} px).`);if(placement.crop>.1)issues.push(`${name}: ${placement.crop.toFixed(1)}% of artwork cropped.`);}
 if(c.back.asset)issues.push('Back artwork crosses the barcode guide. Keep that area free of important artwork/text; KDP places its own barcode.');
 const text=g.spineText?[c.spine.hideTitle?'':c.spine.title??job.plan.metadata.title,c.spine.hideAuthor?'':c.spine.author??job.plan.metadata.author].filter(Boolean).join(' · '):'';
 const fonts=await installedPrintFonts(),matches=fonts.filter(f=>f.family.toLowerCase()===c.spine.font.toLowerCase());await fs.mkdir(path.join(temp,'fonts'));
 if(text&&c.spine.font!=='Libertinus Serif'&&(!matches.length||matches.some(f=>!embeddingAllowed(f.fsType))))throw Error('The spine font is missing or restricts embedding. Choose an available font.');
 if(text)for(const [i,f] of [...new Set(matches.map(m=>m.file))].entries())await stagePrintFont(f,path.join(temp,'fonts',i+path.extname(f)));
 await fs.writeFile(path.join(temp,'cover.json'),JSON.stringify({g,c,panels,text}));await fs.copyFile(path.join(job.resources,'cover.typ'),path.join(temp,'cover.typ'));
 const exe=path.join(job.resources,'typst.exe');if(coverHash(await fs.readFile(exe))!=='081217a463adb006f8894b44227fe4b9c9e91fc85f5463d5948e8370db9bb31e')throw Error('Bundled typesetter integrity check failed.');
 const result=await typstProcess(exe,['compile','--root',temp,'--ignore-system-fonts','--font-path',path.join(temp,'fonts'),'--package-path',temp,'--package-cache-path',temp,'--creation-timestamp','0','cover.typ','cover.pdf'],temp,signal);if(result.stderr.trim())throw Error('Cover typesetting warning: '+result.stderr);
 bytes=await fs.readFile(path.join(temp,'cover.pdf'));const info=await inspectCover(bytes,'cover.pdf');if(Math.abs(info.width-g.width)>.05||Math.abs(info.height-g.height)>.05)throw Error('Generated cover dimensions failed verification.');
 }finally{await fs.rm(temp,{recursive:true,force:true});}}
 if(signal.aborted)throw Error('Cover canceled.');return {id:randomUUID(),fingerprint,interior:job.interior,geometry:g,previewSize,blocking,pdf:new Uint8Array(bytes),issues,sha256:coverHash(bytes)};
}
export function coverWorker(job:CoverJob,signal:AbortSignal):Promise<CoverResult>{return new Promise((resolve,reject)=>{if(signal.aborted){reject(Error('Cover canceled.'));return;}const worker=new Worker(new URL('./coverWorker.js',import.meta.url),{workerData:job,execArgv:[]});let result:CoverResult|undefined,error:Error|undefined;const cancel=()=>worker.postMessage('cancel');signal.addEventListener('abort',cancel,{once:true});worker.on('message',m=>{if(m.error)error=Error(m.error);else result=m.result;});worker.on('error',e=>error=e);worker.on('exit',code=>{signal.removeEventListener('abort',cancel);if(signal.aborted)reject(Error('Cover canceled.'));else if(error)reject(error);else if(code||!result)reject(Error('Cover worker stopped.'));else resolve(result);});});}

/** Untrusted image/PDF decoding stays off Electron's persistence/UI thread. */
export function inspectCoverInWorker(bytes:Buffer,asset:string):Promise<CoverAssetInfo>{return new Promise((resolve,reject)=>{const worker=new Worker(new URL('./coverInspectWorker.js',import.meta.url),{workerData:{bytes,asset},execArgv:[]});let result:CoverAssetInfo|undefined,error:Error|undefined;const timeout=setTimeout(()=>{error=Error('Cover inspection timed out.');void worker.terminate();},30000);worker.on('message',m=>{if(m.error)error=Error(m.error);else result=m.result;});worker.on('error',e=>error=e);worker.on('exit',code=>{clearTimeout(timeout);if(error)reject(error);else if(code||!result)reject(Error('Cover inspection stopped.'));else resolve(result);});});}
