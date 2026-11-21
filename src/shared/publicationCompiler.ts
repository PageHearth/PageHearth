import {validManuscriptImage} from './manuscriptImages.js';
import {ebookCover} from './covers.js';
import {validSpecialText,type SpecialTextRole} from './specialText.js';
import {publicationRenderPlan} from './publicationStyleAdapter.js';
import type {Doc,Project} from './model.js';
import {bodySources,included,readPublication,safeLink,type PublicationPlan,type PublicationTarget,type BookMetadata,type BookStyle} from './publication.js';

export type PublicationSource={kind:'manuscript'|'publication';id:string;path?:number[]};
export type SemanticNode={kind:'specialText'|'paragraph'|'text'|'heading'|'blockquote'|'bulletList'|'orderedList'|'listItem'|'codeBlock'|'lineBreak'|'sceneBreak'|'image';role?:SpecialTextRole;regionId?:string;text?:string;level?:number;start?:number;marks?:{kind:'strong'|'emphasis'|'strike'|'underline'|'code'|'link';href?:string}[];children?:SemanticNode[];source:PublicationSource;
  image?:{size?:'small'|'medium'|'large'|'full-width';alignment?:'left'|'center'|'right';width?:number;height?:number;asset:string;alt:string;caption:string;decorative:boolean;sizing:'inline'|'full-width'|'full-page';bleed?:boolean;focal?:{x:number;y:number}}};
