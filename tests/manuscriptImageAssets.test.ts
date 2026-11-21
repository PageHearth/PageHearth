import {it,expect} from 'vitest';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {manuscriptImageDecodeBounds,prepareManuscriptImage,writeManuscriptImage,discardUnpublishedManuscriptImage} from '../src/main/manuscriptImageAssets.js';
const fixture=()=>fs.readFile('assets/branding/pagehearth/PageHearth_App_Icon.png');
async function temporary(run:(root:string)=>Promise<void>){const root=await fs.mkdtemp(path.join(os.tmpdir(),'pagehearth-manuscript-image-'));try{await run(root);}finally{await fs.rm(root,{recursive:true,force:true});}}
it('durably stores identical bytes once and verifies concurrent imports',async()=>temporary(async root=>{
 const bytes=await fixture(),prepared=prepareManuscriptImage(bytes);const values=await Promise.all([writeManuscriptImage(root,prepared),writeManuscriptImage(root,prepared)]);
 expect(values[0].asset).toBe(values[1].asset);expect(values.filter(v=>v.created)).toHaveLength(1);expect(await fs.readFile(path.join(root,values[0].asset))).toEqual(bytes);expect(await fs.readdir(path.join(root,'assets/manuscript'))).toEqual([path.basename(values[0].asset)]);
}));
it('rejects a damaged duplicate rather than overwriting existing evidence',async()=>temporary(async root=>{
 const prepared=prepareManuscriptImage(await fixture()),a=await writeManuscriptImage(root,prepared);await fs.writeFile(path.join(root,a.asset),'damaged');await expect(writeManuscriptImage(root,prepared)).rejects.toThrow('damaged');expect(await fs.readFile(path.join(root,a.asset),'utf8')).toBe('damaged');
}));
it('validates before creating asset directories',async()=>temporary(async root=>{
 await expect(writeManuscriptImage(root,{bytes:Buffer.from('not an image'),extension:'.png',width:1,height:1,digest:'a'.repeat(64)})).rejects.toThrow();expect(await fs.readdir(root)).toEqual([]);
}));
it('rolls back an explicitly unpublished import and refuses unsafe paths',async()=>temporary(async root=>{
 const a=await writeManuscriptImage(root,prepareManuscriptImage(await fixture()));await discardUnpublishedManuscriptImage(root,a.asset);expect(await fs.readdir(path.join(root,'assets/manuscript'))).toEqual([]);await expect(discardUnpublishedManuscriptImage(root,'../other.png')).rejects.toThrow();
}));
it('does not follow a linked asset directory',async()=>temporary(async root=>temporary(async outside=>{
 await fs.symlink(outside,path.join(root,'assets'),process.platform==='win32'?'junction':'dir');try{await expect(writeManuscriptImage(root,prepareManuscriptImage(await fixture()))).rejects.toThrow('Linked');expect(await fs.readdir(outside)).toEqual([]);}finally{await fs.unlink(path.join(root,'assets'));}
})));

it('bounds native decoding before allocation, including externally damaged assets',async()=>{
 const bytes=await fixture();expect(manuscriptImageDecodeBounds(bytes)).toEqual({width:prepareManuscriptImage(bytes).width,height:prepareManuscriptImage(bytes).height});
 const huge=Buffer.from(bytes);huge.writeUInt32BE(100000,16);expect(()=>manuscriptImageDecodeBounds(huge)).toThrow('32-megapixel');
 expect(()=>manuscriptImageDecodeBounds(bytes.subarray(0,24))).toThrow('Invalid PNG');
 expect(()=>manuscriptImageDecodeBounds(Buffer.from('not an image'))).toThrow();
});
