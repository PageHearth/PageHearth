import {validateSpecialTextStyles,type SpecialTextStyle} from './specialText.js';
import {ebookRoleStyle,validateEbookRoleStyle,type EbookRoleStyle,type EbookRoleStyles} from './ebookStyles.js';
import {validSpecialRegionId,validSpecialText,type SpecialTextRole} from './specialText.js';
import {editPublication,type PublicationPlan} from './publication.js';
import type {Project} from './model.js';
/** Shared project-local identity with independently configured format treatments. */
export type PublicationVariant={id:string;role:SpecialTextRole;name:string;treatments:{ebook:EbookRoleStyle;print?:SpecialTextStyle}};
export function validateVariants(value:unknown):asserts value is PublicationVariant[]{
 if(!Array.isArray(value)||value.length>2048)throw Error('Invalid publication variants.');
 const ids=new Set<string>();for(const v of value){if(!v||!validSpecialRegionId(v.id)||ids.has(v.id)||!validSpecialText(v.role)||typeof v.name!=='string'||!v.name.trim()||v.name.length>120||/[\x00-\x1f]/.test(v.name)||!v.treatments||Object.keys(v.treatments).some(k=>!['ebook','print'].includes(k)))throw Error('Invalid publication variant.');ids.add(v.id);validateEbookRoleStyle(v.treatments.ebook);if(v.treatments.print!==undefined)validateSpecialTextStyles({[v.role]:v.treatments.print});}
}
export function findVariant(variants:readonly PublicationVariant[]|undefined,id:string|undefined,role:SpecialTextRole){const matches=variants?.filter(v=>v.id===id&&v.role===role);return matches?.length===1?matches[0]:undefined;}
export function variantBase(role:SpecialTextRole,styles:EbookRoleStyles|undefined,variants:readonly PublicationVariant[]|undefined,id?:string):EbookRoleStyle{return {...ebookRoleStyle(role,styles),...findVariant(variants,id,role)?.treatments.ebook};}
export function createVariant(project:Project,role:SpecialTextRole,name:string,copyId?:string){const id=crypto.randomUUID();return {id,project:editPublication(project,p=>{const copy=copyId?findVariant(p.specialTextVariants,copyId,role):undefined;if(copyId&&!copy)throw Error('Style variant is no longer available.');(p.specialTextVariants??=[]).push({id,role,name:name.trim(),treatments:copy?structuredClone(copy.treatments):{ebook:{}}});})};}
export function editVariant(project:Project,id:string,patch:{name?:string;style?:EbookRoleStyle;print?:SpecialTextStyle|null}){return editPublication(project,p=>{const v=p.specialTextVariants?.find(v=>v.id===id);if(!v)throw Error('Style variant is no longer available.');if(patch.name!==undefined)v.name=patch.name.trim();if(patch.style!==undefined)v.treatments.ebook=patch.style;if(patch.print===null)delete v.treatments.print;else if(patch.print!==undefined)v.treatments.print=patch.print;});}
export function variantUsage(plan:PublicationPlan,id:string){return (plan.ebook.options?.regions??[]).filter(r=>r.variantId===id).length;}
/** Explicit deletion returns affected passages to role default, including removing
 * one-off overrides; the confirmation explains this. Canonical prose is untouched. */
export function deleteVariant(project:Project,id:string){return editPublication(project,p=>{if(p.bookStyle){delete p.bookStyle.variants[id];delete p.bookStyle.ebookPermissions['variants/'+id];for(const r of p.ebook.options?.regions??[])if(r.variantId===id){const key=[r.sourceKind,r.sourceId,r.regionId,r.role].join(':');delete p.bookStyle.passages[key];delete p.bookStyle.ebookPermissions['passages/'+key];}}p.specialTextVariants=p.specialTextVariants?.filter(v=>v.id!==id);if(p.ebook.options?.regions)p.ebook.options.regions=p.ebook.options.regions.filter(r=>r.variantId!==id);});}
