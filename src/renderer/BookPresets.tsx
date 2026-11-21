import {useState} from 'react';
import type {PublicationPlan} from '../shared/publication';
import {bookPresets,applyBookPreset,presetCustomized,presetSnapshot,restoreBookPreset} from '../shared/bookPresets';
export default function BookPresets({plan,onChange}:{plan:PublicationPlan;onChange:(p:PublicationPlan)=>void}){
 const [previous,setPrevious]=useState<{plan:PublicationPlan;expected:string}>(),[notice,setNotice]=useState('');
 const apply=(id:string)=>{const next=applyBookPreset(plan,id);setPrevious({plan:structuredClone(plan),expected:presetSnapshot(next)});onChange(next);setNotice(next.style.name+' applied. You can restore the previous style here until these settings change or you leave this workspace.');};
 const canRestore=!!previous&&presetSnapshot(plan)===previous.expected;
 return <details className="publication-base-style"><summary>Base Style · {plan.style.name}{presetCustomized(plan)?' · Customized':''}</summary>
 <p>Starting values for body text and chapter headings. Applying a preset replaces those adjustments. Special Text, scene breaks, page geometry and artwork stay unchanged. This is not your application Theme.</p>
 <details><summary>Compare starting styles</summary><dl>{bookPresets.map(p=><div key={p.id}><dt><strong>{p.name}</strong></dt><dd>{p.description}</dd></div>)}</dl><p>These styles use the existing serif family; no additional fonts are required. Final pagination depends on your book's geometry and content.</p></details>
 <label>Book Style<select aria-label="Book Style" disabled={!plan.bookStyle} value={plan.style.id} onChange={e=>apply(e.target.value)}>{!bookPresets.some(p=>p.id===plan.style.id)&&<option value={plan.style.id}>{plan.style.name}</option>}{bookPresets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
 {plan.bookStyle&&presetCustomized(plan)&&<button onClick={()=>apply(plan.style.id)}>Reapply {plan.style.name} starting values</button>}
 <p>{bookPresets.find(p=>p.id===plan.style.id)?.description}</p>{!plan.bookStyle&&<p>Review the existing Book Style above before applying a preset.</p>}
 {previous&&<button disabled={!canRestore} onClick={()=>{onChange(restoreBookPreset(plan,previous.plan,previous.expected));setPrevious(undefined);setNotice('Previous Book Style restored.');}}>Restore previous style</button>}{previous&&!canRestore&&<p>Book Style has changed. Restore is unavailable to protect those edits.</p>}{notice&&<p role="status">{notice}</p>}
 </details>;
}
