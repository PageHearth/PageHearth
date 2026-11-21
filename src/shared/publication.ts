import {validateCovers,type CoverConfig} from './covers.js';
import {validateVariants,type PublicationVariant} from './publicationVariants.js';
import {validateSharedPublicationStyle,type SharedPublicationStyle} from './publicationStyle.js';
import {validateSpecialTextStyles,type SpecialTextStyles} from './specialText.js';
import {validateEbookOptions,type EbookOptions} from './ebookProduction.js';
import type {Doc, Project, TreeNode} from './model.js';
import {validatePrintOptions,type PrintOptions} from './printProduction.js';

export type PublicationTarget = 'print'|'ebook'|'editorial'|'genericText';
export type Inclusion = 'all'|'print'|'ebook'|'none';
export type MatterZone = 'front'|'back';
export const pageKinds = {
  front:['Dedication','Epigraph','Foreword','Preface','Introduction','Custom Front Matter'],
  back:['Acknowledgments','About the Author','Also By','Custom Back Matter'],
} as const;
export type PublicationPage = {id:string; zone:MatterZone; title:string; inclusion:Inclusion} & (
  {kind:'generated'; generator:'title'|'copyright'|'contents'} |
  {kind:'authored'; pageType:string; body:Doc}
);
export type BookMetadata = {
  title:string; subtitle:string; author:string; contributors:string[]; language:string;
  series:string; seriesPosition:string; publisher:string; copyrightHolder:string; copyrightYear:string;
  publicationDate:string; coverAsset?:string;
  identifiers:{ebook:string;paperback:string;hardcover:string};
};
export type BookStyle = {
  id:string; name:string;
  specialText?:SpecialTextStyles;
  shared:{sceneBreak:'none'|'space'|'ornament';chapterHeading:'title'|'number-title'};
  print:{font:string;sizePt:number;lineHeight:number;indentPt:number;paragraphSpacePt:number;
    alignment:'left'|'center'|'right'|'justify';italic?:boolean;hyphenation:boolean;widows:number;orphans:number};
  ebook:{body:'reader-default';headings:'classic';chapters:'new-section';images:'contain';embedFonts:boolean;fallback:'serif'};
};
export type PublicationPlan = {
  version:1|2; metadata:BookMetadata; covers?:CoverConfig;
  /** Canonical unified appearance. Legacy branches remain compatibility evidence. */
  bookStyle?:SharedPublicationStyle;
  specialTextVariants?:PublicationVariant[];
  pages:Record<string,PublicationPage>; front:string[]; back:string[];
  /** Sparse stable source references; order and prose always come from manuscript. */
  body:Record<string,{sourceId:string;inclusion:Inclusion}>;
  style:BookStyle;
  print:{profile:'generic'|'kdp'|'ingram'|'custom';unit:'pt';width:number;height:number;
    margins:{top:number;bottom:number;inside:number;outside:number};gutter:number;bleed:boolean;chapterStart:'next'|'recto'};
  ebook:{profile:'reflowable';options?:EbookOptions};
  production?:PrintOptions;
};
export function defaultPublication(title:string):PublicationPlan {
  const generated=(id:string,title:string,generator:'title'|'copyright'|'contents'):PublicationPage=>({id,zone:'front',title,kind:'generated',generator,inclusion:'all'});
  return {version:1,metadata:{title,subtitle:'',author:'',contributors:[],language:'en',series:'',seriesPosition:'',publisher:'',copyrightHolder:'',copyrightYear:'',publicationDate:'',identifiers:{ebook:'',paperback:'',hardcover:''}},
    pages:{title:generated('title','Title Page','title'),copyright:generated('copyright','Copyright Page','copyright'),contents:generated('contents','Contents','contents')},front:['title','copyright','contents'],back:[],body:{},
    style:{id:'classic',name:'Classic',shared:{sceneBreak:'space',chapterHeading:'title'},print:{font:'serif',sizePt:11,lineHeight:1.4,indentPt:12,paragraphSpacePt:0,alignment:'justify',hyphenation:true,widows:2,orphans:2},ebook:{body:'reader-default',headings:'classic',chapters:'new-section',images:'contain',embedFonts:false,fallback:'serif'}},
    print:{profile:'generic',unit:'pt',width:432,height:648,margins:{top:54,bottom:54,inside:54,outside:54},gutter:0,bleed:false,chapterStart:'next'},ebook:{profile:'reflowable'}};
}
/** Defaults are a projection, never an implicit migration or write. */
export function readPublication(project:Project):PublicationPlan {return project.author.publication??defaultPublication(project.manifest.title);}
export function editPublication(project:Project,edit:(plan:PublicationPlan)=>void):Project {
  const plan=structuredClone(readPublication(project));edit(plan);validatePublication(plan);
  return {...project,author:{...project.author,publication:plan}};
}
export function addPublicationPage(project:Project,zone:MatterZone,pageType:string){
  if(!(pageKinds[zone] as readonly string[]).includes(pageType))throw Error('Choose a publication page type.');
  const id=crypto.randomUUID();return {id,project:editPublication(project,p=>{p.pages[id]={id,zone,title:pageType,kind:'authored',pageType,inclusion:'all',body:{type:'doc',content:[{type:'paragraph'}]}};p[zone].push(id);})};
}
export function movePublicationPage(project:Project,id:string,direction:-1|1):Project {
  return editPublication(project,p=>{const page=p.pages[id];if(!page)throw Error('Publication page is missing.');const order=p[page.zone],at=order.indexOf(id),to=at+direction;if(to>=0&&to<order.length)[order[at],order[to]]=[order[to],order[at]];});
}
export function bodySources(project:Project):TreeNode[]{
  const children=new Map<string|null,TreeNode[]>();for(const node of project.manifest.nodes){const list=children.get(node.parent)||[];list.push(node);children.set(node.parent,list);}
  const result:TreeNode[]=[];const visit=(parent:string|null)=>{for(const node of children.get(parent)||[]){if(node.trashed)continue;result.push(node);visit(node.id);}};visit(null);return result;
}
/** Editorial/plain text include All only; print/eBook-specific extras stay edition-specific. */
export const included=(value:Inclusion,target:PublicationTarget)=>value==='all'||value===target;
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const safeId=(s:unknown)=>typeof s==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(s);
export const safeAsset=(s:unknown):s is string=>typeof s==='string'&&/^assets\/(?:[^<>:"\\|?*\x00-\x1f/]+\/)*[^<>:"\\|?*\x00-\x1f/]+$/.test(s)&&!s.split('/').some(x=>x==='.'||x==='..'||/[. ]$/.test(x));
export const safeLink=(s:unknown):s is string=>typeof s==='string'&&/^(https?:\/\/|mailto:)/i.test(s);
export function validatePublication(value:unknown):asserts value is PublicationPlan {
  if(value===undefined)return;
  const fail=()=>{throw Error('Unsupported or damaged Publication Plan.');};
  if(!record(value)||(value.version!==1&&value.version!==2))fail();
  const p=value as PublicationPlan;
  if(p.version===2&&p.bookStyle===undefined||p.version===1&&p.bookStyle!==undefined)fail();
  if(p.bookStyle!==undefined)validateSharedPublicationStyle(p.bookStyle);
  if(p.specialTextVariants!==undefined)validateVariants(p.specialTextVariants);
  if(p.ebook?.options!==undefined)validateEbookOptions(p.ebook.options);
  if(p.style?.specialText!==undefined)validateSpecialTextStyles(p.style.specialText);
  if(p.production!==undefined)validatePrintOptions(p.production);
  if(p.covers!==undefined)validateCovers(p.covers);
  if(!record(p.metadata)||!record(p.pages)||!record(p.body)||!Array.isArray(p.front)||!Array.isArray(p.back))fail();
  const m=p.metadata;
  for(const key of ['title','subtitle','author','language','series','seriesPosition','publisher','copyrightHolder','copyrightYear','publicationDate'] as const)if(typeof m[key]!=='string')fail();
  if(!Array.isArray(m.contributors)||m.contributors.some(x=>typeof x!=='string')||!record(m.identifiers)||['ebook','paperback','hardcover'].some(x=>typeof (m.identifiers as Record<string,unknown>)[x]!=='string')||(m.coverAsset!==undefined&&!safeAsset(m.coverAsset)))fail();
  const order=[...p.front,...p.back];if(new Set(order).size!==order.length||order.length!==Object.keys(p.pages).length)fail();
  const inclusion=(x:unknown)=>['all','print','ebook','none'].includes(String(x));
  for(const [id,page] of Object.entries(p.pages)){
    if(!record(page)||!safeId(id)||page.id!==id||!['front','back'].includes(page.zone)||!p[page.zone].includes(id)||typeof page.title!=='string'||!inclusion(page.inclusion))fail();
    if(page.kind==='generated'){if(page.zone!=='front'||!['title','copyright','contents'].includes(page.generator))fail();}
    else if(page.kind==='authored'){if(!(pageKinds[page.zone] as readonly string[]).includes(page.pageType))fail();validatePublicationBody(page.body);}else fail();
  }
  for(const [id,ref] of Object.entries(p.body))if(!record(ref)||!safeId(id)||ref.sourceId!==id||!inclusion(ref.inclusion))fail();
  const s=p.style,g=p.print;
  if(!record(s)||typeof s.id!=='string'||typeof s.name!=='string'||!record(s.shared)||!['none','space','ornament'].includes(s.shared.sceneBreak)||!['title','number-title'].includes(s.shared.chapterHeading)||!record(s.print)||typeof s.print.font!=='string'||!['left','center','right','justify'].includes(s.print.alignment)||typeof s.print.hyphenation!=='boolean'||s.print.italic!==undefined&&typeof s.print.italic!=='boolean'||!record(s.ebook)||s.ebook.body!=='reader-default'||s.ebook.headings!=='classic'||s.ebook.chapters!=='new-section'||s.ebook.images!=='contain'||typeof s.ebook.embedFonts!=='boolean'||s.ebook.fallback!=='serif')fail();
  for(const key of ['sizePt','lineHeight','indentPt','paragraphSpacePt','widows','orphans'] as const)if(!Number.isFinite(s.print[key])||s.print[key]<0||s.print[key]>1000)fail();
  if(!record(g)||!['generic','kdp','ingram','custom'].includes(g.profile)||g.unit!=='pt'||!record(g.margins)||typeof g.bleed!=='boolean'||!['next','recto'].includes(g.chapterStart)||p.ebook?.profile!=='reflowable')fail();
  if([g.width,g.height,g.gutter,g.margins.top,g.margins.bottom,g.margins.inside,g.margins.outside].some(x=>!Number.isFinite(x)||x<0||x>10000)||g.width<=g.margins.inside+g.margins.outside+g.gutter||g.height<=g.margins.top+g.margins.bottom||s.print.sizePt<=0||s.print.lineHeight<=0)fail();
}
export function validatePublicationBody(doc:Doc){
  const allowed=['doc','paragraph','text','heading','blockquote','bulletList','orderedList','listItem','codeBlock','hardBreak','horizontalRule','image'];
  const visit=(d:Doc,depth:number)=>{
    if(!record(d)||depth>100||!allowed.includes(d.type)||(d.text!==undefined&&typeof d.text!=='string')||(d.content!==undefined&&!Array.isArray(d.content)))throw Error('Invalid publication text.');
    if(d.type==='image'&&(!safeAsset(d.attrs?.asset)||typeof d.attrs?.alt!=='string'))throw Error('Invalid publication image.');
    if(d.marks!==undefined&&(!Array.isArray(d.marks)||d.marks.some(m=>!['bold','italic','strike','underline','code','link'].includes(m.type)||(m.type==='link'&&!safeLink(m.attrs?.href)))))throw Error('Invalid publication formatting.');
    d.content?.forEach(c=>visit(c,depth+1));
  };if(doc?.type!=='doc')throw Error('Publication text is missing.');visit(doc,0);
}
