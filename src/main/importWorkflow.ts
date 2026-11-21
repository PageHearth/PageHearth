import {promises as fs} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import {canonicalImportDocument} from './importSchema.js';
import {createInitialProject,type CreationHooks} from './templateCreation.js';
import {digest,ordinaryDirectory} from './templateFiles.js';
import {IMPORT_LIMITS} from './importPackage.js';
import {mapImport,initialImportMapping,importStrategies,importedProject,type ImportAnalysis,type ImportMapping,type ImportPreview,type ImportReply,type ImportRequest} from '../shared/manuscriptImport.js';
import {visibleText} from '../shared/textAnalysis.js';
import type {ProjectTemplateServices} from './projectTemplateServices.js';
import {bounded} from '../shared/templateSafety.js';
type Session={file:string;at:number;worker?:Worker;analysis?:ImportAnalysis;error?:string;encoding?:string;creating?:boolean};
export type ImportPorts={choose:(initial:string)=>Promise<string|null>;directory:(initial:string)=>Promise<string|null>;create:(run:(hooks:CreationHooks)=>Promise<any>)=>Promise<unknown>;report:()=>Promise<unknown>;version:string};
export class ImportWorkflow{
 private sessions=new Map<string,Session>();private locations=new Map<string,string>();
 constructor(private services:ProjectTemplateServices,private ports:ImportPorts){}
 private session(token:string){const s=this.sessions.get(token);if(!s||Date.now()-s.at>30*60*1000)throw Error('Import review expired. Choose the source again.');return s;}
 async request(raw:ImportRequest):Promise<ImportReply>{try{bounded(raw);return {ok:true,value:await this.run(raw)};}catch(error){return {ok:false,error:{code:'IMPORT',severity:'BLOCKING',message:(error as Error).message}};}}
 private async source(file:string){const s=await fs.lstat(file);if(!s.isFile()||s.isSymbolicLink()||s.size>IMPORT_LIMITS.source)throw Error('Choose a regular source file up to 64 MiB.');const h=await fs.open(file,'r');try{const opened=await h.stat();if(opened.ino!==s.ino||opened.size!==s.size)throw Error('Source changed while opening.');const bytes=Buffer.alloc(s.size+1);let at=0;while(at<bytes.length){const r=await h.read(bytes,at,bytes.length-at,null);if(!r.bytesRead)break;at+=r.bytesRead;}const after=await h.stat();if(at!==s.size||after.mtimeMs!==s.mtimeMs)throw Error('Source changed during reading.');return {bytes:bytes.subarray(0,at),mtime:s.mtime.toISOString()};}finally{await h.close();}}
 private async start(s:Session){await s.worker?.terminate();s.analysis=undefined;s.error=undefined;const source=await this.source(s.file);const worker=new Worker(new URL('./importWorker.js',import.meta.url),{workerData:{...source,filename:path.basename(s.file),encoding:s.encoding},resourceLimits:{maxOldGenerationSizeMb:384}});s.worker=worker;const timer=setTimeout(()=>{s.error='Analysis exceeded its two-minute safety limit.';void worker.terminate();},120000);worker.once('message',value=>{if(s.worker===worker){s.analysis=value.value;s.error=value.error;}clearTimeout(timer);void worker.terminate();});worker.once('error',e=>{if(s.worker!==worker)return;s.error='Analysis stopped safely: '+e.message;clearTimeout(timer);});worker.once('exit',code=>{clearTimeout(timer);if(s.worker===worker&&code&&!s.analysis&&!s.error)s.error='Analysis stopped before completion.';});}
 preview(token:string,mapping:ImportMapping,page=0,sample?:string):ImportPreview{const a=this.session(token).analysis;if(!a)throw Error('Analysis is not ready.');const sections=mapImport(a,mapping),included=sections.filter(s=>s.included),offset=Math.max(0,Math.floor(page))*50;return {token,source:a.source,encoding:a.encoding,quality:a.quality,strategies:importStrategies(a),mapping,sections:sections.slice(offset,offset+50).map(({body,...s})=>s),totalSections:sections.length,page,words:included.reduce((n,s)=>n+s.words,0),chapters:included.filter(s=>s.kind==='Chapter').length,scenes:included.filter(s=>s.kind==='Scene').length,sourceWords:a.sourceWords,diagnostics:a.diagnostics,sample:visibleText((sections.find(s=>s.key===sample)||sections[offset]||sections[0]).body).slice(0,6000)};}
 private async run(r:ImportRequest):Promise<unknown>{
  if(r.kind==='report')return checkedImportReport(await this.ports.report());
  if(r.kind==='location'||r.kind==='default-location'){const initial=(await this.services.browse('create'))||this.services.paths.projects;const folder=r.kind==='default-location'?initial:await this.ports.directory(initial);if(!folder)return null;await ordinaryDirectory(folder);const token=randomUUID();this.locations.set(token,folder);while(this.locations.size>12)this.locations.delete(this.locations.keys().next().value!);return {token,path:folder};}
  if(r.kind==='choose'){const file=await this.ports.choose((await this.services.browse('manuscriptImport'))||this.services.paths.root);if(!file)return null;await this.services.rememberBrowse('manuscriptImport',path.dirname(file));for(const s of this.sessions.values())if(!s.creating)await s.worker?.terminate();this.sessions.clear();const token=randomUUID(),s:Session={file,at:Date.now()};this.sessions.set(token,s);await this.start(s);return {token};}
  const s=this.session(r.token);if(s.creating)throw Error('Project creation is already in progress.');
  if(r.kind==='cancel'){await s.worker?.terminate();this.sessions.delete(r.token);return null;}
  if(r.kind==='encoding'){if(!['windows-1252','utf-8'].includes(r.encoding))throw Error('Unsupported text decoding.');s.encoding=r.encoding;await this.start(s);return null;}
  if(r.kind==='poll')return s.error?{stage:'error',message:s.error,encoding:s.error.startsWith('ENCODING:')}:s.analysis?{stage:'ready',preview:this.preview(r.token,initialImportMapping())}:{stage:'analyzing'};
  if(r.kind==='preview')return this.preview(r.token,r.mapping,r.page,r.sample);
  if(r.kind!=='create')throw Error('Unknown import action.');const a=s.analysis,parent=this.locations.get(r.location);if(!a||!parent)throw Error('Analyze a source and choose a project parent first.');if(a.diagnostics.some(d=>d.severity==='BLOCKING')||a.diagnostics.some(d=>d.severity==='WARNING')&&!r.acknowledged)throw Error('Review and acknowledge the import limitations.');
  const source=await this.source(s.file);if(digest(source.bytes)!==a.source.digest)throw Error('Source bytes changed after analysis. Choose the source again.');
  const made=importedProject(a,r.mapping,r.name.trim(),randomUUID);
  for(const [id,body] of Object.entries(made.project.documents))made.project.documents[id]=canonicalImportDocument(body);
  const filename=a.source.filename.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'');if(!filename||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(filename))throw Error('Source filename is not safe for project storage.');const copyPath='imports/original/'+filename;
  const report={version:1,records:[{source:a.source,importedAt:new Date().toISOString(),appVersion:this.ports.version,parsers:a.parsers,encoding:a.encoding,mapping:r.mapping,documents:made.project.manifest.nodes,sourceWords:a.sourceWords,convertedWords:made.sections.reduce((n,v)=>n+v.words,0),countingBasis:a.countingBasis,sections:mapImport(a,r.mapping).map(({body,...v})=>v),diagnostics:a.diagnostics,acknowledged:r.acknowledged,original:{kept:r.keepSource,path:r.keepSource?copyPath:null}}]},json=JSON.stringify(report,null,2);
  s.creating=true;try{const result=await this.ports.create(hooks=>createInitialProject(made,r.name.trim(),parent,hooks,{write:async root=>{await fs.mkdir(path.join(root,'imports','original'),{recursive:true});if(r.keepSource){const h=await fs.open(path.join(root,copyPath),'wx');try{await h.writeFile(source.bytes);await h.sync();}finally{await h.close();}}const h=await fs.open(path.join(root,'imports/import-report.json'),'wx');try{await h.writeFile(json);await h.sync();}finally{await h.close();}},verify:async root=>{if(digest((await this.source(s.file)).bytes)!==a.source.digest)throw Error('Source changed during creation. Reanalyze before importing.');if(await fs.readFile(path.join(root,'imports/import-report.json'),'utf8')!==json)throw Error('Import report failed readback.');if(r.keepSource&&digest(await fs.readFile(path.join(root,copyPath)))!==a.source.digest)throw Error('Original-source copy failed readback.');}}));this.sessions.delete(r.token);return result;}finally{s.creating=false;}
 }
}

/** Guard the read-only viewer against damaged or unsupported project-local evidence. */
export function checkedImportReport(value:unknown):unknown {
 const r=value as any;const fail=()=>{throw Error('Import Report is damaged or uses an unsupported version. The manuscript is unchanged.');};
 if(!r||r.version!==1||!Array.isArray(r.records)||!r.records.length||r.records.length>1000)fail();
 for(const entry of r.records){if(!entry||typeof entry.source?.filename!=='string'||typeof entry.source?.format!=='string'||!Number.isFinite(entry.source?.bytes)||typeof entry.importedAt!=='string'||!Number.isFinite(entry.convertedWords)||typeof entry.original?.kept!=='boolean'||(entry.original.kept&&typeof entry.original.path!=='string')||!Array.isArray(entry.diagnostics))fail();for(const d of entry.diagnostics)if(!d||!['INFO','WARNING','BLOCKING'].includes(d.severity)||typeof d.message!=='string')fail();}
 return value;
}
