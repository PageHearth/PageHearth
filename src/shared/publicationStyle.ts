import type {PublicationPlan} from './publication.js';
import type {EbookRoleStyle} from './ebookStyles.js';
import {specialTextRoles, type SpecialTextStyle, type SpecialTextRole} from './specialText.js';
import {validFontFamily} from './fonts.js';

/** Author intent, independent of output. Percentages use the available text width;
 * sizes, paragraph spacing and indentation are relative to the body/role em. */
export type PublicationAppearance = {
  family?:string; size?:number; lineHeight?:number;
  alignment?:'start'|'center'|'end'|'justify'; italic?:boolean;
  insetStart?:number; insetEnd?:number; indent?:number; paragraphSpace?:number;
};
export type EbookFontPermission = {policy?:'body'|'reader'|'embedded';licenseConfirmed?:boolean};
export type SharedPublicationStyle = {
  version:1;
  body:PublicationAppearance;
  chapters:PublicationAppearance & {spaceAbove?:number;spaceBelow?:number};
  sceneBoundary:'none'|'space'|'ornament';
  roles:Partial<Record<SpecialTextRole,PublicationAppearance>>;
  variants:Record<string,PublicationAppearance>;
  passages:Record<string,PublicationAppearance>;
  /** Permission is target-specific, appearance is not. Keys match layer paths. */
  ebookPermissions:Record<string,EbookFontPermission>;
};
export type StyleConflict = {id:string;layer:string;property:string;print:string|number|boolean;ebook:string|number|boolean};
export type StyleMigration = {style:SharedPublicationStyle;conflicts:StyleConflict[]};
export const passageStyleKey=(r:{sourceKind:string;sourceId:string;regionId:string;role:string})=>[r.sourceKind,r.sourceId,r.regionId,r.role].join(':');
const round=(n:number)=>Math.round(n*1e8)/1e8;
const equivalent=(a:unknown,b:unknown)=>typeof a==='number'&&typeof b==='number'?Math.abs(a-b)<1e-7:a===b;
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const appearanceKeys=['family','size','lineHeight','alignment','italic','insetStart','insetEnd','indent','paragraphSpace'];
export function validateAppearance(value:unknown,chapter=false):asserts value is PublicationAppearance {
  if(!record(value)||Object.keys(value).some(k=>!appearanceKeys.includes(k)&&!(chapter&&['spaceAbove','spaceBelow'].includes(k))))throw Error('Invalid shared publication appearance.');
  if(value.family!==undefined&&!validFontFamily(value.family)||value.alignment!==undefined&&!['start','center','end','justify'].includes(String(value.alignment))||value.italic!==undefined&&typeof value.italic!=='boolean')throw Error('Invalid shared publication appearance.');
  for(const [k,v] of Object.entries(value))if(!['family','alignment','italic'].includes(k)){
    const min=k==='size'||k==='lineHeight'?0.01:0,max=k==='insetStart'||k==='insetEnd'?100:1000;
    if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error('Invalid shared publication dimensions.');
  }
}
export function validateSharedPublicationStyle(value:unknown):asserts value is SharedPublicationStyle {
  if(!record(value)||value.version!==1||Object.keys(value).some(k=>!['version','body','chapters','sceneBoundary','roles','variants','passages','ebookPermissions'].includes(k))||!['none','space','ornament'].includes(String(value.sceneBoundary)))throw Error('Unsupported shared publication style.');
  validateAppearance(value.body);validateAppearance(value.chapters,true);
  for(const key of ['roles','variants','passages'] as const){const entries=value[key];if(!record(entries)||Object.keys(entries).length>2048)throw Error('Invalid shared publication layers.');for(const [id,s] of Object.entries(entries)){if(!id||id.length>512||['__proto__','constructor','prototype'].includes(id)||key==='roles'&&!Object.hasOwn(specialTextRoles,id))throw Error('Invalid shared publication layer identity.');validateAppearance(s);}}
  if(!record(value.ebookPermissions)||Object.keys(value.ebookPermissions).length>4097)throw Error('Invalid font permissions.');
  for(const [id,p] of Object.entries(value.ebookPermissions))if(!id||id.length>530||!record(p)||Object.keys(p).some(k=>!['policy','licenseConfirmed'].includes(k))||p.policy!==undefined&&!['body','reader','embedded'].includes(String(p.policy))||p.licenseConfirmed!==undefined&&typeof p.licenseConfirmed!=='boolean')throw Error('Invalid font permission.');
}
function fromPrint(s:SpecialTextStyle|undefined,bodySize:number,width:number,inheritedSize=bodySize):PublicationAppearance {
  if(!s)return {};const r:PublicationAppearance={};
  if(s.font!==undefined)r.family=s.font;
  if(s.sizePt!==undefined)r.size=round(s.sizePt/bodySize);
  if(s.lineHeight!==undefined)r.lineHeight=s.lineHeight;
  if(s.alignment!==undefined)r.alignment=({left:'start',center:'center',right:'end',justify:'justify'} as const)[s.alignment];
  if(s.italic!==undefined)r.italic=s.italic;
  if(s.leftPt!==undefined)r.insetStart=round(s.leftPt/width*100);
  if(s.rightPt!==undefined)r.insetEnd=round(s.rightPt/width*100);
  if(s.indentPt!==undefined)r.indent=round(s.indentPt/(s.sizePt??inheritedSize));
  if(s.spacePt!==undefined)r.paragraphSpace=round(s.spacePt/(s.sizePt??inheritedSize));
  return r;
}
function fromEbook(s:EbookRoleStyle|undefined):PublicationAppearance {
  if(!s)return {};const r:PublicationAppearance={};
  for(const key of ['family','size','lineHeight','alignment','italic','insetStart','insetEnd','paragraphSpace','indent'] as const)if(s[key]!==undefined&&!(key==='family'&&(s.fontPolicy==='body'||s.fontPolicy==='reader')))Object.assign(r,{[key]:s[key]});
  return r;
}
/** Read-only compatibility projection. Conflicts have NO silently selected value.
 * The original plan is the migration evidence and is never modified here. */
