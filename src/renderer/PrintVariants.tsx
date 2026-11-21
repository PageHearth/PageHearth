import {useEffect,useState} from 'react';
import type {Project} from '../shared/model';
import {readPublication} from '../shared/publication';
import {compilePublication} from '../shared/publicationCompiler';
import {ebookRegions,matchingOverride,setEbookRegionVariant} from '../shared/ebookRegions';
import {setPrintRegionStyle} from '../shared/printVariants';
import {specialTextRoles,type SpecialTextRole} from '../shared/specialText';
import {PublicationVariants} from './PublicationVariants';
import {PrintStyleFields} from './PrintStyleFields';
import {PublishCheck} from './PublishCheck';
export function PrintVariants({project,onChange}:{project:Project;onChange:(p:Project)=>void}){
 const [role,setRole]=useState<SpecialTextRole>('letter'),[selected,setSelected]=useState(''),[error,setError]=useState(''),[fonts,setFonts]=useState([{family:'Libertinus Serif',available:true}]);
 useEffect(()=>{void window.pagehearth.printFonts().then(setFonts).catch(()=>{});},[]);
 const plan=readPublication(project),regions=ebookRegions(compilePublication(project,'print')),region=regions.find(r=>r.key===selected),assignment=region?matchingOverride(region,regions,plan.ebook.options?.regions):undefined,variant=plan.specialTextVariants?.find(v=>v.id===assignment?.variantId&&v.role===region?.role);
 const apply=(fn:()=>Project)=>{try{onChange(fn());setError('');}catch(e){setError(String(e));}};
 return <details><summary>Named Special Text variants and passages</summary><p>Variant identity and passage assignments are shared. Print and eBook treatments remain independent.</p>{error&&<p role="alert">{error}</p>}<label>Variant role<select aria-label="Variant role" value={role} onChange={e=>setRole(e.target.value as SpecialTextRole)}>{Object.entries(specialTextRoles).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><PublicationVariants key={project.manifest.id+role} project={project} role={role} fonts={fonts} onChange={onChange}/><details><summary>Selected Print passage</summary><label>Print passage<select aria-label="Print passage" value={region?.key||''} onChange={e=>setSelected(e.target.value)}><option value="">Choose a passage</option>{regions.map(r=><option key={r.key} value={r.key}>{r.title} — {r.excerpt}</option>)}</select></label>{region&&<><label>Style variant<select aria-label="Style variant" value={assignment?.variantId||''} onChange={e=>apply(()=>setEbookRegionVariant(project,region.key,e.target.value||undefined))}><option value="">{specialTextRoles[region.role]} default</option>{plan.specialTextVariants?.filter(v=>v.role===region.role).map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label><fieldset><legend>This passage — Print only</legend><PublishCheck checked={!!assignment?.printStyle} onChange={e=>apply(()=>setPrintRegionStyle(project,region.key,e.target.checked?{}:undefined))}>Override this region</PublishCheck>{assignment?.printStyle?<PrintStyleFields plan={plan} role={region.role} style={assignment.printStyle} base={variant?.treatments.print} fonts={fonts} onChange={s=>apply(()=>setPrintRegionStyle(project,region.key,s))}/>:<p>Following {variant?.name||specialTextRoles[region.role]} Print treatment.</p>}</fieldset></>}</details></details>;
}
