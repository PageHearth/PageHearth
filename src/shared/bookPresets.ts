import type {PublicationPlan} from './publication.js';
import {validatePublication} from './publication.js';
import {publicationRenderPlan} from './publicationStyleAdapter.js';
import type {PublicationAppearance} from './publicationStyle.js';

/** Explicit starting values only. Existing projects are never restyled on read. */
export const bookPresets = [
 {id:'classic',name:'Classic',description:'Traditional indented paragraphs and balanced, centered headings.',size:1,line:1.4,indent:12/11,space:0,align:'justify',chapter:2,chapterItalic:false,above:36/11,below:24/11},
 {id:'modern',name:'Modern',description:'Flush-left, open paragraphs with a modest left-aligned heading.',size:11.5/11,line:1.5,indent:0,space:.8,align:'start',chapter:1.6,chapterItalic:false,above:1.5,below:1.8},
 {id:'literary',name:'Literary',description:'Indented serif prose beneath a generous, italic chapter opening.',size:1,line:1.5,indent:1.5,space:0,align:'justify',chapter:2.7,chapterItalic:true,above:5,below:3},
 {id:'compact',name:'Compact',description:'Full-size body text, closer lines and a compact chapter opening.',size:1,line:1.2,indent:.9,space:0,align:'justify',chapter:1.6,chapterItalic:false,above:1.5,below:1.1},
 {id:'spacious',name:'Spacious',description:'Larger body text, relaxed lines and generous centered headings.',size:12/11,line:1.65,indent:1.25,space:.25,align:'justify',chapter:2.4,chapterItalic:false,above:4,below:2.8},
] as const;
export type BookPresetId=typeof bookPresets[number]['id'];
export function presetAppearance(id:string):{body:PublicationAppearance;chapters:PublicationAppearance & {spaceAbove:number;spaceBelow:number}}{
 const p=bookPresets.find(p=>p.id===id);if(!p)throw Error('Choose a supported Base Style.');
 // Generic serif uses the existing bundled Print default and reader-safe EPUB family.
 // Differentiation must not depend on fonts installed on a particular computer.
 return {body:{family:'serif',size:p.size,lineHeight:p.line,alignment:p.align,italic:false,indent:p.indent,paragraphSpace:p.space},chapters:{family:'serif',size:p.chapter,alignment:id==='modern'?'start':'center',italic:p.chapterItalic,spaceAbove:p.above,spaceBelow:p.below}};
}
export function applyBookPreset(plan:PublicationPlan,id:string):PublicationPlan {
 if(!plan.bookStyle)throw Error('Review and adopt the shared Book Style before applying a preset.');
 const next=structuredClone(plan),p=bookPresets.find(p=>p.id===id);if(!p)throw Error('Choose a supported Base Style.');
 const values=presetAppearance(id);next.style.id=p.id;next.style.name=p.name;
 next.bookStyle!.body=values.body;next.bookStyle!.chapters=values.chapters;
 // Reset only font policy owned by the replaced layers; preserve every Special Text layer.
 delete next.bookStyle!.ebookPermissions.body;delete next.bookStyle!.ebookPermissions.chapters;
 validatePublication(next);return next;
}
export function presetCustomized(plan:PublicationPlan):boolean|undefined {
 if(!bookPresets.some(p=>p.id===plan.style.id))return undefined;
 if(!plan.bookStyle)return undefined;
 const current=publicationRenderPlan(plan),base=publicationRenderPlan(applyBookPreset(plan,plan.style.id));
 const equal=(a:unknown,b:unknown)=>a===b||typeof a==='number'&&typeof b==='number'&&Math.abs(a-b)<1e-7;
 return (['font','sizePt','lineHeight','alignment','italic','indentPt','paragraphSpacePt'] as const).some(k=>!equal(current.style.print[k],base.style.print[k]))||(['chapterFont','chapterSize','chapterAlign','chapterAbove','chapterBelow','chapterItalic'] as const).some(k=>!equal(current.production?.[k]??(k==='chapterItalic'?false:undefined),base.production?.[k]));
}
export const presetSnapshot=(p:PublicationPlan)=>JSON.stringify({id:p.style.id,name:p.style.name,body:p.bookStyle?.body,chapters:p.bookStyle?.chapters,bodyPermission:p.bookStyle?.ebookPermissions.body,chapterPermission:p.bookStyle?.ebookPermissions.chapters});
/** Restore only fields replaced by the preset, refusing stale history. */
export function restoreBookPreset(current:PublicationPlan,before:PublicationPlan,expected:string):PublicationPlan {
 if(!current.bookStyle||!before.bookStyle||presetSnapshot(current)!==expected)throw Error('Book Style changed since the preset was applied. The previous style cannot safely replace it.');
 const p=structuredClone(current);p.style.id=before.style.id;p.style.name=before.style.name;
 p.bookStyle!.body=structuredClone(before.bookStyle.body);p.bookStyle!.chapters=structuredClone(before.bookStyle.chapters);
 for(const k of ['body','chapters']){const permission=before.bookStyle.ebookPermissions[k];if(permission)p.bookStyle!.ebookPermissions[k]=structuredClone(permission);else delete p.bookStyle!.ebookPermissions[k];}
 validatePublication(p);return p;
}