export type PublicationSection={id:string;zone:'front'|'body'|'back';kind:'page'|'part'|'chapter'|'scene'|'folder';title:string;generator?:'title'|'copyright'|'contents';source:PublicationSource;nodes:SemanticNode[];navigation?:{id:string;title:string;depth:number}[]};
export type PreflightIssue={severity:'error'|'warning'|'info';code:string;message:string;target:PublicationTarget;profile:string;source?:PublicationSource;blocking:boolean;fix:string};
export type DeepReadonly<T>=T extends object?{readonly [K in keyof T]:DeepReadonly<T[K]>}:T;
export type PublicationDocument=DeepReadonly<{version:1;projectId:string;target:PublicationTarget;metadata:BookMetadata;style:BookStyle;bookStyle?:PublicationPlan['bookStyle'];print:PublicationPlan['print'];production?:PublicationPlan['production'];ebook:PublicationPlan['ebook'];specialTextVariants?:PublicationPlan['specialTextVariants'];sections:PublicationSection[];preflight:PreflightIssue[]}>;
export interface PublicationRenderer<Options,Result>{render(document:PublicationDocument,options:Options,signal:AbortSignal):Promise<Result>}
export type PublicationRenderResult={bytes:Uint8Array;mime:string;diagnostics:PreflightIssue[]};
/** No file access, writes, app theme, or engine-specific syntax. Asset existence comes from an optional verified inventory. */
export function compilePublication(project:Project,target:PublicationTarget='print',assets?:ReadonlySet<string>):PublicationDocument{
  const rendered=publicationRenderPlan(readPublication(project));const p={...rendered,metadata:{...rendered.metadata}};if(target==='ebook'){p.metadata.coverAsset=ebookCover(p);}else delete p.metadata.coverAsset;const sections:PublicationSection[]=[],issues:PreflightIssue[]=[];
  const issue=(code:string,message:string,source?:PublicationSource,blocking=true)=>issues.push({code,message,source,blocking,severity:blocking?'error':'warning',target,profile:target==='print'?p.print.profile:target,fix:code==='missing-source'?'Restore the source in WRITE or clear its publication inclusion override.':code==='missing-title'?'Enter a book title in Metadata.':code==='empty-body'?'Add manuscript prose in WRITE or adjust inclusion.':'Check the project asset and restore it from a verified backup.'});
  if(!p.metadata.title.trim())issue('missing-title','Book title is empty.');
  const sources=bodySources(project),visible=new Set<string>(),nodeById=new Map(project.manifest.nodes.map(n=>[n.id,n]));
  for(const n of sources){if((n.parent===null||visible.has(n.parent))&&included(p.body[n.id]?.inclusion||'all',target))visible.add(n.id);}
  for(const ref of Object.values(p.body))if(!nodeById.has(ref.sourceId))issue('missing-source','A configured manuscript source is missing.',{kind:'manuscript',id:ref.sourceId});
  const asset=(path:string,source:PublicationSource)=>{if(assets&&!assets.has(path))issue('missing-asset','A publication asset is missing: '+path,source);};
  const map=(doc:Doc,source:PublicationSource,path:number[]=[]):SemanticNode[]=>{
    const here={...source,path};if(doc.type==='doc')return (doc.content||[]).flatMap((d,i)=>map(d,source,[...path,i]));
    const kind=({hardBreak:'lineBreak',horizontalRule:'sceneBreak',manuscriptImage:'image'} as Record<string,string>)[doc.type]||doc.type;
    const node:SemanticNode={kind:kind as SemanticNode['kind'],source:here};
    if(doc.text!==undefined)node.text=doc.text;
    if(doc.type==='heading')node.level=Math.min(6,Math.max(1,Number(doc.attrs?.level)||1));
    if(doc.type==='orderedList')node.start=Math.max(1,Number(doc.attrs?.start)||1);
    const markNames:Record<string,NonNullable<SemanticNode['marks']>[number]['kind']>={bold:'strong',italic:'emphasis',strike:'strike',underline:'underline',code:'code',link:'link'};
    const marks=(doc.marks||[]).flatMap(m=>markNames[m.type]&&(m.type!=='link'||safeLink(m.attrs?.href))?[{kind:markNames[m.type],...(m.type==='link'?{href:String(m.attrs!.href)}:{})}]:[]);if(marks.length)node.marks=marks;
    if(doc.type==='manuscriptImage'){const a=doc.attrs;if(!validManuscriptImage(a)){issue('invalid-image','A manuscript image needs repair.',here);return [];}node.image={asset:a.asset,alt:a.alt,caption:a.caption,decorative:a.decorative,sizing:'inline',size:a.size,alignment:a.alignment,width:a.width,height:a.height};asset(a.asset,here);if(!a.decorative&&!a.alt.trim())issue('missing-alt','A meaningful manuscript image has no alt text.',here,false);}
    if(doc.type==='image'){const a=doc.attrs||{};node.image={asset:String(a.asset||''),alt:String(a.alt||''),caption:String(a.caption||''),decorative:a.decorative===true,sizing:['full-width','full-page'].includes(String(a.sizing))?a.sizing as 'full-width'|'full-page':'inline'};asset(node.image.asset,here);}
    if(doc.type==='paragraph'&&validSpecialText(doc.attrs?.specialText)){node.kind='specialText';node.role=doc.attrs.specialText;if(typeof doc.attrs.specialRegionId==='string')node.regionId=doc.attrs.specialRegionId;}
    if(doc.type==='blockquote')node.role='excerpt';
    if(doc.content)node.children=doc.content.flatMap((d,i)=>map(d,source,[...path,i]));return [node];
  };
  const body:PublicationSection[]=sources.filter(n=>visible.has(n.id)).map(n=>{
    const source:PublicationSource={kind:'manuscript',id:n.id};if(!project.documents[n.id])issue('missing-source','Manuscript document is missing.',source);
    const nodes=map(project.documents[n.id]||{type:'doc'},source);
    if(n.kind==='Scene'&&target!=='ebook')nodes.unshift({kind:'sceneBreak',source});
    return {id:n.id,zone:'body',kind:n.kind.toLowerCase() as PublicationSection['kind'],title:n.title,source,nodes};
  });
  const hasText=(n:SemanticNode):boolean=>!!n.text?.trim()||!!n.image||!!n.children?.some(hasText);
  if(!body.some(s=>s.nodes.some(hasText)))issue('empty-body','Publication body has no included prose.');
  const text=(text:string,source:PublicationSource):SemanticNode=>({kind:'paragraph',source,children:[{kind:'text',text,source}]});
  const pages=(zone:'front'|'back')=>{for(const id of p[zone]){const page=p.pages[id];if(!included(page.inclusion,target))continue;const source:PublicationSource={kind:'publication',id};const section:PublicationSection={id,zone,kind:'page',title:page.title,source,nodes:[]};
    if(page.kind==='generated')section.generator=page.generator;
    if(page.kind==='authored')section.nodes=map(page.body,source);
    else if(page.generator==='contents'){section.navigation=body.filter(s=>['part','chapter'].includes(s.kind)).map(s=>({id:s.id,title:s.title,depth:s.kind==='part'?0:1}));}
    else {const m=p.metadata;const values=page.generator==='title'?[m.title,m.subtitle,m.author,...m.contributors,m.publisher]:[m.copyrightHolder||m.copyrightYear?['©',m.copyrightYear,m.copyrightHolder].filter(Boolean).join(' '):'',m.publisher,m.publicationDate,...Object.entries(m.identifiers).filter(([edition])=>target==='ebook'?edition==='ebook':target==='print'?edition!=='ebook':true).filter(([,v])=>v).map(([edition,v])=>edition+': '+v)];section.nodes=values.filter(Boolean).map(v=>text(v,source));}
    sections.push(section);
  }};
  pages('front');sections.push(...body);pages('back');
  if((target==='print'||target==='ebook')&&Object.values(project.author.comments?.byId||{}).some(c=>c.state==='open'))issues.push({severity:'warning',code:'unresolved-comments',message:'Open manuscript Comments remain. They are not included in this publication.',target,profile:target==='print'?p.print.profile:'ebook',blocking:false,fix:'Review Comments in WRITE before publishing.'});
  if(p.metadata.coverAsset)asset(p.metadata.coverAsset,{kind:'publication',id:'title'});
  if(!assets&&(p.metadata.coverAsset||sections.some(s=>s.nodes.some(n=>n.image))))issues.push({severity:'info',code:'assets-unverified',message:'Asset existence has not been checked in this preview.',target,profile:p.print.profile,blocking:false,fix:'Verify assets before final export.'});
  if(target==='print')issues.push({severity:'warning',code:'profile-unqualified',message:(p.print.profile==='ingram'?'IngramSpark — YELLOW / unqualified. ':'')+'Draft Preview is not a print proof. Print profiles and PDF/X are not validated.',target,profile:p.print.profile,blocking:false,fix:'Use a future validated print renderer and preflight before publication.'});
  const result={version:1 as const,projectId:project.manifest.id,target,metadata:structuredClone(p.metadata),style:structuredClone(p.style),bookStyle:structuredClone(p.bookStyle),print:structuredClone(p.print),production:structuredClone(p.production),ebook:structuredClone(p.ebook),specialTextVariants:structuredClone(p.specialTextVariants),sections,preflight:issues};
  return freeze(result);
}
function freeze<T>(value:T):DeepReadonly<T>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value as DeepReadonly<T>;}
