import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {builtInProjectTemplates} from '../shared/builtInProjectTemplates.js';
import {extractTemplate,type ProjectTemplate,type TemplateSelection} from '../shared/projectTemplates.js';
import {bounded,object,requireTemplate,text,TemplateError} from '../shared/templateSafety.js';
import type {Project} from '../shared/model.js';
import type {TemplateCard,TemplateCatalog,TemplateReply,TemplateRequest,TemplateTarget,TemplateReview} from '../shared/templateWorkflow.js';
import {ProjectTemplateServices} from './projectTemplateServices.js';
import {SettingsStore} from './settings.js';
import {fileError} from './templateFiles.js';

export type TemplatePorts={project:()=>Project|null;directory:(initial:string)=>Promise<string|null>;importFile:(initial:string)=>Promise<string|null>;exportFile:(initial:string)=>Promise<string|null>;openFolder:(folder:string)=>Promise<void>;create:(template:ProjectTemplate,name:string,parent:string)=>Promise<unknown>};
type Receipt={at:number;path?:string;template?:ProjectTemplate;sourceRevision?:string;projectId?:string;projectRevision?:number;target?:TemplateTarget;conflicts?:TemplateTarget[];permanent?:TemplateTarget};
export const templateCard=(t:ProjectTemplate,revision='',builtIn=false):TemplateCard=>({id:t.templateId,revision,builtIn,name:t.name,creator:t.creator,description:t.description||'',createdWith:t.createdWithPageHearthVersion,minimumVersion:t.minimumPageHearthVersion,nodes:t.blueprint.nodes.map(n=>({...n})),notes:t.blueprint.notebook.notes.map(n=>n.title),schemas:t.blueprint.schemas.fields.length+t.blueprint.schemas.categories.length+t.blueprint.schemas.sheets.length+t.blueprint.schemas.relationships.length+t.blueprint.schemas.manuscriptFields.length});
/** Main-owned dialog/review receipts. Renderer cannot choose arbitrary disk paths or
 * submit an unreviewed blueprint. Main IPC serializes requests; receipts expire. */
