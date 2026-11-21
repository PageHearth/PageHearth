import type {PublicationPlan} from './publication.js';
import {defaultEbookOptions} from './ebookProduction.js';
import {classicPrint} from './printProduction.js';
import {specialTextRoles,type SpecialTextRole} from './specialText.js';
import type {EbookRoleStyle} from './ebookStyles.js';
import {passageStyleKey,reconcilePublicationStyle,resolveSharedAppearance,sharedPrintAppearance,validateSharedPublicationStyle,type PublicationAppearance,type SharedPublicationStyle,type StyleChoices} from './publicationStyle.js';

/** Explicit adoption only. Legacy choices stay in the plan unchanged as evidence.
 * The normal save coordinator persists this author-data change; no file I/O here. */
export function adoptPublicationStyle(plan:PublicationPlan,choices:StyleChoices):PublicationPlan {
  if(plan.bookStyle)throw Error('This publication already uses a shared Book Style.');
  return {...structuredClone(plan),version:2,bookStyle:reconcilePublicationStyle(plan,choices)};
}
function ebookAppearance(style:SharedPublicationStyle,a:PublicationAppearance,layers:string[]):EbookRoleStyle {
  // Preserve legacy policy/acknowledgement metadata in this disposable projection.
  // Rendering ignores licenseConfirmed; only technical font eligibility gates embedding.
  // A family change still resets an inherited reader-policy choice.
  let family:string|undefined,permission:{policy?:'body'|'reader'|'embedded';licenseConfirmed?:boolean}={};
  for(const key of layers){const [kind,...rest]=key.split('/'),id=rest.join('/');const appearance=kind==='body'?style.body:kind==='chapters'?style.chapters:kind==='roles'?style.roles[id as SpecialTextRole]:kind==='variants'?style.variants[id]:style.passages[id];
    if(appearance?.family!==undefined&&appearance.family!==family){family=appearance.family;permission={};}
    permission={...permission,...style.ebookPermissions[key]};
  }
  const generic=!a.family||['serif','sans-serif','monospace'].includes(a.family);
  return {family:a.family,fontPolicy:permission.policy==='reader'?'reader':generic?'body':'embedded',licenseConfirmed:permission.licenseConfirmed===true,size:(a.size??1)/(style.body.size??1),lineHeight:a.lineHeight,alignment:a.alignment,indent:a.indent,italic:a.italic,insetStart:a.insetStart,insetEnd:a.insetEnd,paragraphSpace:a.paragraphSpace};
}
/** Disposable renderer projection. No synchronization of persisted split branches.
 * Existing font/resource safety pipelines consume these adapted values. */
export function publicationRenderPlan(plan:PublicationPlan):PublicationPlan {
  if(!plan.bookStyle)return plan;
  validateSharedPublicationStyle(plan.bookStyle);
  const p=structuredClone(plan),s=p.bookStyle!,body=resolveSharedAppearance(s),size=p.style.print.sizePt;
  const width=p.print.width-p.print.margins.inside-p.print.margins.outside-p.print.gutter;
  p.style.print={...p.style.print,font:body.family!,sizePt:size*(body.size??1),italic:body.italic,lineHeight:body.lineHeight!,alignment:body.alignment==='justify'?'justify':body.alignment==='center'?'center':body.alignment==='end'?'right':'left',indentPt:(body.indent??0)*size,paragraphSpacePt:(body.paragraphSpace??0)*size};
  p.style.shared.sceneBreak=s.sceneBoundary;
  p.ebook.options={...defaultEbookOptions,...p.ebook.options,sceneBoundary:s.sceneBoundary,paragraphs:(body.paragraphSpace??0)>0?'spaced':'indented',specialText:{}};
  const permission=s.ebookPermissions.body;
  if(body.family&&!['serif','sans-serif','monospace'].includes(body.family))p.ebook.options.embeddedFont={family:body.family,licenseConfirmed:permission?.licenseConfirmed===true};
  else {delete p.ebook.options.embeddedFont;p.ebook.options.font=body.family==='sans-serif'?'sans-serif':'serif';}
  p.ebook.options.chapterStyle=ebookAppearance(s,{...body,...s.chapters},['body','chapters']);
  p.style.specialText={};
  for(const role of Object.keys(specialTextRoles) as SpecialTextRole[]){const a=resolveSharedAppearance(s,role);p.style.specialText[role]=sharedPrintAppearance(a,size,width);p.ebook.options.specialText![role]=ebookAppearance(s,a,['body','roles/'+role]);}
  p.specialTextVariants=p.specialTextVariants?.map(v=>{const a=resolveSharedAppearance(s,v.role,v.id);return {...v,treatments:{print:sharedPrintAppearance(a,size,width),ebook:ebookAppearance(s,a,['body','roles/'+v.role,'variants/'+v.id])}};});
  p.ebook.options.regions=p.ebook.options.regions?.map(r=>{
    const key=passageStyleKey(r),validVariant=p.specialTextVariants?.find(v=>v.id===r.variantId&&v.role===r.role),a=resolveSharedAppearance(s,r.role,validVariant?.id,r.variantId&&!validVariant?undefined:key);
    return {...r,printStyle:sharedPrintAppearance(a,size,width),style:ebookAppearance(s,a,['body','roles/'+r.role,...(validVariant?['variants/'+validVariant.id]:[]),'passages/'+key])};
  });
  const chapter={...classicPrint,...p.production},c=s.chapters;
  p.production={...chapter,chapterItalic:c.italic??body.italic,chapterFont:c.family??body.family!,chapterSize:(c.size??chapter.chapterSize/size)*size,chapterAlign:c.alignment==='start'?'left':c.alignment==='end'?'right':c.alignment==='center'?'center':chapter.chapterAlign,chapterAbove:c.spaceAbove===undefined?chapter.chapterAbove:c.spaceAbove*size,chapterBelow:c.spaceBelow===undefined?chapter.chapterBelow:c.spaceBelow*size};
  return p;
}
