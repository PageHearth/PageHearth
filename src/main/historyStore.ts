import {validateReferenceReplacement} from '../shared/referenceIntegrity.js';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {type Doc,type Project,words} from '../shared/model.js';
import {historyDocument,HISTORY_INTERVAL,type HistoryMeta,type HistoryList,type HistoryRetention} from '../shared/history.js';
const idPattern=/^[a-f0-9-]{36}$/;
const encode=(value:unknown)=>JSON.stringify(value)+'\n';
const digest=(body:Doc)=>createHash('sha256').update(encode(body)).digest('hex');
async function atomic(file:string,value:unknown){const temp=file+'.'+randomUUID()+'.tmp',handle=await fs.open(temp,'wx');try{await handle.writeFile(encode(value));await handle.sync();}finally{await handle.close();}await fs.rename(temp,file);}
async function read(file:string){const info=await fs.lstat(file);if(info.isSymbolicLink()||!info.isFile())throw Error('History files must be regular local files.');return fs.readFile(file,'utf8');}
async function optional(file:string){try{return await read(file)}catch(e:any){if(e.code==='ENOENT')return null;throw e;}}
/** Independent history lane. It never occupies Store's urgent protection/commit lane. */
export class HistoryStore {
  private queue:Promise<unknown>=Promise.resolve();
  revision='';
  private root:string;
  constructor(projectRoot:string,private project:()=>Project,private held:()=>boolean){this.root=path.join(projectRoot,'snapshots','history');}
  exclusive<T>(fn:()=>Promise<T>):Promise<T>{const work=this.queue.then(fn);this.queue=work.catch(()=>{});return work;}
  async settled(){await this.queue;}
  async initialize(){try{await this.directory();this.revision=(await optional(path.join(this.root,'generation.json')))||'';}catch{this.revision='unreadable-history';}}
  private async directory(id?:string){if(id&&!idPattern.test(id))throw Error('Invalid History document identity.');const parts=[path.dirname(this.root),this.root,...(id?[path.join(this.root,id)]:[])];for(const part of parts){try{const stat=await fs.lstat(part);if(stat.isSymbolicLink()||!stat.isDirectory())throw Error('History paths must be local project directories.');}catch(e:any){if(e.code!=='ENOENT')throw e;}}return id?path.join(this.root,id):this.root;}
  private async touch(){if(!this.held())throw Error('Project is closed.');const root=await this.directory();await fs.mkdir(root,{recursive:true});const token=randomUUID();await atomic(path.join(root,'generation.json'),token);this.revision=encode(token);}
  private async settings(){const root=await this.directory(),raw=await optional(path.join(root,'settings.json'));if(!raw)return {retention:30 as HistoryRetention,warning:''};try{const v=JSON.parse(raw);if(v.schema!==1||![0,10,30,100].includes(v.retention))throw Error();return {retention:v.retention as HistoryRetention,warning:''};}catch{return {retention:0 as HistoryRetention,warning:'History settings are damaged; automatic capture is paused until you select a retention setting. Original evidence preserved.'};}}
  configure(retention:HistoryRetention){return this.exclusive(async()=>{if(![0,10,30,100].includes(retention))throw Error('Invalid History retention.');await this.touch();await atomic(path.join(this.root,'settings.json'),{schema:1,retention});});}
  list(id:string){return this.exclusive(()=>this.listNow(id));}
  private async listNow(id:string):Promise<HistoryList>{historyDocument(this.project(),id);const dir=await this.directory(id),settings=await this.settings(),result:HistoryList={entries:[],warnings:settings.warning?[settings.warning]:[],retention:settings.retention};let names:string[];try{names=await fs.readdir(dir);}catch(e:any){if(e.code==='ENOENT')return result;throw e;}
    for(const name of names){if(!name.endsWith('.meta.json')){if(name.endsWith('.tmp'))result.warnings.push('An interrupted History write was preserved.');continue;}const version=name.slice(0,-10);try{if(!idPattern.test(version))throw Error('Invalid version filename');const meta=JSON.parse((await read(path.join(dir,name))));this.validateMeta(meta,id,version);result.entries.push(meta);}catch{result.warnings.push('Damaged History metadata preserved: '+name);}}
    result.entries.sort((a,b)=>b.capturedAt.localeCompare(a.capturedAt)||b.id.localeCompare(a.id));return result;
  }
  private validateMeta(m:HistoryMeta,id:string,version:string){if(m.schema!==1||m.id!==version||m.documentId!==id||!idPattern.test(version)||!['manual','automatic'].includes(m.kind)||!['Chapter','Scene'].includes(m.documentKind)||!Number.isFinite(Date.parse(m.capturedAt))||!Number.isSafeInteger(m.wordCount)||m.wordCount<0||! /^[a-f0-9]{64}$/.test(m.hash)||typeof m.title!=='string'||typeof m.label!=='string'||typeof m.note!=='string')throw Error('Unsupported or damaged History metadata.');}
  read(id:string,version:string){return this.exclusive(()=>this.readNow(id,version));}
  private async readNow(id:string,version:string){historyDocument(this.project(),id);if(!idPattern.test(version))throw Error('Invalid version identity.');const dir=await this.directory(id);const meta:HistoryMeta=JSON.parse(await read(path.join(dir,version+'.meta.json')));this.validateMeta(meta,id,version);const record=JSON.parse(await read(path.join(dir,version+'.body.json')));if(record.schema!==1||record.documentId!==id||record.id!==version||digest(record.body)!==meta.hash)throw Error('History integrity check failed. Current manuscript is unchanged; files preserved.');historyDocument(this.project(),id,record.body);return {meta,body:record.body as Doc};}
  capture(id:string,body:Doc,kind:'manual'|'automatic'='manual',label='',note='',now=Date.now(),title?:string){const copy=structuredClone(body);return this.exclusive(()=>this.captureNow(id,copy,kind,label,note,now,title));}
  private async captureNow(id:string,body:Doc,kind:'manual'|'automatic',label:string,note:string,now:number,title?:string){const node=historyDocument(this.project(),id,body);if((title!==undefined&&typeof title!=='string')||typeof label!=='string'||typeof note!=='string'||!['manual','automatic'].includes(kind))throw Error('Invalid snapshot metadata.');const list=await this.listNow(id),hash=digest(body);if(kind==='automatic'){if(!list.retention)return null;const raw=await optional(path.join(await this.directory(id),'automatic.json'));let latest=list.entries.find(e=>e.kind==='automatic') as {capturedAt:string;hash:string}|undefined;
      if(raw){try{const clock=JSON.parse(raw);if(clock.schema!==1||!Number.isFinite(Date.parse(clock.capturedAt))||! /^[a-f0-9]{64}$/.test(clock.hash))throw Error();latest=clock;}catch{throw Error('Automatic History cadence evidence is damaged. Preserved; automatic capture paused.');}}
      if(latest&&(now-Date.parse(latest.capturedAt)<HISTORY_INTERVAL||latest.hash===hash))return null;}
    await this.touch();const dir=await this.directory(id);await fs.mkdir(dir,{recursive:true});const version=randomUUID();const meta:HistoryMeta={schema:1,id:version,documentId:id,kind,capturedAt:new Date(now).toISOString(),title:title??node.title,documentKind:node.kind as 'Chapter'|'Scene',wordCount:words(body),hash,label,note};
    await atomic(path.join(dir,version+'.body.json'),{schema:1,id:version,documentId:id,body});await atomic(path.join(dir,version+'.meta.json'),meta);
    // Publish metadata last: an interrupted body is never a successful list entry.
    if(kind==='automatic'){await atomic(path.join(dir,'automatic.json'),{schema:1,capturedAt:meta.capturedAt,hash});const automatic=[meta,...list.entries.filter(e=>e.kind==='automatic')];for(const old of automatic.slice(list.retention)){await fs.unlink(path.join(dir,old.id+'.meta.json'));await fs.unlink(path.join(dir,old.id+'.body.json'));}}
    return meta;
  }
  edit(id:string,version:string,label:string,note:string,promote=false){return this.exclusive(async()=>{const record=await this.readNow(id,version);if(typeof label!=='string'||typeof note!=='string')throw Error('Invalid label or note.');await this.touch();await atomic(path.join(await this.directory(id),version+'.meta.json'),{...record.meta,label,note,kind:promote?'manual':record.meta.kind});});}
  remove(id:string,version:string){return this.exclusive(async()=>{await this.readNow(id,version);await this.touch();const dir=await this.directory(id);await fs.unlink(path.join(dir,version+'.meta.json'));await fs.unlink(path.join(dir,version+'.body.json'));});}
  prepareRestore(id:string,version:string,current:Doc){const copy=structuredClone(current);return this.exclusive(async()=>{const record=await this.readNow(id,version);validateReferenceReplacement(this.project(),id,record.body);const safety=await this.captureNow(id,copy,'manual','Before restore — '+new Date().toLocaleString(),'',Date.now());return {body:record.body,safety:safety!};});}
  cleanup(ids:string[],remaining:Project){return this.exclusive(async()=>{for(const id of ids){if(remaining.documents[id])throw Error('Cannot remove History for a current document.');const dir=await this.directory(id);await fs.rm(dir,{recursive:true,force:true});}});}
}
