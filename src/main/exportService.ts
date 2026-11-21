import type {ExportStage} from '../shared/exportProgress.js';
import {Worker} from 'node:worker_threads';
import {promises as fs} from 'node:fs';
import {randomUUID} from 'node:crypto';
import type {Project} from '../shared/model.js';
import {exportDocument,exportName,type ExportOptions,type ExportReceipt} from '../shared/exportPublication.js';
import type {PublicationDocument} from '../shared/publicationCompiler.js';
import type {PrintProof} from '../shared/printProduction.js';
import type {EbookProof} from '../shared/ebookProduction.js';
import {PrintWorkerRenderer} from './typstPrint.js';
import {EbookJobs} from './ebookJobs.js';
import {byteHash} from './exportFiles.js';
import type {InterchangeResult} from './interchange.js';
export const exportFingerprint=(d:PublicationDocument)=>byteHash(JSON.stringify(d));
type Prepared={receipt:ExportReceipt;documentKey:string;options:ExportOptions;root:string;bytes:Uint8Array;assets:Record<string,Uint8Array>;controller:AbortController};
/** Disposable export artifacts. No canonical writes, History entries or persistence queue work. */
export class ExportService{
 private generation=0;private active?:AbortController;private request?:string;prepared?:Prepared;
 constructor(private print:PrintWorkerRenderer,private ebooks:EbookJobs){}
 cancel(id?:string){if(id&&id!==this.request&&id!==this.prepared?.receipt.id)return;this.generation++;this.active?.abort();this.ebooks.cancel();this.prepared=undefined;}
 async dispose(){this.cancel();await this.ebooks.dispose();}
 async prepare(project:Project,root:string,options:ExportOptions,request:string,currentPrint?:PrintProof,currentEbook?:{documentKey:string;proof:EbookProof},onProgress?:(stage:ExportStage)=>void):Promise<ExportReceipt>{
  this.cancel();const gen=this.generation,controller=new AbortController();this.active=controller;this.request=request;
  const progress=(stage:ExportStage)=>{if(gen===this.generation&&!controller.signal.aborted)onProgress?.(stage);};progress('preparing');
  const document=exportDocument(project,options),documentKey=exportFingerprint(document);let result:InterchangeResult;
  if(options.format==='pdf'){
   progress(currentPrint?.fingerprint===documentKey?'pdf-ready':'pdf-render');
   const proof=currentPrint?.fingerprint===documentKey?currentPrint:await this.print.render(document,{root},controller.signal);
   if(byteHash(proof.pdf)!==proof.sha256||Buffer.from(proof.pdf).subarray(0,5).toString()!=='%PDF-')throw Error('PDF verification failed.');
   result={bytes:proof.pdf,assets:{},issues:proof.diagnostics,notes:['Exact verified Typst proof bytes. Not printer certification.']};
  }else if(options.format==='epub'){
   progress(currentEbook?.documentKey===documentKey?'preparing':'epub-build');
   const proof=currentEbook?.documentKey===documentKey?currentEbook.proof:await this.ebooks.render(project,root,request,document,progress);
   const bytes=await fs.readFile(proof.artifactPath);if(byteHash(bytes)!==proof.sha256)throw Error('EPUB artifact changed.');await this.ebooks.dispose();
   const issues=[...proof.issues];if(proof.validation.length!==2||proof.validation.some(v=>v.status!=='pass'))issues.push({code:'epub-validation',message:'EPUB validation must pass before saving.',blocking:true,severity:'error',target:'ebook',profile:'generic',fix:'Review eBook validation details.'});
   result={bytes,assets:{},issues,notes:['EPUB 3.3; validated by bundled EPUBCheck 5.3.0 and 5.4.0. Reader appearance may vary.']};
  }else result=await new Promise<InterchangeResult>((resolve,reject)=>{
   progress(options.format==='docx'?'docx-build':'serialize');
   const worker=new Worker(new URL('./interchangeWorker.js',import.meta.url),{workerData:{document,format:options.format,root},execArgv:[]});let value:InterchangeResult|undefined,error:Error|undefined;
   const abort=()=>void worker.terminate();controller.signal.addEventListener('abort',abort,{once:true});worker.on('message',m=>{if(m.error)error=Error(m.error);else value=m.result;});worker.on('error',e=>error=e);worker.on('exit',code=>{controller.signal.removeEventListener('abort',abort);if(controller.signal.aborted)reject(Error('Export canceled.'));else if(error)reject(error);else if(code||!value)reject(Error('Export worker stopped unexpectedly.'));else resolve(value);});
  });
  if(gen!==this.generation||controller.signal.aborted)throw Error('Export canceled.');
  const receipt:ExportReceipt={id:randomUUID(),format:options.format,filename:exportName(document.metadata.title,options.format),bytes:result.bytes.length,issues:result.issues,notes:result.notes,sections:document.sections.length};
  this.prepared={receipt,documentKey,options:structuredClone(options),root,bytes:result.bytes,assets:result.assets,controller};return receipt;
 }
 current(project:Project,id:string){const p=this.prepared;if(!p||p.receipt.id!==id||p.documentKey!==exportFingerprint(exportDocument(project,p.options))||p.controller.signal.aborted)throw Error('Publication changed. Prepare this export again.');return p;}
}
