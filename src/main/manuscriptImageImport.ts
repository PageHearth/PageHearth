import {Worker} from 'node:worker_threads';
/** Decode/validate/write off the persistence thread. Existing bytes are never overwritten. */
export function importManuscriptImage(root:string,bytes:Buffer,bitmap?:Buffer,orientation=1):Promise<{sourceAsset?:string;sourceCreated?:boolean;asset:string;created:boolean;width:number;height:number}>{
 return new Promise((resolve,reject)=>{const worker=new Worker(new URL('./manuscriptImageWorker.js',import.meta.url),{workerData:{root,bytes,bitmap,orientation},execArgv:[]});let result:{asset:string;created:boolean;width:number;height:number}|undefined,error:Error|undefined;
 worker.on('message',m=>{if(m.error)error=Error(m.error);else result=m.result;});worker.on('error',e=>{error=e;});worker.on('exit',code=>{if(error)reject(error);else if(code||!result)reject(Error('Project could not import this image.'));else resolve(result);});
 });
}
