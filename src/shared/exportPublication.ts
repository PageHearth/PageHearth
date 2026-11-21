import type {Project} from './model.js';
import {bodySources} from './publication.js';
import {compilePublication,type PublicationDocument,type PreflightIssue} from './publicationCompiler.js';

export const exportFormats={pdf:'Print Book · PDF',epub:'eBook · EPUB',docx:'Editable Document · DOCX',html:'Web Page · HTML',md:'Markdown · MD',txt:'Plain Text · TXT'} as const;
export type ExportFormat=keyof typeof exportFormats;
export type ExportOptions={format:ExportFormat;scope:'all'|'selected'|'collection';ids:string[];collectionId?:string;front:boolean;back:boolean;titlePage:boolean};
export const defaultExportOptions=():ExportOptions=>({format:'pdf',scope:'all',ids:[],front:true,back:true,titlePage:true});
export type ExportReceipt={id:string;format:ExportFormat;filename:string;bytes:number;issues:PreflightIssue[];notes:string[];sections:number};
export function validateExportOptions(v:unknown):asserts v is ExportOptions{
 const x=v as ExportOptions;if(!x||!Object.hasOwn(exportFormats,x.format)||!['all','selected','collection'].includes(x.scope)||!Array.isArray(x.ids)||x.ids.length>10000||x.ids.some(i=>typeof i!=='string'||i.length>80)||['front','back','titlePage'].some(k=>typeof x[k as keyof ExportOptions]!=='boolean')||(x.collectionId!==undefined&&typeof x.collectionId!=='string'))throw Error('Invalid export choices.');
}
export function exportName(title:string,format:ExportFormat){
 let name=title.replace(/[<>:"/\\|?*\x00-\x1f]/g,' ').replace(/\s+/g,' ').trim().replace(/[. ]+$/g,'').replace(/\.(pdf|epub|docx|html?|md|markdown|txt)$/i,'').slice(0,120).replace(/[. ]+$/g,'')||'Book';
 if(/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name))name='Book '+name;return name+'.'+format;
}
/** Export choices project the immutable compilation; never edit publication inclusion or prose. */
export function exportDocument(project:Project,options:ExportOptions):PublicationDocument{
 validateExportOptions(options);const target=options.format==='pdf'?'print':options.format==='epub'?'ebook':options.format==='docx'?'editorial':'genericText';
 const original=compilePublication(project,target);const d=structuredClone(original) as any;
 const sources=bodySources(project),byId=new Map(sources.map(n=>[n.id,n]));let selected=new Set<string>();
 if(options.scope!=='all'){
  let ids=options.ids;
  if(options.scope==='collection'){const c=project.author.collections?.items.find(c=>c.id===options.collectionId&&!c.trashed);if(!c)throw Error('Choose an active Collection.');ids=c.members.filter(m=>m.type==='document').map(m=>m.id);}
  if(!ids.length||ids.some(id=>!byId.has(id)))throw Error('Choose active manuscript documents for this export.');
  const requested=new Set(ids);
  for(const n of sources){let at:typeof n|undefined=n;while(at){if(requested.has(at.id)){selected.add(n.id);break;}at=at.parent?byId.get(at.parent):undefined;}}
  // Context headings are retained, but unselected ancestor prose is not exported.
  const ancestors=new Set<string>();for(const id of selected){let at=byId.get(id);while(at?.parent){ancestors.add(at.parent);at=byId.get(at.parent);}}
  d.sections=d.sections.filter((s:any)=>s.zone!=='body'||selected.has(s.id)||ancestors.has(s.id)).map((s:any)=>s.zone==='body'&&!selected.has(s.id)?{...s,nodes:[]}:s);
 }
 d.sections=d.sections.filter((s:any)=>(s.zone!=='front'||options.front)&&(s.zone!=='back'||options.back)&&(options.titlePage||s.generator!=='title'));
 const ids=new Set(d.sections.map((s:any)=>s.id));for(const s of d.sections)if(s.navigation)s.navigation=s.navigation.filter((n:any)=>ids.has(n.id));
 if(!d.sections.some((s:any)=>s.zone==='body'&&s.nodes.some(function text(n:any):boolean{return !!n.text?.trim()||!!n.image||!!n.children?.some(text);})))throw Error('This export scope has no included manuscript content.');
 const freeze=(x:any):any=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};return freeze(d);
}

/** A serializer choice is part of request identity even when semantic documents match. */
export function exportPreparationKey(project:Project,options:ExportOptions):string {
 return JSON.stringify({options,document:exportDocument(project,options)});
}
