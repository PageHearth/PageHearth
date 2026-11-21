import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { Unzipped } from 'fflate';
import {archiveEntries,consumeEntry,fileChunks} from './streamArchive.js';
import { defaultAuthor, legacyQuickNotesId, validate, type Project } from '../shared/model.js';
import { ensureAuthor } from '../shared/author.js';
import { MANIFEST, LEGACY_MANIFEST } from './projectPaths.js';
import {validateWriting} from '../shared/writing.js';

// Asset verification is streamed; only canonical JSON/inventory is retained.
const MAX_METADATA=128*1024*1024;
export async function readBackup(file:string){
  const h=await fs.open(file,'r');
  try{
    const entries=await archiveEntries(h),files:Record<string,Buffer>=Object.create(null),hashes:Record<string,string>=Object.create(null);let metadataBytes=0;
    for(const entry of entries){const retain=entry.name==='writing.json'||entry.name==='backup-integrity.json'||entry.name==='author.json'||/^manuscript\/[a-f0-9-]{36}\.json$/.test(entry.name)||(!entry.name.includes('/')&&(entry.name===LEGACY_MANIFEST||/\.(pagehearth|storyloom)$/i.test(entry.name)));const chunks:Buffer[]=[];
      if(retain){metadataBytes+=entry.size;if(metadataBytes>MAX_METADATA)throw Error('Backup canonical metadata exceeds the 128 MiB safety limit.');}
      hashes[entry.name]=await consumeEntry(h,entry,retain?async bytes=>{chunks.push(bytes)}:undefined);if(retain)files[entry.name]=Buffer.concat(chunks);
    }
    if(!files['backup-integrity.json'])throw Error('Backup integrity inventory is missing.');const inventory=JSON.parse(files['backup-integrity.json'].toString());if(!inventory||typeof inventory!=='object'||Array.isArray(inventory))throw Error('Invalid backup inventory.');
    const names=entries.map(e=>e.name).filter(n=>n!=='backup-integrity.json');if(names.length!==Object.keys(inventory).length)throw Error('Backup has unverified or missing files.');for(const name of names)if(!Object.hasOwn(inventory,name)||typeof inventory[name]!=='string'||hashes[name]!==inventory[name])throw Error('Backup integrity check failed.');
    const manifests=names.filter(n=>!n.includes('/')&&(n===LEGACY_MANIFEST||/\.(pagehearth|storyloom)$/i.test(n)));if(manifests.length!==1)throw Error('Backup must contain exactly one project manifest.');const manifestName=manifests[0],manifest=JSON.parse(files[manifestName].toString());
    if(!Array.isArray(manifest.nodes)||manifest.nodes.some((n:any)=>typeof n.id!=='string'||!/^[a-f0-9-]{36}$/.test(n.id)))throw Error('Invalid backup manuscript paths.');const documents:Project['documents']={};for(const n of manifest.nodes){const content=files[`manuscript/${n.id}.json`];if(!content)throw Error('Backup is missing manuscript content.');documents[n.id]=JSON.parse(content.toString())}
    const author=files['author.json']?JSON.parse(files['author.json'].toString()):defaultAuthor(legacyQuickNotesId(manifest.id)),project:Project=ensureAuthor({manifest,documents,author,recovery:[]});validate(project);if(files['writing.json'])validateWriting(JSON.parse(files['writing.json'].toString()),manifest.id);return {project,manifestName,hashes,manifestBytes:files[manifestName]};
  }finally{await h.close()}
}
export async function restoreBackup(file:string,parent:string){
  const checked=await readBackup(file); // Full integrity/model validation before destination writes.
  const base=await fs.realpath(parent),root=path.join(base,`PageHearth Restored ${randomUUID()}`),h=await fs.open(file,'r');
  try{const entries=await archiveEntries(h);if(entries.length!==Object.keys(checked.hashes).length||entries.some(e=>!Object.hasOwn(checked.hashes,e.name)))throw Error('Backup changed after verification.');
    await fs.mkdir(root);for(const d of ['manuscript','research','characters','locations','monsters','notes','assets','snapshots','backups','exports','.storyloom'])await fs.mkdir(path.join(root,d));await fs.writeFile(path.join(root,'.storyloom','restore-in-progress.json'),JSON.stringify({source:file}),{flag:'wx'});
    for(const entry of entries){if(entry.name==='backup-integrity.json'||entry.name===checked.manifestName)continue;const target=path.join(root,...entry.name.split('/'));await fs.mkdir(path.dirname(target),{recursive:true});const out=await fs.open(target,'wx');try{const sha=await consumeEntry(h,entry,async bytes=>{await out.writeFile(bytes)});if(sha!==checked.hashes[entry.name])throw Error('Backup changed during restore.');await out.sync()}finally{await out.close()}
      const verify=await fs.open(target,'r'),sha=createHash('sha256');try{for await(const chunk of fileChunks(verify,0,(await verify.stat()).size))sha.update(chunk)}finally{await verify.close()}if(sha.digest('hex')!==checked.hashes[entry.name])throw Error('Restored file verification failed. Partial restore preserved at '+root);
    }
    const out=await fs.open(path.join(root,MANIFEST),'wx');try{await out.writeFile(checked.manifestBytes);await out.sync()}finally{await out.close()}await fs.unlink(path.join(root,'.storyloom','restore-in-progress.json'));return root;
  }finally{await h.close()}
}
export async function readRecovery(file:string){
  if((await fs.stat(file)).size>128*1024*1024)throw Error('Recovery JSON exceeds the 128 MiB safety limit.');
  const project=ensureAuthor(JSON.parse(await fs.readFile(file,'utf8')));validate(project);return project;
}
export async function restoreRecovery(file:string,parent:string){
  const project=await readRecovery(file);const files:Unzipped={};
  files[MANIFEST]=Buffer.from(JSON.stringify(project.manifest,null,2)+'\n');
  files['author.json']=Buffer.from(JSON.stringify(project.author,null,2)+'\n');
  for(const node of project.manifest.nodes)files[`manuscript/${node.id}.json`]=Buffer.from(JSON.stringify(project.documents[node.id],null,2)+'\n');
  return restoreFiles({files,project,manifestName:MANIFEST},parent,file);
}
async function restoreFiles(checked:{files:Unzipped;project:Project;manifestName:string},parent:string,source:string){
  const base=await fs.realpath(parent);
  const root=path.join(base,`PageHearth Restored ${randomUUID()}`);
  await fs.mkdir(root); // Exclusive new directory; never merge into an existing project.
  for(const d of ['manuscript','research','characters','locations','monsters','notes','assets','snapshots','backups','exports','.storyloom'])await fs.mkdir(path.join(root,d));
  await fs.writeFile(path.join(root,'.storyloom','restore-in-progress.json'),JSON.stringify({source}),{flag:'wx'});
  for(const [name,bytes] of Object.entries(checked.files)){
    if(name==='backup-integrity.json' || name===checked.manifestName)continue;
    const target=path.join(root,...name.split('/'));await fs.mkdir(path.dirname(target),{recursive:true});
    const h=await fs.open(target,'wx');try{await h.writeFile(bytes);await h.sync();}finally{await h.close();}
    if(!(await fs.readFile(target)).equals(Buffer.from(bytes)))throw Error('Restored file verification failed. Partial restore preserved at '+root);
  }
  const h=await fs.open(path.join(root,MANIFEST),'wx');try{await h.writeFile(checked.files[checked.manifestName]);await h.sync();}finally{await h.close();}
  await fs.unlink(path.join(root,'.storyloom','restore-in-progress.json'));
  return root;
}
