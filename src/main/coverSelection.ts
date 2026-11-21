import {inspectCoverInWorker} from './coverProduction.js';
import type {CoverAssetInfo} from '../shared/covers.js';
/** Inspect before issuing an attachment token; rejected bytes never enter canonical state. */
export async function inspectCoverCandidate(bytes:Buffer,kind:string):Promise<{info:CoverAssetInfo}|{error:{message:string}}>{
 try{const info=await inspectCoverInWorker(bytes,'');if((kind==='pdf')!==(info.format==='PDF'))return {error:{message:'Choose a file of the requested type.'}};return {info};}
 catch(e){if(kind!=='pdf')throw e;const text=String(e),pages=text.match(/This file contains (\d+) pages\. A full-wrap print cover must contain exactly 1 page\./);
 return {error:{message:pages?pages[0]:'This PDF could not be opened as a usable single-page cover. Choose an unencrypted, unrotated PDF containing exactly 1 page.'}};}
}