export class TemplateWorkflow{
 private receipts=new Map<string,Receipt>();
 constructor(readonly services:ProjectTemplateServices,private settings:SettingsStore,private ports:TemplatePorts){}
 private put(value:Omit<Receipt,'at'>){const token=randomUUID();this.receipts.set(token,{...value,at:Date.now()});while(this.receipts.size>24)this.receipts.delete(this.receipts.keys().next().value!);return token;}
 private receipt(token:unknown){text(token,'token',100);const r=this.receipts.get(token);requireTemplate(r&&Date.now()-r.at<30*60*1000,'STALE','This review expired. Open it again.');return r;}
 private target(value:unknown):TemplateTarget{object(value,['id','revision'],'target');const t=value as TemplateTarget;text(t.id,'id',100);text(t.revision,'revision',100,true);return t;}
 private metadata(value:any){object(value,['name','creator','description'],'metadata');text(value.name,'name',120);text(value.creator,'creator',200);text(value.description,'description',4000,true);return {name:value.name.trim(),creator:value.creator.trim(),description:value.description};}
 private async custom(){
  const listing=await this.services.templates.enumerate(),ids=new Map<string,number>(),names=new Map<string,number>(),issues=listing.issues.map(e=>path.basename(e.file)+': '+e.message);
  for(const e of listing.entries){ids.set(e.preview.templateId,(ids.get(e.preview.templateId)||0)+1);const n=e.preview.name.toLowerCase();names.set(n,(names.get(n)||0)+1);}
  const built=new Set(builtInProjectTemplates().map(t=>t.templateId)),cards:TemplateCard[]=[],files:Record<string,string>={};
  for(const e of listing.entries){
   if(built.has(e.preview.templateId)){issues.push(path.basename(e.file)+': Reserved built-in identity; custom file was not selected.');continue;}
   if(ids.get(e.preview.templateId)!==1||names.get(e.preview.name.toLowerCase())!==1)continue;
   try{const t=await this.services.templates.inspect(e.file);requireTemplate(t.revision===e.revision,'STALE','File changed while listing. Refresh the library.');cards.push(templateCard(t.template,t.revision));files[path.basename(e.file).toLowerCase()]=t.template.templateId;}
   catch(error){issues.push(path.basename(e.file)+': '+fileError(error).message);}
  }
  return {cards,issues,files};
 }
 private async resolve(target:TemplateTarget){const builtin=builtInProjectTemplates().find(t=>t.templateId===target.id);if(builtin){requireTemplate(target.revision==='','STALE','Refresh the built-in selection.');return builtin;}const value=await this.services.templates.read(target.id);requireTemplate(value.revision===target.revision,'STALE','Template changed. Refresh and review it again.');return value.template;}
 private async review(template:ProjectTemplate,data:Omit<Receipt,'at'|'template'>,warnings:string[]=[]):Promise<TemplateReview>{const library=await this.custom(),conflicts=library.cards.filter(c=>c.id===template.templateId||c.name.toLowerCase()===template.name.toLowerCase()||c.id===library.files[(template.name+'.pagehearth-template').toLowerCase()]);return {token:this.put({...data,template,conflicts:conflicts.map(c=>({id:c.id,revision:c.revision}))}),card:templateCard(template),warnings,conflicts,target:data.target};}
 async request(raw:unknown):Promise<TemplateReply>{try{bounded(raw);const r=raw as TemplateRequest;requireTemplate(r&&typeof r.kind==='string','REQUEST','Unknown template action.');const keys:Record<string,string[]>={catalog:[],location:[],'import-preview':[],'open-folder':[],create:['source','location','name'],review:['metadata','selection','target'],install:['token','mode','name','target'],metadata:['target','metadata'],export:['target'],delete:['target','permanentToken']};requireTemplate(keys[r.kind],'REQUEST','Unknown template action.');object(r,['kind',...keys[r.kind]],'request');return {ok:true,value:await this.run(r)};}catch(error){const e=error instanceof TemplateError?error:fileError(error);return {ok:false,error:{code:e.code,message:e.message,field:e.field||''}};}}
 private async run(r:TemplateRequest):Promise<unknown>{
  if(r.kind==='catalog'){
   let custom:{cards:TemplateCard[];issues:string[]};try{custom=await this.custom();}catch(e){custom={cards:[],issues:[fileError(e).message]};}
   const parent=(await this.services.browse('create'))||this.services.paths.projects,p=this.ports.project(),folders=p?.author.notebook.folders||[];
   const folderName=(id:string|null):string|null=>{const titles:string[]=[],seen=new Set<string>();while(id){const f=folders.find(f=>f.id===id);if(!f||f.trashed||f.system==='quicknotes'||seen.has(id))return null;seen.add(id);titles.unshift(f.title);id=f.parent;}return titles.join(' / ')||'Unfiled';};
   const starters=(p?.author.notebook.notes||[]).filter(n=>!n.trashed&&folderName(n.folder)!==null).map(n=>({id:n.id,title:n.title,folder:folderName(n.folder)!}));
   return {builtIns:builtInProjectTemplates().map(t=>templateCard(t,'',true)),custom:custom.cards,issues:custom.issues,location:{token:this.put({path:parent}),path:parent},creator:this.settings.value.lastTemplateCreator||'',projectTitle:p?.manifest.title||null,starters} satisfies TemplateCatalog;
  }
  if(r.kind==='location'){const folder=await this.ports.directory((await this.services.browse('create'))||this.services.paths.projects);if(!folder)return null;await this.settings.update({lastCreateDirectory:folder});return {token:this.put({path:folder}),path:folder};}
  if(r.kind==='create'){text(r.name,'name',120);const receipt=this.receipt(r.location);requireTemplate(receipt.path&&!receipt.template&&!receipt.permanent,'PATH','Choose a project parent location.');return this.ports.create(await this.resolve(this.target(r.source)),r.name.trim(),receipt.path);}
  if(r.kind==='review'){
   const p=this.ports.project();requireTemplate(p,'PROJECT','Open a project first.');const metadata=this.metadata(r.metadata),s=r.selection;
   object(s,['manuscript','sceneConfiguration','schemas','notebookFolders','researchFolders','starterNoteIds'],'selection');for(const k of ['manuscript','sceneConfiguration','schemas','notebookFolders','researchFolders'] as const)requireTemplate(typeof s[k]==='boolean','SELECTION','Choose the structures to include.');requireTemplate(Array.isArray(s.starterNoteIds)&&s.starterNoteIds.length<=2000&&s.starterNoteIds.every(id=>typeof id==='string'),'SELECTION','Choose valid starter pages.');
   const target=r.target?this.target(r.target):undefined;if(target){const found=await this.services.templates.read(target.id);requireTemplate(found.revision===target.revision,'STALE','Template changed. Review it again.');}
   const result=extractTemplate(p,metadata,s as TemplateSelection);return this.review(result.template,{projectId:p.manifest.id,projectRevision:p.manifest.revision,target},result.warnings.map(w=>w.message));
  }
  if(r.kind==='import-preview'){const file=await this.ports.importFile((await this.services.browse('templateImport'))||this.services.paths.root);if(!file)return null;await this.services.rememberBrowse('templateImport',path.dirname(file));const v=await this.services.templates.inspect(file);return this.review(v.template,{path:file,sourceRevision:v.revision});}
  if(r.kind==='install'){
   requireTemplate(['new','copy','replace'].includes(r.mode),'REQUEST','Choose a save action.');const receipt=this.receipt(r.token);requireTemplate(receipt.template,'STALE','Open a template review first.');
   if(receipt.projectId){const p=this.ports.project();requireTemplate(p?.manifest.id===receipt.projectId&&p.manifest.revision===receipt.projectRevision,'STALE','Project changed after review. Review the template again.');}
   if(receipt.path){const source=await this.services.templates.inspect(receipt.path);requireTemplate(source.revision===receipt.sourceRevision,'STALE','Import file changed after preview. Choose it again.');}
   let t=structuredClone(receipt.template),result;
   if(r.mode==='replace'){const target=this.target(r.target);requireTemplate([...(receipt.conflicts||[]),...(receipt.target?[receipt.target]:[])].some(t=>t.id===target.id&&t.revision===target.revision),'TARGET','Select the reviewed replacement target.');result=await this.services.templates.replace(target.id,target.revision,t);}
   else {requireTemplate(!receipt.target||r.mode==='copy','TARGET','Confirm replacement or choose a new copy.');if(r.mode==='copy'){text(r.name,'name',120);t={...t,templateId:randomUUID(),name:r.name.trim()};}result=await this.services.templates.save(t);}
   this.receipts.delete(r.token);let warning:string|undefined;if(receipt.projectId)try{await this.settings.update({lastTemplateCreator:t.creator});}catch{warning='Template saved, but the Creator preference could not be remembered.';}return {...templateCard(result.template,result.revision),...(warning?{warning}:{})};
  }
  if(r.kind==='metadata'){const t=this.target(r.target),result=await this.services.templates.update(t.id,t.revision,this.metadata(r.metadata));return templateCard(result.template,result.revision);}
  if(r.kind==='export'){const t=this.target(r.target),v=await this.services.templates.read(t.id);requireTemplate(v.revision===t.revision,'STALE','Template changed. Refresh first.');const file=await this.ports.exportFile(path.join((await this.services.browse('templateExport'))||this.services.paths.templates,v.template.name+'.pagehearth-template'));if(!file)return null;await this.services.templates.export(t.id,t.revision,file);await this.services.rememberBrowse('templateExport',path.dirname(file));return {path:file};}
  if(r.kind==='delete'){const t=this.target(r.target);if(r.permanentToken){const receipt=this.receipt(r.permanentToken);requireTemplate(receipt.permanent?.id===t.id&&receipt.permanent.revision===t.revision,'TARGET','Confirm the failed Recycle Bin operation first.');const result=await this.services.templates.delete(t.id,t.revision,true);this.receipts.delete(r.permanentToken);return result;}const result=await this.services.templates.delete(t.id,t.revision);return result.deleted?result:{...result,token:this.put({permanent:t})};}
  if(r.kind==='open-folder'){await this.services.browse('templateExport');await this.ports.openFolder(this.services.paths.templates);return null;}
 }
}
