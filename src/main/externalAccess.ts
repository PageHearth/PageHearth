import {promises as fs} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

export class ExternalAccessRequired extends Error {
 constructor(){super('This external location needs permission on this computer. Choose it again in Project protection or Locate File. Saved manuscript files are unaffected.');}
}
type Scope={root:string;projectId:string;purpose:'backup'|'research'};
type Grant=Scope & {requested:string;canonical:string;drive:string;projectIdentity:string;identity:string};
const key=(v:string)=>process.platform==='win32'?path.resolve(v).toLowerCase():path.resolve(v);
const identity=(s:{dev:number;ino:number})=>`${s.dev}:${s.ino}`;
export function externalPath(value:string){
 if(typeof value!=='string'||!path.isAbsolute(value)||value.includes('\0'))throw new ExternalAccessRequired();
 if(process.platform==='win32'&&(!/^(?:[a-z]:\\|\\\\[^\\?.][^\\]*\\[^\\]+)/i.test(value)||/^\\\\[?.]\\/.test(value)||value.slice(2).includes(':')))throw new ExternalAccessRequired();
 return path.resolve(value);
}
// QueryDosDevice reads the local DOS device namespace; it does not probe a share.
// Compare it BEFORE any I/O to a remembered path, including a mapped drive root.
export async function driveIdentity(file:string){
 if(process.platform!=='win32')return path.parse(file).root;
 const root=path.parse(file).root;if(root.startsWith('\\\\'))return root.toLowerCase();
 const drive=root.slice(0,2);if(!/^[a-z]:$/i.test(drive))throw new ExternalAccessRequired();
 const script=`Add-Type -TypeDefinition 'using System; using System.Text; using System.Runtime.InteropServices; public class PHDevice { [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] public static extern uint QueryDosDevice(string name, StringBuilder value, int size); }'; $b = New-Object System.Text.StringBuilder 32768; if([PHDevice]::QueryDosDevice('${drive}', $b, 32768) -eq 0){exit 1}; [Console]::Write($b.ToString())`;
 const {stdout}=await promisify(execFile)(path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,timeout:5000,maxBuffer:65536});return stdout;
}
/** Refuse links before walking into their target. No realpath on an unapproved path. */
export async function ordinaryPath(file:string){
 const absolute=externalPath(file);let at=path.parse(absolute).root;
 for(const part of absolute.slice(at.length).split(path.sep).filter(Boolean)){
  at=path.join(at,part);const stat=await fs.lstat(at);if(stat.isSymbolicLink())throw new ExternalAccessRequired();
 }
 return {canonical:await fs.realpath(absolute),identity:identity(await fs.lstat(absolute))};
}
/** Permissions belong to the local profile, never a project/backup/template. */
export class ExternalAccess {
 private grants:Grant[]=[];private writing=Promise.resolve();
 constructor(private file:string,private drive=driveIdentity){}
 async load(){try{const v=JSON.parse(await fs.readFile(this.file,'utf8'));if(v.version===1&&Array.isArray(v.grants))this.grants=v.grants.filter((g:any)=>g&&['root','projectId','purpose','requested','canonical','drive','projectIdentity','identity'].every(k=>typeof g[k]==='string'));}catch{/* Fail closed; never infer permission from portable data. */}}
 private match(s:Scope,requested:string){return this.grants.find(g=>g.root===key(s.root)&&g.projectId===s.projectId&&g.purpose===s.purpose&&g.requested===key(requested));}
 async authorize(s:Scope,chosen:string){
  const requested=externalPath(chosen),drive=await this.drive(requested),target=await ordinaryPath(requested),project=await fs.lstat(s.root);
  if(project.isSymbolicLink())throw new ExternalAccessRequired();
  const grant:Grant={...s,root:key(s.root),requested:key(requested),...target,drive,projectIdentity:identity(project)};
  // Commit permission only after the native chooser/confirmation caller has consent.
  const task=this.writing.then(async()=>{const next=this.grants.filter(g=>!(g.root===grant.root&&g.projectId===grant.projectId&&g.purpose===grant.purpose&&g.requested===grant.requested));next.push(grant);await fs.mkdir(path.dirname(this.file),{recursive:true});const temp=this.file+'.'+randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify({version:1,grants:next}),{flag:'wx'});await fs.rename(temp,this.file);this.grants=next;});this.writing=task.catch(()=>{});await task;return requested;
 }
 async require(s:Scope,file:string){
  const requested=externalPath(file),grant=this.match(s,requested);if(!grant)throw new ExternalAccessRequired();
  if(identity(await fs.lstat(s.root))!==grant.projectIdentity||await this.drive(requested)!==grant.drive)throw new ExternalAccessRequired();
  const actual=await ordinaryPath(requested);if(key(actual.canonical)!==key(grant.canonical)||actual.identity!==grant.identity)throw new ExternalAccessRequired();return actual.canonical;
 }
}
export async function projectAsset(root:string,relative:string){
 if(typeof relative!=='string'||!/^assets\/(?:research|world-bible)\/[a-z0-9._-]+$/i.test(relative)||['.','..'].includes(relative.split('/').at(-1)!))throw Error('Unsafe project asset.');
 const file=path.join(root,...relative.split('/'));await ordinaryPath(file);const actual=await fs.realpath(file),base=await fs.realpath(root);if(!actual.startsWith(base+path.sep))throw Error('Project asset escapes its folder.');return actual;
}
export async function projectAssetDirectory(root:string,category:'research'|'world-bible'){
 await ordinaryPath(root);let at=root;
 for(const part of ['assets',category]){at=path.join(at,part);let stat;try{stat=await fs.lstat(at);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;await fs.mkdir(at);stat=await fs.lstat(at);}if(stat.isSymbolicLink()||!stat.isDirectory())throw new ExternalAccessRequired();}
 return at;
}
