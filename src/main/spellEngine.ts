import {Worker} from 'node:worker_threads';
import type {SpellEngine} from '../shared/spelling.js';

/** Only the base lexicon is shared. Project vocabulary never enters this worker. */
export class LocalSpellEngine implements SpellEngine{
 private worker:Worker|null=null;private next=0;
 private pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
 async initialize(){if(this.worker)return;const worker=new Worker(new URL('./spellWorker.js',import.meta.url));this.worker=worker;
  worker.on('message',reply=>{const job=this.pending.get(reply.id);if(!job)return;clearTimeout(job.timer);this.pending.delete(reply.id);reply.error?job.reject(Error(reply.error)):job.resolve(reply.result);});
  worker.on('error',error=>this.fail(worker,error));worker.on('exit',()=>this.fail(worker,Error('Spelling service stopped.')));
 }
 private fail(worker:Worker,error:Error){if(this.worker!==worker)return;this.worker=null;for(const job of this.pending.values()){clearTimeout(job.timer);job.reject(error);}this.pending.clear();void worker.terminate();}
 private async request(value:object){await this.initialize();if(this.pending.size>=32)throw Error('Spelling service is busy.');const id=++this.next,worker=this.worker!;
  return new Promise<any>((resolve,reject)=>{const timer=setTimeout(()=>this.fail(worker,Error('Spelling service timed out.')),10000);this.pending.set(id,{resolve,reject,timer});worker.postMessage({id,...value});});
 }
 async check(words:string[]):Promise<boolean[]>{return this.request({words});}
 async suggest(word:string,limit=5):Promise<string[]>{return this.request({word,limit:Math.min(5,Math.max(1,limit))});}
 dispose(){if(this.worker)this.fail(this.worker,Error('Spelling service closed.'));}
}
export function validateSpellRequest(value:unknown):{words:string[]}|{word:string;limit:number}{
 const r=value as {words?:unknown;word?:unknown};
 if(r&&Array.isArray(r.words)&&r.words.length<=4096&&r.words.every(w=>typeof w==='string'&&w.length<=256))return {words:r.words};
 if(r&&typeof r.word==='string'&&r.word.length>0&&r.word.length<=256)return {word:r.word,limit:5};
 throw Error('Invalid spelling request.');
}
