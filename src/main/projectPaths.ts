import { promises as fs } from 'node:fs';
import path from 'node:path';

export const MANIFEST = 'project.pagehearth';
export const LEGACY_MANIFEST = 'storyloom.project.json';
export const isProjectFile = (file:string) => /\.(pagehearth|storyloom)$/i.test(file) || path.basename(file)===LEGACY_MANIFEST;
// Shell/CLI ownership is narrower than explicit legacy-folder import compatibility.
export const isShellProjectFile = (file:string) => /\.pagehearth$/i.test(file) || path.basename(file)===LEGACY_MANIFEST;
export async function projectRoot(input:string) {
  const absolute=path.resolve(input);
  let timer:ReturnType<typeof setTimeout>|undefined;
  const stat=await Promise.race([fs.stat(absolute),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Project location is unavailable. Reconnect the drive and try again.')),1200);})]).finally(()=>clearTimeout(timer));
  if(stat.isDirectory())return absolute;
  if(!stat.isFile() || !isProjectFile(absolute))throw Error('Choose a PageHearth manifest or a legacy project folder.');
  return path.dirname(absolute);
}
// A damaged current manifest must never silently fall back to an older legacy copy.
export async function discoverManifest(root:string):Promise<string> {
  const entries=await fs.readdir(root,{withFileTypes:true});
  if(entries.some(e=>e.isSymbolicLink() && isProjectFile(e.name)))throw Error('Project manifests must be ordinary files, not links.');
  const names=entries.filter(e=>e.isFile()).map(e=>e.name);
  const current=names.filter(n=>n.toLowerCase().endsWith('.pagehearth'));
  if(current.length>1)throw Error('Multiple PageHearth manifests found. Preserve the folder and resolve the ambiguity before opening.');
  if(current.length)return current[0];
  const legacy=names.filter(n=>n===LEGACY_MANIFEST || n.toLowerCase().endsWith('.storyloom'));
  if(legacy.length>1)throw Error('Multiple legacy manifests found. Preserve the folder before migration.');
  return legacy[0] ?? MANIFEST; // Interrupted first creation can have only a journal.
}
