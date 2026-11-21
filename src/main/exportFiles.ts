import {promises as fs} from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import type {ExportFormat,ExportReceipt} from '../shared/exportPublication.js';
export const byteHash=(b:Uint8Array|string)=>createHash('sha256').update(b).digest('hex');
export const exportAssetDirectory=(assets:Record<string,Uint8Array>)=>'book-images-'+byteHash(Object.entries(assets).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+byteHash(v)).join('|')).slice(0,12);
export async function destinationSnapshot(file:string):Promise<string|null>{try{const st=await fs.lstat(file);if(!st.isFile()||st.isSymbolicLink())throw Error('Choose an ordinary file destination.');return byteHash(await fs.readFile(file));}catch(e:any){if(e.code==='ENOENT')return null;throw e;}}
export async function safeExportDestination(file:string,root:string,format:ExportFormat){
 if(!path.isAbsolute(file)||path.extname(file).toLowerCase()!=='.'+format||/[<>:"|?*\x00-\x1f]/.test(path.basename(file))||/[. ]$/.test(file)||/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(path.basename(file))||/\.(pdf|epub|docx|html?|md|txt)\.(pdf|epub|docx|html?|md|txt)$/i.test(file))throw Error('Choose a filename ending only in .'+format+'.');
 const parent=await fs.realpath(path.dirname(file)),project=await fs.realpath(root);const inside=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase()||a.toLowerCase().startsWith(b.toLowerCase()+path.sep);
 if(inside(parent,project))throw Error('Export outside the project folder to protect project data.');
 return path.join(parent,path.basename(file));
}
/** Verify, sync, then publish. Cancellation before the final rename/link leaves the old file intact. */
export async function saveExport(bytes:Uint8Array,assets:Record<string,Uint8Array>,destination:string,root:string,format:ExportFormat,expected:string|null,signal:AbortSignal,stillCurrent:()=>boolean){
 const file=await safeExportDestination(destination,root,format),parent=path.dirname(file),temporary=path.join(parent,'.pagehearth-export-'+randomUUID()+'.tmp');let createdAssets:string|undefined,committed=false;
 const check=()=>{if(signal.aborted||!stillCurrent())throw Error('Export canceled or project changed.');};
 try{
  check();if(await destinationSnapshot(file)!==expected)throw Error('Destination changed; choose it again before replacing.');
  if(Object.keys(assets).length){
   const folder=exportAssetDirectory(assets),assetDir=path.join(parent,folder);
   try{await fs.mkdir(assetDir);createdAssets=assetDir;}catch(e:any){if(e.code!=='EEXIST')throw e;const st=await fs.lstat(assetDir);if(!st.isDirectory()||st.isSymbolicLink())throw Error('Unsafe companion image folder.');}
   for(const [name,data] of Object.entries(assets)){check();if(!/^image-[a-f0-9]{24}\.(png|jpg)$/.test(name))throw Error('Unsafe export image name.');const target=path.join(assetDir,name);if(createdAssets){const h=await fs.open(target,'wx');try{await h.writeFile(data);await h.sync();}finally{await h.close();}}else if(await destinationSnapshot(target)!==byteHash(data))throw Error('Companion image folder differs; choose another filename.');}
  }
  const h=await fs.open(temporary,'wx');try{await h.writeFile(bytes);await h.sync();}finally{await h.close();}
  if(byteHash(await fs.readFile(temporary))!==byteHash(bytes))throw Error('Export verification failed.');check();if(await destinationSnapshot(file)!==expected)throw Error('Destination changed during export.');check();
  if(expected===null)await fs.link(temporary,file);else await fs.rename(temporary,file);
  committed=true;return file;
 }finally{await fs.rm(temporary,{force:true});if(createdAssets&&!committed)await fs.rm(createdAssets,{recursive:true,force:true});}
}

/** Dialog routing follows the prepared artifact, never a prior UI format. */
export function exportSaveDialogOptions(receipt:Pick<ExportReceipt,'format'|'filename'>,directory=''){
 return {title:'Export '+receipt.format.toUpperCase(),defaultPath:path.join(directory,receipt.filename),filters:[{name:receipt.format.toUpperCase(),extensions:[receipt.format]}],properties:['showOverwriteConfirmation' as const]};
}