export function inspectStyleMigration(plan:PublicationPlan):StyleMigration {
  const conflicts:StyleConflict[]=[],permissions:SharedPublicationStyle['ebookPermissions']={};
  const merge=(layer:string,a:PublicationAppearance,b:PublicationAppearance):PublicationAppearance=>{
    const result:Record<string,unknown>={};for(const key of new Set([...Object.keys(a),...Object.keys(b)])){
      const x=a[key as keyof PublicationAppearance],y=b[key as keyof PublicationAppearance];
      if(x!==undefined&&y!==undefined&&!equivalent(x,y))conflicts.push({id:layer+'/'+key,layer,property:key,print:x,ebook:y});
      else if(x!==undefined||y!==undefined)result[key]=x??y;
    }return result;
  };
  const base=plan.style.print,size=base.sizePt,width=plan.print.width-plan.print.margins.inside-plan.print.margins.outside-plan.print.gutter;
  const options=plan.ebook.options;
  const bodyPrint:PublicationAppearance={family:base.font,lineHeight:base.lineHeight,alignment:base.alignment==='left'?'start':base.alignment==='right'?'end':base.alignment,indent:round(base.indentPt/size),paragraphSpace:round(base.paragraphSpacePt/size)};
  if(base.italic!==undefined)bodyPrint.italic=base.italic;
  const bodyEbook:PublicationAppearance={};
  if(options?.embeddedFont){bodyEbook.family=options.embeddedFont.family;permissions.body={policy:'embedded',licenseConfirmed:options.embeddedFont.licenseConfirmed};}
  else if(options?.font&&options.font!=='reader-default')bodyEbook.family=options.font;
  // Legacy mandatory paragraph fields have no edit provenance. Preserve differences
  // for explicit reconciliation rather than treating a stored default as absent.
  if(options){bodyEbook.indent=options.paragraphs==='indented'?1:0;bodyEbook.paragraphSpace=options.paragraphs==='spaced'?.5:0;}
  const body=merge('body',bodyPrint,bodyEbook);
  const pair=(layer:string,p:SpecialTextStyle|undefined,e:EbookRoleStyle|undefined,inheritedSize=size)=>{
    if(e?.fontPolicy!==undefined||e?.licenseConfirmed!==undefined)permissions[layer]={...(e.fontPolicy!==undefined?{policy:e.fontPolicy}:{}),...(e.licenseConfirmed!==undefined&&e.fontPolicy!=='body'&&e.fontPolicy!=='reader'?{licenseConfirmed:!!e.family&&e.licenseConfirmed}:{})};
    return merge(layer,fromPrint(p,size,width,inheritedSize),fromEbook(e));
  };
  const roles:SharedPublicationStyle['roles']={};
  for(const role of Object.keys(specialTextRoles) as SpecialTextRole[])if(plan.style.specialText?.[role]||options?.specialText?.[role])roles[role]=pair('roles/'+role,plan.style.specialText?.[role],options?.specialText?.[role]);
  const variants:Record<string,PublicationAppearance>={};for(const v of plan.specialTextVariants??[])variants[v.id]=pair('variants/'+v.id,v.treatments.print,v.treatments.ebook,plan.style.specialText?.[v.role]?.sizePt??size);
  const passages:Record<string,PublicationAppearance>={};for(const r of options?.regions??[]){const key=passageStyleKey(r);if(Object.hasOwn(passages,key))throw Error('Ambiguous legacy publication passage styles.');const v=plan.specialTextVariants?.find(v=>v.id===r.variantId&&v.role===r.role);passages[key]=pair('passages/'+key,r.printStyle,r.style,v?.treatments.print?.sizePt??plan.style.specialText?.[r.role]?.sizePt??size);}
  const prod=plan.production,chapters:SharedPublicationStyle['chapters']=prod?{family:prod.chapterFont,size:round(prod.chapterSize/size),alignment:({left:'start',center:'center',right:'end'} as const)[prod.chapterAlign],spaceAbove:round(prod.chapterAbove/size),spaceBelow:round(prod.chapterBelow/size),...(prod.chapterItalic!==undefined?{italic:prod.chapterItalic}:{})}:{};
  let sceneBoundary=plan.style.shared.sceneBreak as SharedPublicationStyle['sceneBoundary'];
  if(options?.sceneBoundary!==undefined&&options.sceneBoundary!==sceneBoundary)conflicts.push({id:'sceneBoundary',layer:'sceneBoundary',property:'sceneBoundary',print:sceneBoundary,ebook:options.sceneBoundary});
  const style:SharedPublicationStyle={version:1,body,chapters,sceneBoundary,roles,variants,passages,ebookPermissions:permissions};
  validateSharedPublicationStyle(style);return {style,conflicts};
}
export type StyleChoices=Record<string,{use:'print'|'ebook'}|{use:'custom';value:string|number|boolean}>;
/** All conflicts must have deliberate choices; stale/unknown choices are rejected. */
export function reconcilePublicationStyle(plan:PublicationPlan,choices:StyleChoices):SharedPublicationStyle {
  const {style,conflicts}=inspectStyleMigration(plan),ids=new Set(conflicts.map(c=>c.id));
  if(Object.keys(choices).some(id=>!ids.has(id)))throw Error('Style reconciliation changed. Review the current choices.');
  for(const c of conflicts){const choice=choices[c.id];if(!choice)throw Error('Needs style reconciliation: '+c.id);if(!['print','ebook','custom'].includes(choice.use))throw Error('Invalid style choice.');const value=choice.use==='custom'?choice.value:c[choice.use];
    if(c.layer==='sceneBoundary'){style.sceneBoundary=value as SharedPublicationStyle['sceneBoundary'];continue;}
    const [kind,...rest]=c.layer.split('/'),id=rest.join('/');const layer=kind==='body'?style.body:(style[kind as 'roles'|'variants'|'passages'] as Record<string,PublicationAppearance>)[id];
    Object.assign(layer,{[c.property]:value});
    // A legacy acknowledgement belongs to its selected eBook family, not to a
    // different family chosen during conflict reconciliation.
    if(c.property==='family'&&value!==c.ebook&&style.ebookPermissions[c.layer])style.ebookPermissions[c.layer]={...style.ebookPermissions[c.layer],licenseConfirmed:false};
  }
  validateSharedPublicationStyle(style);return style;
}
/** Render adapters may only consume a fully reconciled shared style. */
export function resolveSharedAppearance(style:SharedPublicationStyle,role?:SpecialTextRole,variantId?:string,passageKey?:string):PublicationAppearance {
  const body={family:'Libertinus Serif',size:1,lineHeight:1.4,alignment:'justify' as const,italic:false,indent:1,paragraphSpace:0,insetStart:0,insetEnd:0,...style.body};
  if(!role)return body;
  return {...body,indent:0,alignment:'start',insetStart:role==='custom'?0:5,insetEnd:role==='custom'?0:5,paragraphSpace:role==='poem'?1:.5,italic:['letter','journal','written-note'].includes(role),...style.roles[role],...(variantId?style.variants[variantId]:{}),...(passageKey?style.passages[passageKey]:{})};
}
export function sharedPrintAppearance(style:PublicationAppearance,bodySize:number,contentWidth:number):SpecialTextStyle {
  const size=(style.size??1)*bodySize;
  return {font:style.family,sizePt:size,lineHeight:style.lineHeight,alignment:style.alignment==='center'?'center':style.alignment==='end'?'right':style.alignment==='justify'?'justify':'left',italic:style.italic,leftPt:(style.insetStart??0)*contentWidth/100,rightPt:(style.insetEnd??0)*contentWidth/100,indentPt:(style.indent??0)*size,spacePt:(style.paragraphSpace??0)*size};
}
