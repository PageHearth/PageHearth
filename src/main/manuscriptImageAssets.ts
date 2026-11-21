import {promises as fs,constants} from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {ebookImage} from './ebookImages.js';
import {manuscriptImageAsset} from '../shared/manuscriptImages.js';

export const manuscriptImageByteLimit=50*1024*1024;
/** Cheap allocation guard before Electron decodes; full PNG validation remains in the worker. */
export function manuscriptImageDecodeBounds(bytes:Buffer){
 if(bytes.length>manuscriptImageByteLimit)throw Error('Choose an image smaller than 50 MiB.');
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){
  if(bytes.length<33||bytes.readUInt32BE(8)!==13||bytes.toString('ascii',12,16)!=='IHDR')throw Error('Invalid PNG image.');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  if(!width||!height||width*height>32_000_000)throw Error('Image exceeds the safe 32-megapixel limit.');
  return {width,height};
 }
 const image=ebookImage(bytes,false);return {width:image.width,height:image.height};
}
export type PreparedManuscriptImage={bytes:Buffer;extension:'.png'|'.jpg';width:number;height:number;digest:string};
/** No writes. PNG/JPEG only until other formats have an explicitly tested conversion path. */
export function prepareManuscriptImage(bytes:Buffer):PreparedManuscriptImage{
 if(bytes.length>manuscriptImageByteLimit)throw Error('Choose an image smaller than 50 MiB.');
 const image=ebookImage(bytes,false);
 return {bytes:Buffer.from(bytes),extension:image.mime==='image/png'?'.png':'.jpg',width:image.width,height:image.height,digest:createHash('sha256').update(bytes).digest('hex')};
}
async function directory(root:string){
 const real=await fs.realpath(root);let dir=real;
 for(const part of ['assets','manuscript']){dir=path.join(dir,part);await fs.mkdir(dir,{recursive:true});const stat=await fs.lstat(dir);if(stat.isSymbolicLink()||!stat.isDirectory()||await fs.realpath(dir)!==dir)throw Error('Linked manuscript asset directories are not supported.');}
 return {real,dir};
}
/** Publish complete, durable bytes exclusively. A duplicate is verified, never overwritten. */
export async function writeManuscriptImage(root:string,image:PreparedManuscriptImage){
 // Recheck at this trust boundary; a caller cannot forge the content-addressed name.
 const checked=prepareManuscriptImage(image.bytes);
 const {real,dir}=await directory(root),asset=`assets/manuscript/${checked.digest}${checked.extension}`,file=path.join(real,...asset.split('/'));
 const verify=async()=>{const st=await fs.lstat(file);if(!st.isFile()||st.isSymbolicLink()||st.size!==checked.bytes.length)throw Error('A manuscript image asset is damaged.');if(!checked.bytes.equals(await fs.readFile(file)))throw Error('A manuscript image asset is damaged.');};
 try{await verify();return {asset,created:false,width:checked.width,height:checked.height};}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 const temporary=path.join(dir,'.import-'+randomUUID()),handle=await fs.open(temporary,'wx');
 try{await handle.writeFile(checked.bytes);await handle.sync();}catch(e){await handle.close();await fs.unlink(temporary);throw e;}await handle.close();
 let created=false;
 try{try{await fs.link(temporary,file);created=true;}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}await verify();return {asset,created,width:checked.width,height:checked.height};}finally{await fs.unlink(temporary);}
}
/** Explicit rollback only for newly created assets BEFORE any protection/save attempt. */
export async function discardUnpublishedManuscriptImage(root:string,asset:string){
 if(!manuscriptImageAsset(asset))throw Error('Invalid manuscript image asset.');
 const {real}=await directory(root),file=path.join(real,...asset.split('/'));const st=await fs.lstat(file).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
 if(st){if(st.isSymbolicLink()||!st.isFile())throw Error('Unsafe manuscript image asset.');await fs.unlink(file);}
}
