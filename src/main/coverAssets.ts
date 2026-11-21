import {promises as fs} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
/** Cover imports have opaque project-relative names; never follow a linked asset directory. */
export async function writeCoverAsset(root:string,bytes:Uint8Array,extension:string){
 if(!['.png','.jpg','.pdf'].includes(extension))throw Error('Unsupported cover asset type.');
 const real=await fs.realpath(root);let directory=real;
 for(const part of ['assets','covers']){directory=path.join(directory,part);await fs.mkdir(directory,{recursive:true});const st=await fs.lstat(directory);if(st.isSymbolicLink()||!st.isDirectory()||await fs.realpath(directory)!==directory)throw Error('Linked cover asset directories are not supported.');}
 const asset=`assets/covers/${randomUUID()}${extension}`,file=path.join(real,...asset.split('/'));const h=await fs.open(file,'wx');let complete=false;
 try{await h.writeFile(bytes);await h.sync();complete=true;return asset;}finally{await h.close();if(!complete)await fs.unlink(file);}
}
