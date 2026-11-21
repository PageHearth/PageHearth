import {PublishCheck} from './PublishCheck';
import {SelectedEbookStyle} from './SelectedEbookStyle';
import {PublicationVariants} from './PublicationVariants';
import {createVariant} from '../shared/publicationVariants';
import {ModalCard} from './ModalCard';

import type {Project} from '../shared/model';

import {compilePublication} from '../shared/publicationCompiler';

import {ebookRegions,matchingOverride,setEbookRegionVariant} from '../shared/ebookRegions';

import {EbookStyleFields} from './EbookStyleFields';

import {specialTextRoles,type SpecialTextRole} from '../shared/specialText';

import React,{useEffect,useState} from 'react';

import type {PublicationPlan} from '../shared/publication';

import {defaultEbookOptions,type EbookOptions} from '../shared/ebookProduction';

export default function EbookControls({plan,update,project,onChange}:{project:Project;onChange:(p:Project)=>void;plan:PublicationPlan;update:(fn:(p:PublicationPlan)=>void)=>void}){

 const options=plan.ebook.options??defaultEbookOptions,[fonts,setFonts]=useState<{family:string;available:boolean}[]>([]);

 useEffect(()=>{let live=true;void window.pagehearth.printFonts().then(f=>{if(live)setFonts(f);}).catch(()=>{});return()=>{live=false;};},[]);

 const [creating,setCreating]=useState(false),[variantName,setVariantName]=useState('');
 useEffect(()=>{setSelected('');setCreating(false);},[project.manifest.id]);
 const [selected,setSelected]=useState(''),[error,setError]=useState('');const regions=ebookRegions(compilePublication(project,'ebook')),region=regions.find(r=>r.key===selected),override=region?matchingOverride(region,regions,options.regions):undefined;

 const set=(edit:(p:EbookOptions)=>void)=>update(p=>{p.ebook.options={...(p.ebook.options??defaultEbookOptions)};edit(p.ebook.options);});

 return <details open><summary>eBook style</summary><label>Body font<select value={options.font} onChange={e=>set(o=>{o.font=e.target.value as EbookOptions['font'];})}><option value="reader-default">Reader default</option><option value="serif">Generic serif</option><option value="sans-serif">Generic sans serif</option></select></label><label>Scene boundaries<select aria-label="Scene boundaries" value={options.sceneBoundary??'space'} onChange={e=>set(o=>{o.sceneBoundary=e.target.value as EbookOptions['sceneBoundary'];})}><option value="none">None</option><option value="space">Whitespace</option><option value="ornament">Simple ornament</option></select></label><label>Paragraph style<select value={options.paragraphs} onChange={e=>set(o=>{o.paragraphs=e.target.value as EbookOptions['paragraphs'];})}><option value="indented">First-line indent</option><option value="spaced">Space between paragraphs</option></select></label><label>Optional embedded font<select value={options.embeddedFont?.family||''} onChange={e=>set(o=>{if(e.target.value)o.embeddedFont={family:e.target.value,licenseConfirmed:false};else delete o.embeddedFont;})}><option value="">None — use reader fonts</option>{fonts.filter(f=>f.available).map(f=><option key={f.family}>{f.family}</option>)}</select></label><small>Make sure you have the appropriate rights or permission to use selected fonts in your intended output.</small><label>Distribution profile<select value={options.profile} onChange={e=>set(o=>{o.profile=e.target.value as EbookOptions['profile'];})}><option value="generic">Generic EPUB 3.3</option>{[['kindle','Kindle'],['apple','Apple Books'],['kobo','Kobo'],['google','Google Play Books'],['ingram','Ingram eBook']].map(([id,title])=><option key={id} value={id}>{title} — unqualified</option>)}</select></label><details><summary>Special Text</summary>{Object.entries(specialTextRoles).map(([key,label])=>{const role=key as SpecialTextRole;return <details key={role}><summary>{label}</summary><EbookStyleFields style={options.specialText?.[role]??{}} fonts={fonts} onChange={value=>set(o=>{o.specialText={...o.specialText,[role]:value};})}/><button onClick={()=>set(o=>{o.specialText={...o.specialText};delete o.specialText[role];})}>Reset {label} to default</button><PublicationVariants key={project.manifest.id+role} project={project} role={role} fonts={fonts} onChange={onChange}/></details>;})}</details><details><summary>Selected Special Text</summary>{error&&<p role="alert">{error}</p>}<label>Passage<select aria-label="Passage" value={region?.key??''} onChange={e=>setSelected(e.target.value)}><option value="">Choose a passage</option>{regions.map(r=><option key={r.key} value={r.key}>{r.title} — {specialTextRoles[r.role]} — {r.excerpt||'Empty passage'}</option>)}</select></label>{region&&<><label>Style variant<select aria-label="Style variant" value={override?.variantId??''} onChange={e=>{try{onChange(setEbookRegionVariant(project,region.key,e.target.value||undefined));setError('');}catch(err){setError(String(err));}}}><option value="">{specialTextRoles[region.role]} default</option>{override?.variantId&&!plan.specialTextVariants?.some(v=>v.id===override.variantId&&v.role===region.role)&&<option value={override.variantId}>Unavailable — using role default</option>}{plan.specialTextVariants?.filter(v=>v.role===region.role).map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label><button onClick={()=>{setVariantName('');setCreating(true);}}>Create variant for this passage</button><SelectedEbookStyle key={project.manifest.id+region.key} project={project} region={region} assignment={override} fonts={fonts} onChange={onChange}/>{creating&&<ModalCard label="Create style variant" onClose={()=>setCreating(false)}><form onSubmit={e=>{e.preventDefault();try{const result=createVariant(project,region.role,variantName);onChange(setEbookRegionVariant(result.project,region.key,result.id));setCreating(false);setError('');}catch(err){setError(String(err));}}}><h3>Create style variant</h3><label>Name<input autoFocus maxLength={120} value={variantName} onChange={e=>setVariantName(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<button type="button" onClick={()=>setCreating(false)}>Cancel</button><button disabled={!variantName.trim()} type="submit">Create and assign</button></form></ModalCard>}</>}</details><p>Reader overrides remain available. Retailer acceptance requires review.</p></details>;

}
