import {manuscriptImagePlacement} from '../shared/manuscriptImages.js';
import {printRegionStyles} from '../shared/printVariants.js';
import {specialTextRoles,specialTextStyle} from '../shared/specialText.js';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {Worker} from 'node:worker_threads';
import {createHash,randomUUID} from 'node:crypto';
import {compilePublication,type PublicationDocument,type PublicationRenderer,type PreflightIssue} from '../shared/publicationCompiler.js';
import {validate,type Project} from '../shared/model.js';
import {safeAsset} from '../shared/publication.js';
import {classicPrint,printIssue,printPreflight,type PrintProof} from '../shared/printProduction.js';
import {embeddingAllowed,installedPrintFonts} from './printFonts.js';
const sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
export const printFingerprint=(p:Project)=>sha(JSON.stringify(compilePublication(p,'print')));
/** Dialog chooses destination; only a complete, verified PDF is atomically published. */
export async function writePrintPdf(proof:PrintProof,destination:string,projectRoot:string){
 if(proof.diagnostics.some(i=>i.blocking)||!Buffer.from(proof.pdf).subarray(0,5).equals(Buffer.from('%PDF-'))||sha(Buffer.from(proof.pdf))!==proof.sha256)throw Error('Print artifact failed verification.');
 destination=path.resolve(destination);if(path.extname(destination).toLowerCase()!=='.pdf'||destination.toLowerCase().startsWith(path.resolve(projectRoot).toLowerCase()+path.sep))throw Error('Choose a PDF destination outside the project folder to protect project data.');
 const temporary=path.join(path.dirname(destination),'.pagehearth-print-'+randomUUID()+'.tmp');try{const h=await fs.open(temporary,'wx');try{await h.writeFile(proof.pdf);await h.sync();}finally{await h.close();}await fs.rename(temporary,destination);return destination;}finally{await fs.rm(temporary,{force:true});}
}
/** PDF inspection and asset/font work also stay off Electron's persistence thread. */
export class PrintWorkerRenderer implements PublicationRenderer<{root:string},PrintProof>{
 constructor(private resources:string,private temporary:string){}
 render(document:PublicationDocument,options:{root:string},signal:AbortSignal):Promise<PrintProof>{return new Promise((resolve,reject)=>{if(signal.aborted){reject(Error('Render canceled.'));return;}const worker=new Worker(new URL('./printWorker.js',import.meta.url),{workerData:{resources:this.resources,temporary:this.temporary,document,root:options.root},execArgv:[]});let result:PrintProof|undefined,error:Error|undefined;const cancel=()=>worker.postMessage('cancel');signal.addEventListener('abort',cancel,{once:true});worker.on('message',m=>{if(m.error)error=Error(m.error);else result=m.result;});worker.on('error',e=>{error=e;});worker.on('exit',code=>{signal.removeEventListener('abort',cancel);if(signal.aborted)reject(Error('Render canceled.'));else if(error)reject(error);else if(code!==0||!result)reject(Error('Print worker stopped unexpectedly.'));else resolve(result);});});}
}
/** Trusted sibling runtime only; never change the application or system environment. */
export function typstEnvironment(exe:string,source:NodeJS.ProcessEnv=process.env,platform:NodeJS.Platform=process.platform):NodeJS.ProcessEnv{
 const env={...source};for(const k of Object.keys(env))if(k.startsWith('TYPST_'))delete env[k];
 if(platform==='win32'&&path.win32.basename(exe).toLowerCase()==='typst.exe'){
  const keys=Object.keys(env).filter(k=>k.toLowerCase()==='path').sort();
  const inherited=keys.length?env[keys[0]]:undefined;for(const k of keys)delete env[k];
  const bundled=path.win32.resolve(path.win32.dirname(exe),'../epub/java/bin');
  env.Path=bundled+(inherited?';'+inherited:'');
 }
 return env;
}
/** No shell, bounded output/time, wait for process close before cleanup or next job. */
export function typstProcess(exe:string,args:string[],cwd:string,signal:AbortSignal,timeout=120000):Promise<{stdout:string;stderr:string}>{return new Promise((resolve,reject)=>{
 if(signal.aborted){reject(Error('Render canceled.'));return;}
 const env=typstEnvironment(exe);
 const child=spawn(exe,args,{cwd,windowsHide:true,shell:false,env,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',failure:Error|undefined;
 const stop=(error:Error)=>{failure=error;child.kill();};const abort=()=>stop(Error('Render canceled.'));signal.addEventListener('abort',abort,{once:true});const timer=setTimeout(()=>stop(Error('Print rendering exceeded two minutes.')),timeout);
 child.stdout.on('data',b=>{stdout+=b;if(stdout.length>16*1024*1024)stop(Error('Render output exceeded its limit.'));});child.stderr.on('data',b=>{stderr+=b;if(stderr.length>1024*1024)stop(Error('Render diagnostics exceeded their limit.'));});
 child.on('error',e=>{failure=e;});child.on('close',code=>{clearTimeout(timer);signal.removeEventListener('abort',abort);if(failure)reject(failure);else if(code!==0)reject(Error('Typst could not render this book. '+stderr.slice(0,4000)));else resolve({stdout,stderr});});
 });}
export async function verifiedAsset(root:string,asset:string){if(!safeAsset(asset))throw Error('Invalid print asset path.');const realRoot=await fs.realpath(root),candidate=path.resolve(realRoot,asset);if(!candidate.startsWith(realRoot+path.sep))throw Error('Asset escaped project.');let at=realRoot;for(const piece of asset.split('/')){at=path.join(at,piece);if((await fs.lstat(at)).isSymbolicLink())throw Error('Linked print assets are not supported.');}const actual=await fs.realpath(candidate);if(!actual.startsWith(realRoot+path.sep))throw Error('Asset escaped project.');return actual;}
export class TypstPrintRenderer implements PublicationRenderer<{root:string},PrintProof>{
 constructor(public resources:string,public temporary:string){}
 async render(document:PublicationDocument,options:{root:string},signal:AbortSignal):Promise<PrintProof>{
  const started=performance.now(),exe=path.join(this.resources,'typst.exe');const runtime=JSON.parse(await fs.readFile(path.join(this.resources,'runtime.json'),'utf8'));
  if(runtime.version!=='0.15.1'||sha(await fs.readFile(exe))!=='081217a463adb006f8894b44227fe4b9c9e91fc85f5463d5948e8370db9bb31e')throw Error('Bundled Typst is unavailable or damaged. Reinstall PageHearth.');
  const integrityDone=performance.now();const diagnostics=printPreflight(document);if(diagnostics.some(i=>i.blocking&&i.code!=='ingram-unqualified'))throw Error(diagnostics.filter(i=>i.blocking).map(i=>i.message).join('\n'));
  await fs.mkdir(this.temporary,{recursive:true});const job=await fs.mkdtemp(path.join(this.temporary,'job-'));
  try{
   const d:any=structuredClone(document);d.production={...classicPrint,...d.production};
   const catalog=await installedPrintFonts(),fontReports:PrintProof['fonts']=[],stagedFonts=new Set<string>();const stage=async(file:string)=>{if(stagedFonts.has(file))return;await stagePrintFont(file,path.join(job,'fonts',sha(file).slice(0,20)+path.extname(file)));stagedFonts.add(file);};await fs.mkdir(path.join(job,'fonts'));
   d.specialText=Object.fromEntries(Object.keys(specialTextRoles).map(role=>[role,specialTextStyle(role as keyof typeof specialTextRoles,d.style.specialText,d.style.print)]));
   for(const [index,{region,style}] of printRegionStyles(document).entries()){const key='region-'+index;d.specialText[key]=style;const section=d.sections.find((s:any)=>s.source.id===region.sourceId&&s.source.kind===region.sourceKind);if(section)for(const path of region.paths){const walk=(nodes:any[])=>{for(const n of nodes){if(n.source.id===region.sourceId&&JSON.stringify(n.source.path)===JSON.stringify(path))n.printStyleKey=key;if(n.children)walk(n.children);}};walk(section.nodes);}}
   for(const [key,requested] of [['bodyFont',d.style.print.font],['chapterFont',d.production.chapterFont],...Object.entries(d.specialText).map(([role,s])=>[role,(s as any).font])]){
    const wanted=requested==='serif'?'Libertinus Serif':requested,entries=catalog.filter(f=>f.family.toLowerCase()===wanted.toLowerCase());let resolved=wanted;
    if(wanted!=='Libertinus Serif'&&(!entries.length||entries.some(f=>!embeddingAllowed(f.fsType)))){resolved='Libertinus Serif';diagnostics.push(printIssue(document,'font-unresolved',`${wanted} is unavailable or restricts embedding/subsetting. Preview uses Libertinus Serif; choose an available embeddable font before export.`,true,'Choose an available font in Body, Chapter title or Special Text settings.'));}
    else for(const file of new Set(entries.map(f=>f.file)))await stage(file);
    if(key in d.specialText)d.specialText[key].font=resolved;else d[key]=resolved;fontReports.push({requested,resolved,embedded:false,fallback:resolved!==wanted});
   }
   const visible=JSON.stringify(d.sections);
   const fallbacks:string[]=[];
   for(const [needed,families] of [[/[\u3000-\u9fff\uac00-\ud7af]/u.test(visible),['Microsoft YaHei','Microsoft YaHei UI','Yu Gothic','SimSun']],[/\p{Extended_Pictographic}/u.test(visible),['Segoe UI Emoji','Segoe UI Symbol']]] as [boolean,string[]][]){
    if(!needed)continue;const family=families.find(name=>catalog.some(f=>f.family===name)&&catalog.filter(f=>f.family===name).every(f=>embeddingAllowed(f.fsType)));
    if(family){fallbacks.push(family);for(const file of new Set(catalog.filter(f=>f.family===family).map(f=>f.file)))await stage(file);fontReports.push({requested:'Unicode glyph fallback',resolved:family,embedded:false,fallback:true});}
   }
   if(fallbacks.length){d.bodyFont=[d.bodyFont,...fallbacks];d.chapterFont=[d.chapterFont,...fallbacks];for(const style of Object.values(d.specialText) as any[])style.font=[style.font,...fallbacks];diagnostics.push(printIssue(document,'glyph-fallback','Unicode glyph fallback fonts: '+fallbacks.join(', ')+'. Review their license and appearance in Proof.'));}
   const fontsDone=performance.now();
   const imageFiles=new Map<string,string>();let images=0;
   const visit=async(nodes:any[])=>{for(const n of nodes){if(n.kind==='image'){
    const im=n.image,source=await verifiedAsset(options.root,im.asset);if(!/\.(png|jpe?g)$/i.test(source))throw Error('Print images currently require PNG or JPEG.');let local=imageFiles.get(im.asset);if(!local){local='image-'+imageFiles.size+path.extname(source).toLowerCase();await fs.copyFile(source,path.join(job,local));imageFiles.set(im.asset,local);}im.local=local;images++;
    // PNG/JPEG pixel dimensions without decoding full-resolution images.
    const b=await fs.readFile(source);let width=0;if(b.subarray(1,4).toString()==='PNG')width=b.readUInt32BE(16);else {for(let i=2;i+9<b.length;){if(b[i]!==255)break;const marker=b[i+1],len=b.readUInt16BE(i+2);if([192,193,194].includes(marker)){width=b.readUInt16BE(i+7);break;}if(len<2)break;i+=2+len;}}
    if(im.size&&im.width&&im.height){const placed=manuscriptImagePlacement(im,d.print.width-d.print.margins.inside-d.print.margins.outside-d.print.gutter,d.print.height-d.print.margins.top-d.print.margins.bottom-72);im.placedWidth=placed.width;im.placedHeight=placed.height;if(placed.ppi<300)diagnostics.push({...printIssue(document,'image-ppi',`Image resolution ${Math.round(placed.ppi)} PPI at intended size; recommended 300 PPI.`,false,'Choose higher-resolution artwork or a smaller size.'),source:n.source});}
    const points=(d.print.width-d.print.margins.inside-d.print.margins.outside-d.print.gutter)*(im.sizing==='inline'?.6:1);const dpi=width/(points/72);if(!im.size&&(!width||dpi<300))diagnostics.push({...printIssue(document,'image-dpi',`Image resolution ${Math.round(dpi)} DPI at intended width; recommended 300 DPI.`,d.print.profile==='kdp','Choose a higher-resolution image or reduce its printed width.'),source:n.source});
   }if(n.children)await visit(n.children);}};for(const s of d.sections)await visit(s.nodes);
   const assetsDone=performance.now();
   await fs.copyFile(path.join(this.resources,'book.typ'),path.join(job,'book.typ'));await fs.writeFile(path.join(job,'book.json'),JSON.stringify(d));const generated=performance.now();
   const common=['--root',job,'--ignore-system-fonts','--font-path',path.join(job,'fonts'),'--package-path',job,'--package-cache-path',job];
   const result=await typstProcess(exe,['compile',...common,'--jobs','2','--creation-timestamp','0','book.typ','book.pdf'],job,signal);const rendered=performance.now();
   if(result.stderr.trim())diagnostics.push(printIssue(document,'typst-warning','Typesetter reported warnings. Review technical details before export.',true));
   const query=await typstProcess(exe,['query',...common,'book.typ','<ph-map>'],job,signal);const anchors=JSON.parse(query.stdout),queryDone=performance.now();
   const bytes=await fs.readFile(path.join(job,'book.pdf'));const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
   const task=pdfjs.getDocument({data:new Uint8Array(bytes),useSystemFonts:false,disableFontFace:true,fontExtraProperties:true});const pdf=await task.promise;
   let pages=0,missingGlyph=false;const embedded=new Map<string,boolean>();
   try{pages=pdf.numPages;for(let i=1;i<=pages;i++){if(signal.aborted)throw Error('Render canceled.');const page=await pdf.getPage(i);const list=await page.getOperatorList();for(let j=0;j<list.fnArray.length;j++)if(list.fnArray[j]===pdfjs.OPS.setFont){const name=list.argsArray[j][0];try{const f=page.commonObjs.get(name);embedded.set(f.name,!!f.data?.length||f.isType3Font===true);}catch{embedded.set(name,false);}}const text=await page.getTextContent();if(text.items.some(item=>'str' in item&&/[\u0000\ufffd]/u.test(item.str)))missingGlyph=true;page.cleanup();}}finally{await task.destroy();}
   if(missingGlyph)diagnostics.push(printIssue(document,'missing-glyph','The PDF contains missing or unmapped glyphs. Choose fonts covering all manuscript characters before export.',true,'Choose a font supporting the affected script and refresh Proof.'));
   const allEmbedded=embedded.size>0&&[...embedded.values()].every(Boolean);for(const f of fontReports)f.embedded=allEmbedded;
   if(!allEmbedded)diagnostics.push(printIssue(document,'font-embedding','PDF font embedding could not be verified for every used font.',true));
   diagnostics.push(...printPreflight(document,pages).filter(i=>!diagnostics.some(x=>x.code===i.code&&x.message===i.message)));
   const sections=anchors.map((a:any)=>({id:a.value.id,page:a.value.page,number:a.value.number}));
   diagnostics.push({severity:'info',code:'print-facts',message:`${pages} pages · ${d.print.width/72} × ${d.print.height/72} in · ${images} images · ${d.print.profile}`,blocking:false,target:'print',profile:d.print.profile,fix:''});
   return {id:randomUUID(),projectId:document.projectId,fingerprint:sha(JSON.stringify(document)),pdf:new Uint8Array(bytes),pages,diagnostics,fonts:fontReports,sections,timings:{integrityMs:integrityDone-started,fontsMs:fontsDone-integrityDone,imagesMs:assetsDone-fontsDone,inputMs:generated-assetsDone,queryMs:queryDone-rendered,pdfInspectionMs:performance.now()-queryDone,rssBytes:process.memoryUsage().rss,compileMs:0,generateMs:generated-started,renderMs:rendered-generated,inspectMs:performance.now()-rendered},bytes:bytes.length,sha256:sha(bytes),details:result.stderr+JSON.stringify({fonts:Object.fromEntries(embedded)},null,2)};
  }finally{await fs.rm(job,{recursive:true,force:true});}
 }
}
/** One active process/application. New work waits for the canceled process to close. */
export class PrintJobs{
 private controller?:AbortController;private running:Promise<unknown>=Promise.resolve();private generation=0;private requestId?:string;proof?:PrintProof;
 constructor(private renderer:PublicationRenderer<{root:string},PrintProof>){}
 cancel(requestId?:string){if(requestId!==undefined&&requestId!==this.requestId)return;this.generation++;this.controller?.abort();this.proof=undefined;}
 async render(p:Project,root:string,requestId:string=randomUUID()){validate(p);this.cancel();this.requestId=requestId;const gen=this.generation;const previous=this.running;const controller=new AbortController();this.controller=controller;const task=(async()=>{await previous.catch(()=>{});if(gen!==this.generation)throw Error('Render superseded.');const t=performance.now(),d=compilePublication(p,'print'),ms=performance.now()-t;const proof=await this.renderer.render(d,{root},controller.signal);if(gen!==this.generation)throw Error('Render superseded.');proof.timings.compileMs=ms;this.proof=proof;return proof;})();this.running=task;return task;}
}

/** Windows installed-font providers may reject CopyFile metadata operations while allowing byte reads. */
export async function stagePrintFont(source:string,destination:string){const bytes=await fs.readFile(source);await fs.writeFile(destination,bytes);if(sha(await fs.readFile(destination))!==sha(bytes))throw Error('Print font staging verification failed.');}
