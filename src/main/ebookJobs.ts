import {isExportStage,type ExportStage} from '../shared/exportProgress.js';
import {Worker} from 'node:worker_threads';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {compilePublication,type PublicationDocument} from '../shared/publicationCompiler.js';
import type {Project} from '../shared/model.js';
import type {EbookProof,EbookPreviewResult} from '../shared/ebookProduction.js';
/** One job at a time; preview is display-only, export retains full validation. */
export class EbookJobs{
 private active?:{id:string;worker:Worker;preview:boolean};
 private generation=0;private request?:string;private running:Promise<unknown>=Promise.resolve();private artifact?:string;
 private cleanup:Promise<void>=Promise.resolve();
 constructor(private resources:string,private temporary:string){}
 cancel(id?:string){if(id&&id!==this.request)return this.cleanup;this.generation++;if(this.active){if(this.active.preview)void this.active.worker.terminate();else this.active.worker.postMessage('cancel');}const file=this.artifact;this.artifact=undefined;const running=this.running;this.cleanup=this.cleanup.catch(()=>{}).then(async()=>{await running.catch(()=>{});if(file)await this.discard(file);});void this.cleanup.catch(()=>console.warn('Publication temporary cleanup needs attention; retry at next startup.'));return this.cleanup;}
 async dispose(){await this.cancel();}
 render(project:Project,root:string,id:string,compiled?:PublicationDocument,onProgress?:(stage:ExportStage)=>void):Promise<EbookProof>{return this.run(project,root,id,false,compiled,onProgress) as Promise<EbookProof>;}
 preview(project:Project,root:string,id:string,compiled?:PublicationDocument):Promise<EbookPreviewResult>{return this.run(project,root,id,true,compiled) as Promise<EbookPreviewResult>;}
 private run(project:Project,root:string,id:string,preview:boolean,compiled?:PublicationDocument,onProgress?:(stage:ExportStage)=>void):Promise<EbookProof|EbookPreviewResult>{
  const previous=this.cancel();this.request=id;const own=this.generation;
  const task=(async()=>{await previous.catch(()=>{});if(own!==this.generation)throw Error('eBook render superseded.');
   if(!preview&&this.artifact){const old=this.artifact;this.artifact=undefined;await this.discard(old);}if(own!==this.generation)throw Error('eBook render superseded.');
   const compileStart=performance.now(),document=compiled??compilePublication(project,'ebook'),compileMs=performance.now()-compileStart,started=performance.now();
   return new Promise<EbookProof|EbookPreviewResult>((resolve,reject)=>{const worker=new Worker(new URL('./ebookWorker.js',import.meta.url),{workerData:{document,root,resources:this.resources,temporary:this.temporary,preview},execArgv:[]});this.active={id,worker,preview};let result:EbookProof|EbookPreviewResult|undefined,error:Error|undefined,temporary:string|undefined;
    worker.on('message',m=>{if(typeof m.temporary==='string'){temporary=m.temporary;return;}if(isExportStage(m.stage)){if(own===this.generation)onProgress?.(m.stage);return;}if(m.error)error=Error(m.error);else result=m.result;});worker.on('error',e=>{error=e;});worker.on('exit',async code=>{if(this.active?.worker===worker)this.active=undefined;try{if(temporary&&(error||code||!result))await this.discard(path.join(temporary,'book.epub'));if(own!==this.generation){if(result&&'artifactPath'in result)await this.discard(result.artifactPath);reject(Error('eBook render canceled or superseded.'));}else if(error)reject(error);else if(code||!result)reject(Error('eBook worker stopped unexpectedly.'));else{if('artifactPath'in result)this.artifact=result.artifactPath;result.timings.compileMs=compileMs;result.timings.workerRoundTripMs=performance.now()-started;resolve(result);}}catch(e){reject(e);}});
   });})();this.running=task;return task;
 }
 private async discard(file:string){const dir=path.dirname(path.resolve(file));if(path.dirname(dir)!==path.resolve(this.temporary)||!path.basename(dir).startsWith('book-'))throw Error('Unsafe temporary artifact path.');await fs.rm(dir,{recursive:true,force:true});}
}
