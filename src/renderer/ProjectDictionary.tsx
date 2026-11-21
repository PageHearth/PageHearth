import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {changeDictionary,resolveVocabulary} from '../shared/spelling';
import type {Project} from '../shared/model';
import {spellService} from './spellService';
import {setDictionaryAction} from './spellingContext';

export function useProjectSpelling(project:Project|null,onChange:(project:Project)=>void){
 const latest=useRef({project,onChange});latest.current={project,onChange};
 useLayoutEffect(()=>{spellService.update(project);},[project]);
 useEffect(()=>{setDictionaryAction(word=>{const {project,onChange}=latest.current;if(project)onChange(changeDictionary(project,word,'add'));});return ()=>setDictionaryAction(null);},[]);
}
export function ProjectDictionary({project,onChange,onClose}:{project:Project;onChange:(p:Project)=>void;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),[query,setQuery]=useState(''),[word,setWord]=useState(''),[error,setError]=useState(''),[caseSensitive,setCaseSensitive]=useState(false);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();return ()=>previous?.focus();},[]);
 const snapshot=resolveVocabulary(project.manifest.id,project.author),match=(s:string)=>s.toLocaleLowerCase().includes(query.toLocaleLowerCase());
 function change(spelling:string,action:'add'|'remove'|'case',sensitive=caseSensitive){try{onChange(changeDictionary(project,spelling,action,sensitive));setError('');if(action==='add')setWord('');}catch(e){setError(String(e));}}
 const manual=project.author.projectDictionary?.entries||[];
 const sources=new Map<string,{id:string;spelling:string;caseSensitive?:boolean}>();for(const entry of snapshot.entries)for(const source of entry.sources)if(source.type==='glossary')sources.set(source.id+'\0'+source.spelling,source);
 return <dialog ref={dialog} className="project-dictionary" aria-labelledby="dictionary-title" onCancel={onClose}>
  <h2 id="dictionary-title">Project Dictionary</h2><p>Used by this project. English (United States) spelling is checked locally. Phrases approve their individual words.</p>
  <label>Search <input value={query} onChange={e=>setQuery(e.target.value)}/></label>
  <form onSubmit={e=>{e.preventDefault();change(word,'add');}}><label>Add word or phrase <input value={word} maxLength={256} onChange={e=>setWord(e.target.value)}/></label><label><input type="checkbox" checked={caseSensitive} onChange={e=>setCaseSensitive(e.target.checked)}/> Case sensitive</label><button disabled={!word.trim()}>Add</button></form>
  {error&&<p role="alert">{error}</p>}<div className="dictionary-entries"><h3>Manual</h3>{!manual.length&&<p>No manual entries yet.</p>}
  {manual.filter(e=>match(e.spelling)).map(e=><div key={e.spelling}><span>{e.spelling}{snapshot.entries.some(t=>t.sources.some(s=>s.type==='manual'&&s.spelling===e.spelling)&&t.sources.some(s=>s.type==='glossary'))&&<small> · Also used by Glossary</small>}</span><label><input type="checkbox" aria-label={`Case sensitive: ${e.spelling}`} checked={e.caseSensitive===true} onChange={event=>change(e.spelling,'case',event.target.checked)}/> Case sensitive</label><button onClick={()=>change(e.spelling,'remove')} aria-label={`Remove ${e.spelling}`}>Remove</button></div>)}
  <h3>Glossary</h3><p>Read-only here. Edit names and aliases in the Glossary. Words with multiple sources stay accepted until all sources are removed.</p>
  {[...sources.values()].filter(e=>match(e.spelling)).map(e=><div key={e.id+e.spelling}>{e.spelling} <small>Glossary · {e.caseSensitive?'Case sensitive · ':''}{project.author.worldBible?.entities.find(x=>x.id===e.id)?.name}</small></div>)}
  </div><button onClick={onClose}>Close</button>
 </dialog>;
}
