import {promises as fs} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const uuid=/^[a-f0-9-]{36}$/;
async function noSurvivingChild(root:string){
 if(process.platform!=='win32')return false;
 const encoded=Buffer.from(root,'utf8').toString('base64');
 const script=`$target=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')); $items=Get-CimInstance Win32_Process -ErrorAction Stop; $busy=@($items | Where-Object { ($_.CommandLine -and $_.CommandLine.Contains($target)) -or (($_.Name -in @('java.exe','typst.exe')) -and !$_.CommandLine) }); if($busy.Count -eq 0){[Console]::Write('safe')}`;
 const {stdout}=await promisify(execFile)(path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,timeout:5000,maxBuffer:1024});return stdout==='safe';
}
async function ordinaryTree(root:string,budget={left:20000}){
 const stat=await fs.lstat(root);if(stat.isSymbolicLink()||--budget.left<0)throw Error('Unsafe publication temporary tree.');
 if(stat.isDirectory())for(const entry of await fs.readdir(root))await ordinaryTree(path.join(root,entry),budget);
}
/** A held SQLite write transaction is an OS-released lease, independent of PID reuse.
 * Only this fixed private namespace plus a valid ownership marker is scavenged.
 * Legacy unmarked temporary directories are deliberately not deletion authority. */
export class PublicationTemporary {
 private lease?:DatabaseSync;private constructor(readonly base:string,readonly root:string){}
 static async start(parent:string,report:(message:string)=>void=()=>{},orphan=noSurvivingChild,minimumAge=10*60*1000){
  const base=path.join(parent,'PageHearth-publication-v1');await fs.mkdir(base,{recursive:true});
  if((await fs.lstat(base)).isSymbolicLink())throw Error('Publication temporary folder is a link.');
  for(const name of (await fs.readdir(base)).slice(0,100)){
   if(!uuid.test(name))continue;const root=path.join(base,name);let lease:DatabaseSync|undefined;
   try{
    await ordinaryTree(root);
    const marker=JSON.parse(await fs.readFile(path.join(root,'owner.json'),'utf8'));
    if(marker.version!==1||marker.owner!==name||marker.product!=='PageHearth-publication'||!Number.isFinite(marker.created)||Date.now()-marker.created<minimumAge)continue;
    if((await fs.lstat(path.join(root,'lease.sqlite'))).isSymbolicLink())continue;
    lease=new DatabaseSync(path.join(root,'lease.sqlite'));lease.exec('PRAGMA busy_timeout=0; BEGIN IMMEDIATE');
    if(!await orphan(root))continue;
    await ordinaryTree(root);lease.close();lease=undefined;await fs.rm(root,{recursive:true});
   }catch(error){const message=String(error);if(!message.includes('locked'))report('A publication temporary session could not be cleaned. It will be checked at next startup.');}finally{lease?.close();}
  }
  const owner=randomUUID(),root=path.join(base,owner);await fs.mkdir(root);
  const result=new PublicationTemporary(base,root);result.lease=new DatabaseSync(path.join(root,'lease.sqlite'));result.lease.exec('CREATE TABLE owner(id TEXT); BEGIN IMMEDIATE');
  await fs.writeFile(path.join(root,'owner.json'),JSON.stringify({version:1,owner,product:'PageHearth-publication',created:Date.now()}),{flag:'wx'});return result;
 }
 async dispose(){
  if(!this.lease)return;
  // Caller has canceled and awaited every publication operation before releasing.
  await ordinaryTree(this.root);this.lease.close();this.lease=undefined;await fs.rm(this.root,{recursive:true});
 }
}
