import {blank,defaultAuthor,validate,type Doc,type Project} from './model.js';
import {visibleText,wordTokens} from './textAnalysis.js';
export type ImportFormat='docx'|'txt'|'md'|'html'|'epub'|'pdf';
export type ImportDiagnostic={code:string;severity:'INFO'|'WARNING'|'BLOCKING';message:string;location?:string};
export type ImportBlock={id:string;body:Doc;heading?:number;pageBreak?:boolean;separator?:string;spine?:string;label?:string;location:string};
export type ImportAnalysis={version:1;source:{filename:string;format:ImportFormat;bytes:number;mtime:string;digest:string};parsers:Record<string,string>;encoding?:string;quality?:'Good'|'Caution'|'Poor';blocks:ImportBlock[];diagnostics:ImportDiagnostic[];sourceWords:number;countingBasis:string};
export type ImportMapping={chapter:string;scene:string;separator:string;includeEmpty:boolean;excluded:string[];titles:Record<string,string>};
export const initialImportMapping=():ImportMapping=>({chapter:'single',scene:'none',separator:'',includeEmpty:false,excluded:[],titles:{}});
export type ImportSection={key:string;parent:string|null;kind:'Chapter'|'Scene';title:string;body:Doc;words:number;included:boolean;advisory?:string};
export type ImportPreview={token:string;source:ImportAnalysis['source'];encoding?:string;quality?:ImportAnalysis['quality'];strategies:{id:string;label:string}[];mapping:ImportMapping;sections:Omit<ImportSection,'body'>[];totalSections:number;page:number;words:number;chapters:number;scenes:number;diagnostics:ImportDiagnostic[];sourceWords:number;sample:string};
export type ImportRequest={kind:'choose'}|{kind:'poll'|'cancel';token:string}|{kind:'encoding';token:string;encoding:'windows-1252'|'utf-8'}|{kind:'preview';token:string;mapping:ImportMapping;page?:number;sample?:string}|{kind:'location'}|{kind:'default-location'}|{kind:'create';token:string;mapping:ImportMapping;location:string;name:string;keepSource:boolean;acknowledged:boolean}|{kind:'report'};
export type ImportReply={ok:true;value:any}|{ok:false;error:ImportDiagnostic};
export const importStrategies=(a:ImportAnalysis)=>[{id:'single',label:'Single Document'},...[...new Set(a.blocks.map(b=>b.heading).filter(Boolean))].sort().map(level=>({id:'h'+level,label:'Heading '+level})),...(a.blocks.some(b=>b.pageBreak)?[{id:'page',label:'Page Break'}]:[]),...(a.blocks.some(b=>b.spine)?[{id:'spine',label:'EPUB spine sections'}]:[]),{id:'label',label:'Common Chapter labels'},{id:'separator',label:'Custom separator'}];
export function mapImport(a:ImportAnalysis,m:ImportMapping):ImportSection[]{
 if(!importStrategies(a).some(s=>s.id===m.chapter)||!['none',...importStrategies(a).filter(s=>s.id!=='single').map(s=>s.id)].includes(m.scene))throw Error('Choose an available structure signal.');
 if(m.scene!=='none'&&(m.chapter==='single'||m.chapter===m.scene||(/^h/.test(m.chapter)&&/^h/.test(m.scene)&&Number(m.scene.slice(1))<=Number(m.chapter.slice(1)))))throw Error('Choose a deeper, different Scene signal.');
 if((m.chapter==='separator'||m.scene==='separator')&&!m.separator.trim())throw Error('Enter the complete separator line.');
 const sections:ImportSection[]=[];let chapter:ImportSection|undefined,current:ImportSection|undefined,c=0,s=0;
 const add=(kind:'Chapter'|'Scene',key:string,title?:string)=>{const entry:ImportSection={key,parent:kind==='Scene'?chapter!.key:null,kind,title:title?.trim()||(kind==='Chapter'?'Chapter '+ ++c:'Scene '+ ++s),body:{type:'doc',content:[]},words:0,included:true};sections.push(entry);current=entry;if(kind==='Chapter'){chapter=entry;s=0;}return entry;};
 const matches=(b:ImportBlock,signal:string)=>signal==='page'?!!b.pageBreak:signal==='spine'?!!b.spine:signal==='label'?/^chapter\s+(?:\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten)(?:\b|:)/i.test(visibleText(b.body).trim()):signal==='separator'?(b.separator||visibleText(b.body)).trim()===m.separator.trim():signal==='h'+b.heading;
 for(const b of a.blocks){let consumed=false;const ch=m.chapter!=='single'&&matches(b,m.chapter),sc=m.scene!=='none'&&matches(b,m.scene);
  if(ch){add('Chapter','c:'+b.id,m.chapter.startsWith('h')||m.chapter==='label'?visibleText(b.body):m.chapter==='spine'?b.label:undefined);consumed=!['page','spine'].includes(m.chapter);}
  else if(sc){if(!chapter)add('Chapter','c:lead');add('Scene','s:'+b.id,m.scene.startsWith('h')?visibleText(b.body):undefined);consumed=!['page','spine'].includes(m.scene);}
  if(!current)add('Chapter','c:lead',m.chapter==='single'?a.source.filename.replace(/\.[^.]+$/,''):undefined);
  if(!consumed)current!.body.content!.push(b.body);
 }
 if(!sections.length)add('Chapter','c:empty');
 for(const entry of sections){entry.title=m.titles[entry.key]?.trim()||entry.title;entry.words=wordTokens(visibleText(entry.body)).length;entry.included=!m.excluded.includes(entry.key)&&(m.includeEmpty||!!visibleText(entry.body).trim()||sections.some(s=>s.parent===entry.key&&visibleText(s.body).trim()));if(!entry.body.content!.length)entry.body=blank();if(/^(copyright|dedication|epigraph|contents|preface|acknowledg|appendix|about the author|title page)/i.test(entry.title))entry.advisory='Possible front/back matter';}
 for(const entry of sections)if(entry.parent&&!sections.find(s=>s.key===entry.parent)?.included)entry.included=false;
 return sections;
}
export function importedProject(a:ImportAnalysis,m:ImportMapping,title:string,id:()=>string){const sections=mapImport(a,m).filter(s=>s.included);if(!sections.length)throw Error('Include at least one section.');const ids=new Map(sections.map(s=>[s.key,id()]));const project:Project={manifest:{version:1,id:id(),title,revision:0,nodes:sections.map(s=>({id:ids.get(s.key)!,parent:s.parent?ids.get(s.parent)!:null,title:s.title,kind:s.kind})),settings:{editor:{},publication:{},workspace:{}}},documents:Object.fromEntries(sections.map(s=>[ids.get(s.key)!,s.body])),author:defaultAuthor(id()),recovery:[]};project.manifest.settings.workspace.selected=ids.get(sections.find(s=>s.words)?.key||sections[0].key)!;validate(project);return {project,activeDocumentId:ids.get(sections.find(s=>s.words)?.key||sections[0].key)!,sections};}
