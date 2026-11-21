import {VariantPrintTreatment} from './VariantPrintTreatment';
import {PublishCheck} from './PublishCheck';
import React,{useState} from 'react';
import type {Project} from '../shared/model';
import type {EbookRegion,EbookRegionOverride} from '../shared/ebookRegions';
import {reuseEbookRegionOverride,setEbookRegionStyle} from '../shared/ebookRegions';
import {editVariant,findVariant,variantBase,variantUsage} from '../shared/publicationVariants';
import {ebookRoleStyle} from '../shared/ebookStyles';
import {specialTextRoles} from '../shared/specialText';
import {EbookStyleFields} from './EbookStyleFields';
import {ModalCard} from './ModalCard';

/** Keep shared typography and passage-only typography visibly distinct. */
export function SelectedEbookStyle({project,region,assignment,fonts,onChange}:{project:Project;region:EbookRegion;assignment?:EbookRegionOverride;fonts:{family:string;available:boolean}[];onChange:(p:Project)=>void}){
 const [confirm,setConfirm]=useState(false),[error,setError]=useState('');
 const plan=project.author.publication,options=plan?.ebook.options;
 const variant=findVariant(plan?.specialTextVariants,assignment?.variantId,region.role);
 const apply=(fn:()=>Project)=>{try{onChange(fn());setError('');return true;}catch(e){setError(String(e));return false;}};
 return <>
 {error&&<p role="alert">{error}</p>}
 {variant&&<details open className="ebook-shared-variant"><summary>Shared style: {variant.name}</summary><p>These settings change {variant.name} for all {variantUsage(plan!,variant.id)} assigned passages. These are eBook settings, not a one-off override.</p>{!Object.keys(variant.treatments.ebook).length&&<p>This variant has no custom properties yet; it inherits {specialTextRoles[region.role]} default.</p>}<h4>eBook treatment</h4><EbookStyleFields style={variant.treatments.ebook} inherited={ebookRoleStyle(region.role,options?.specialText)} fonts={fonts} onChange={style=>apply(()=>editVariant(project,variant.id,{style}))}/><VariantPrintTreatment project={project} variant={variant} fonts={fonts} onChange={next=>apply(()=>next)}/></details>}
 <fieldset className="ebook-region-override"><legend>This passage only</legend><PublishCheck checked={!!assignment?.style} onChange={e=>apply(()=>setEbookRegionStyle(project,region.key,e.target.checked?{}:undefined))}>Override this region</PublishCheck>
 {assignment?.style?<><p>Changes below affect only this passage. Changing the selected variant preserves these overrides.</p><EbookStyleFields style={assignment.style} inherited={variantBase(region.role,options?.specialText,plan?.specialTextVariants,assignment.variantId)} fonts={fonts} onChange={style=>apply(()=>setEbookRegionStyle(project,region.key,style))}/><button onClick={()=>apply(()=>setEbookRegionStyle(project,region.key,undefined))}>{variant?'Reset override':'Follow role default'}</button>{variant&&<button disabled={!Object.keys(assignment.style).length} onClick={()=>setConfirm(true)}>Use override for {variant.name}…</button>}</>:<p>Following {variant?.name??specialTextRoles[region.role]+' default'}.</p>}
 </fieldset>
 {confirm&&variant&&<ModalCard label="Reuse passage override" onClose={()=>setConfirm(false)}><h3>Update shared style “{variant.name}”?</h3><p>Copy this passage’s explicit override properties into {variant.name}. This updates the base style for {variantUsage(plan!,variant.id)} assigned passages and turns off this passage’s override. Other passages keep their deliberate one-off overrides. Prose is unchanged.</p>{error&&<p role="alert">{error}</p>}<button autoFocus onClick={()=>setConfirm(false)}>Cancel</button><button onClick={()=>{if(apply(()=>reuseEbookRegionOverride(project,region.key)))setConfirm(false);}}>Update shared style</button></ModalCard>}
 </>;
}
