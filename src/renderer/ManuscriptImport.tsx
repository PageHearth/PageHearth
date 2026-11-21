import {useEffect,useRef,useState} from 'react';
import {initialImportMapping,type ImportMapping,type ImportPreview,type ImportRequest} from '../shared/manuscriptImport';
import {beginImportReview,emptyImportReview,settleImportReview,updateImportMapping,importReviewReady,importPreviewRequest,type ImportReviewState} from '../shared/importReview';
import {safeFileName} from '../shared/templateSafety';
import type {TemplateCreated} from '../shared/templateWorkflow';
export async function importRequest<T>(request:ImportRequest):Promise<T>{const reply=await window.pagehearth.manuscriptImport(request);if(!reply.ok)throw Error(reply.error.message);return reply.value as T;}
type Location={token:string;path:string};
type Step='source'|'structure'|'project';
export function ManuscriptImport({onCreate,onClose,onBack,onBusyChange}:{onCreate:(create:()=>Promise<TemplateCreated>)=>Promise<void>;onClose:()=>void;onBack:()=>void;onBusyChange:(busy:boolean)=>void}){
 const [review,setReview]=useState(emptyImportReview),authority=useRef(review),[step,setStep]=useState<Step>('source'),[stage,setStage]=useState(''),[error,setError]=useState(''),[encoding,setEncoding]=useState(false),[name,setName]=useState(''),[location,setLocation]=useState<Location|null>(null),[locationError,setLocationError]=useState(''),[keep,setKeep]=useState(true),[ack,setAck]=useState(false),[showSample,setShowSample]=useState(false);
 const live=useRef(true),session=useRef(''),epoch=useRef(0),creating=useRef(false),locationGeneration=useRef(0),heading=useRef<HTMLHeadingElement>(null);
 const preview=review.preview,mapping=review.mapping,ready=importReviewReady(review),busy=!!stage,nameError=(()=>{try{safeFileName(name.trim());return '';}catch(e){return (e as Error).message;}})();
 const eligible=ready&&!busy&&!nameError&&!!location&&(!preview!.diagnostics.some(d=>d.severity==='WARNING')||ack);
 function publish(value:ImportReviewState){authority.current=value;if(live.current)setReview(value);}
 useEffect(()=>{live.current=true;void importRequest<Location>({kind:'default-location'}).then(value=>{if(live.current&&locationGeneration.current===0)setLocation(value);}).catch(e=>{if(live.current)setLocationError(String(e));});return()=>{live.current=false;epoch.current++;if(session.current&&!creating.current)void importRequest({kind:'cancel',token:session.current}).catch(()=>{});};},[]);
 useEffect(()=>{heading.current?.focus();},[step]);
 async function analyze(token:string,version:number){
  while(live.current&&version===epoch.current){
   try{const result=await importRequest<any>({kind:'poll',token});if(!live.current||version!==epoch.current)return;
    if(result.stage==='ready'){const owner=beginImportReview(authority.current,token,initialImportMapping());publish(settleImportReview(owner,owner,{preview:result.preview}));setName(result.preview.source.filename.replace(/\.[^.]+$/,'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'').slice(0,120));setStage('');return;}
    if(result.stage==='error'){setError(result.message);setEncoding(!!result.encoding);setStage('');return;}
   }catch(e){if(live.current&&version===epoch.current){setError((e as Error).message);setStage('');}return;}
   await new Promise(resolve=>setTimeout(resolve,400));
  }
 }
 async function choose(){const version=++epoch.current;setError('');setStage('Reading source…');try{const value=await importRequest<{token:string}|null>({kind:'choose'});if(!live.current||version!==epoch.current){if(value)void importRequest({kind:'cancel',token:value.token}).catch(()=>{});return;}if(!value){setStage('');return;}
  session.current=value.token;publish(emptyImportReview(authority.current.revision+1));setAck(false);setShowSample(false);setEncoding(false);setName('');setStage('Analyzing structure…');void analyze(value.token,version);
 }catch(e){if(live.current&&version===epoch.current){setError((e as Error).message);setStage('');}}}
 async function remap(next:ImportMapping,page=0,sample?:string){const owner=beginImportReview(authority.current,session.current,next);publish(owner);setError('');setAck(false);
  try{const value=await importRequest<ImportPreview>(importPreviewRequest(owner.token,next,page,sample));if(live.current)publish(settleImportReview(authority.current,owner,{preview:value}));}
  catch(e){if(live.current)publish(settleImportReview(authority.current,owner,{error:(e as Error).message}));}
 }
 function change(patch:Partial<ImportMapping>){void remap(updateImportMapping(authority.current.mapping,patch));}
 async function changeLocation(){const revision=++locationGeneration.current;setLocationError('');try{const value=await importRequest<Location|null>({kind:'location'});if(live.current&&revision===locationGeneration.current&&value)setLocation(value);}catch(e){if(live.current)setLocationError((e as Error).message);}}
 async function create(){if(!eligible)return;creating.current=true;setStage('Creating project…');setError('');onBusyChange(true);try{const current=authority.current;await onCreate(()=>importRequest({kind:'create',token:current.token,mapping:current.mapping,location:location!.token,name,keepSource:keep,acknowledged:ack}));session.current='';onClose();}catch(e){if(live.current)setError((e as Error).message);}finally{creating.current=false;onBusyChange(false);if(live.current)setStage('');}}
 const diagnostics=preview?.diagnostics||[];
 return <section aria-label="Import Existing Manuscript" className="manuscript-import">
  <p className="import-steps" aria-label="Import progress">{(['source','structure','project'] as const).map((value,i)=><span key={value} aria-current={step===value?'step':undefined}>{i+1} {['Source','Structure','Project'][i]}</span>)}</p>
  <h3 ref={heading} tabIndex={-1}>{step==='source'?'Source':step==='structure'?'Structure & Preview':'Project Details'}</h3>
  <div className="import-content">
   {stage&&<p role="status">{stage}</p>}{error&&<p id="import-error" role="alert">{error}</p>}
   {step==='source'&&<><p>Creates a new project without changing the source. DOCX is preferred. Also supports TXT, Markdown, HTML, EPUB and PDF — Best Effort.</p><button type="button" disabled={busy} onClick={()=>void choose()}>{preview?'Change Source…':'Choose Source…'}</button>{preview&&<p>{preview.source.filename} · {preview.source.bytes.toLocaleString()} bytes</p>}
    {encoding&&<label>Text decoding<select disabled={busy} defaultValue="" onChange={async e=>{const version=++epoch.current;setStage('Analyzing structure…');setError('');try{await importRequest({kind:'encoding',token:session.current,encoding:e.target.value as 'windows-1252'|'utf-8'});void analyze(session.current,version);}catch(e){if(live.current){setError((e as Error).message);setStage('');}}}}><option value="" disabled>Choose encoding</option><option value="windows-1252">Older Windows text (Windows-1252)</option><option value="utf-8">UTF-8</option></select></label>}
   </>}
   {step==='structure'&&preview&&<><p>{preview.source.filename}{preview.encoding?' · '+preview.encoding:''}{preview.quality?' · PDF Best Effort — '+preview.quality:''}</p>
    <div className="template-fields"><label>Chapter structure<select aria-describedby={review.error?'import-mapping-error':undefined} value={mapping.chapter} onChange={e=>change({chapter:e.target.value})}>{preview.strategies.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label><label>Scene structure<select disabled={mapping.chapter==='single'} value={mapping.scene} onChange={e=>change({scene:e.target.value})}><option value="none">No Scene mapping</option>{preview.strategies.filter(s=>s.id!=='single'&&s.id!==mapping.chapter&&!(mapping.chapter.startsWith('h')&&s.id.startsWith('h')&&Number(s.id.slice(1))<=Number(mapping.chapter.slice(1)))).map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
    {(mapping.chapter==='separator'||mapping.scene==='separator')&&<label>Custom separator<input value={mapping.separator} maxLength={100} aria-describedby={review.error?'import-mapping-error':undefined} onChange={e=>change({separator:e.target.value})}/></label>}</div>
    <label><input type="checkbox" checked={mapping.includeEmpty} onChange={e=>change({includeEmpty:e.target.checked})}/>Include empty structural sections</label>
    {review.status==='pending'&&<p role="status">Building preview…</p>}{review.error&&<p role="alert" id="import-mapping-error">{review.error}</p>}
    {review.status==='valid'&&<><p>{preview.chapters} Chapters · {preview.scenes} Scenes · {preview.words.toLocaleString()} converted words · {preview.sourceWords.toLocaleString()} source-analysis words</p>
     <div className="template-actions"><button type="button" onClick={()=>void remap({...mapping,excluded:[]})}>Include All</button><button type="button" onClick={()=>void remap({...mapping,excluded:[...new Set([...mapping.excluded,...preview.sections.map(s=>s.key)])]},preview.page)}>Exclude This Page</button><button type="button" aria-expanded={showSample} aria-controls="import-sample" onClick={()=>setShowSample(v=>!v)}>{showSample?'Hide Preview':'Show Preview'}</button></div>
     <ul aria-label="Import structure preview">{preview.sections.map(s=><li key={s.key} className={s.kind==='Scene'?'import-scene':''}><label><input type="checkbox" checked={s.included} onChange={e=>void remap({...mapping,excluded:e.target.checked?mapping.excluded.filter(k=>k!==s.key):[...mapping.excluded,s.key]},preview.page)}/>{s.kind}: {s.title} · {s.words} words {s.advisory&&`· ${s.advisory}`}</label><button type="button" onClick={()=>{setShowSample(true);void remap(mapping,preview.page,s.key);}}>Preview {s.title}</button></li>)}</ul>
     <div className="template-actions"><button type="button" disabled={!preview.page} onClick={()=>void remap(mapping,preview.page-1)}>Previous sections</button><button type="button" disabled={(preview.page+1)*50>=preview.totalSections} onClick={()=>void remap(mapping,preview.page+1)}>Next sections</button></div>
     {showSample&&<pre id="import-sample" className="import-sample" aria-label="Selected section sample">{preview.sample}</pre>}
    </>}
    <section aria-label="Import limitations"><h4>Review limitations</h4>{diagnostics.length?diagnostics.map((d,i)=><p key={i}><strong>{d.severity}</strong>: {d.message} {d.location}</p>):<p>No detected source limitations.</p>}</section>
   </>}
   {step==='project'&&preview&&<form id="import-project-form" onSubmit={e=>{e.preventDefault();void create();}}><div className="template-fields"><label>Project Name<input autoComplete="off" required value={name} maxLength={120} aria-invalid={!!nameError} aria-describedby={nameError?'import-name-error':undefined} onChange={e=>{setName(e.target.value);setError('');}}/></label>{nameError&&<p id="import-name-error">{nameError}</p>}<label>Location<input readOnly value={location?.path||''} aria-describedby="import-location-help"/></label></div><p id="import-location-help">Parent directory for the new project.</p><button type="button" disabled={busy} onClick={()=>void changeLocation()}>Change Location…</button>{locationError&&<p role="alert">{locationError}</p>}
    <label><input type="checkbox" checked={keep} onChange={e=>setKeep(e.target.checked)}/>Keep a copy of the original source in this PageHearth project ({preview.source.bytes.toLocaleString()} bytes)</label><p>{preview.chapters} Chapters · {preview.scenes} Scenes · {preview.words.toLocaleString()} words</p>
    {diagnostics.some(d=>d.severity==='WARNING')&&<><p>{diagnostics.filter(d=>d.severity==='WARNING').length} source limitations require acknowledgment. Use Back to review details.</p><label><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>I understand these limitations and want to continue.</label></>}
   </form>}
  </div>
  <footer><button type="button" disabled={busy} onClick={()=>step==='source'?onBack():setStep(step==='project'?'structure':'source')}>{step==='source'?'Back to New Project':'Back'}</button><button type="button" disabled={creating.current} onClick={onClose}>Cancel Import</button>{step!=='project'?<button type="button" className="primary" disabled={busy||(step==='source'?!preview:!ready)} key="next" onClick={e=>{e.preventDefault();setStep(step==='source'?'structure':'project');}}>Next</button>:<button key="import" type="submit" form="import-project-form" className="primary" disabled={!eligible}>Import Manuscript</button>}</footer>
 </section>;
}
