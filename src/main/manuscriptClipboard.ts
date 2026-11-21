import {promises as fs} from 'node:fs';
import {fileURLToPath} from 'node:url';
import type {ClipboardImageItem} from './clipboardMedia.js';
import {manuscriptImageByteLimit} from './manuscriptImageAssets.js';

/** Explicit Paste Image prefers real image data; Explorer Copy supplies a URI list. */
export async function manuscriptClipboard(items:readonly ClipboardImageItem[],encode:(bytes:Buffer)=>Buffer):Promise<Buffer|undefined>{
 let damaged=false;
 for(const item of items)for(const type of item.types.filter(t=>t.startsWith('image/'))){
  try{const value=await item.getType(type);if(!(value instanceof Blob)||value.size>manuscriptImageByteLimit){damaged=true;continue;}const png=encode(Buffer.from(await value.arrayBuffer()));if(png.length)return png;damaged=true;}catch{damaged=true;}
 }
 if(damaged)throw Error('The clipboard image could not be read. Copy a PNG or JPEG image again.');
 const paths:string[]=[];
 for(const item of items){if(!item.types.includes('text/uri-list'))continue;const value=await item.getType('text/uri-list');if(!(value instanceof Blob)||value.size>65536)throw Error('Copy one local PNG or JPEG image file.');for(const line of (await value.text()).split(/\r?\n/).filter(s=>s.trim()&&!s.startsWith('#'))){const url=new URL(line);if(url.protocol!=='file:'||url.hostname)throw Error('Copy one local PNG or JPEG image file.');paths.push(fileURLToPath(url));}}
 if(!paths.length)return undefined;
 if(paths.length!==1||! /\.(png|jpe?g)$/i.test(paths[0]))throw Error('Copy one local PNG or JPEG image file.');
 try{const stat=await fs.stat(paths[0]);if(!stat.isFile()||stat.size>manuscriptImageByteLimit)throw Error();return await fs.readFile(paths[0]);}catch{throw Error('The copied image file could not be read or exceeds 50 MiB. Copy it again.');}
}
