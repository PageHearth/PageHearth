import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {Editor} from '@tiptap/react';
import type {EditorState} from '@tiptap/pm/state';
import {activeFont,fontTransaction} from './smartFont';
import {fallbackFontFamilies,normalizeFontFamilies,recentFontFamilies,fontGroups,cssFontFamily,type FontCatalog} from '../shared/fonts';
let cached:Promise<FontCatalog>|undefined;
function catalog(){return cached??=window.pagehearth?.fontCatalog?.().catch(()=>({families:fallbackFontFamilies,source:'fallback' as const,warning:'Installed font listing unavailable.'}))??Promise.resolve({families:fallbackFontFamilies,source:'fallback'});}
export function FontPicker({editor,disabled,requestOpen=0}:{editor:Editor|null;disabled:boolean;requestOpen?:number}){
 const [current,setCurrent]=useState<string|null>(null),[open,setOpen]=useState(false),[query,setQuery]=useState(''),[fonts,setFonts]=useState<FontCatalog>({families:[],source:'fallback'}),[index,setIndex]=useState(0),[error,setError]=useState(''),[position,setPosition]=useState({left:8,top:8});
 const [recent,setRecent]=useState<string[]>([]);
 const [favorites,setFavorites]=useState<string[]>([]),[favoriteBusy,setFavoriteBusy]=useState(false),[favoritesLoaded,setFavoritesLoaded]=useState(false);
 useEffect(()=>window.pagehearth?.onSettings?.(settings=>{setFavorites(normalizeFontFamilies(settings.favoriteFonts));setRecent(recentFontFamilies(settings.recentFonts));}),[]);
 const trigger=useRef<HTMLButtonElement>(null),popup=useRef<HTMLDivElement>(null),search=useRef<HTMLInputElement>(null),snapshot=useRef<EditorState|null>(null),origin=useRef<HTMLElement|null>(null),lastSignal=useRef(0);
 useEffect(()=>{if(!editor)return;const update=()=>setCurrent(activeFont(editor.state));update();editor.on('transaction',update);return()=>{editor.off('transaction',update);};},[editor]);
 // The editor subscription above owns this value. Mirroring it again after every
 // render schedules redundant passive updates during typing and page measurement.
 function close(restore=true){setOpen(false);snapshot.current=null;if(restore)origin.current?.focus();}
 function show(){if(!editor||disabled)return;snapshot.current=editor.state;const anchor=trigger.current?.getClientRects().length?trigger.current:trigger.current?.closest('.editor-command-bar')?.querySelector<HTMLElement>('[aria-label="More editor actions"]');origin.current=anchor||null;const box=anchor?.getBoundingClientRect();setPosition({left:Math.max(8,Math.min(box?.left||8,window.innerWidth-328)),top:Math.max(8,Math.min(box?.bottom||8,window.innerHeight-Math.min(420,window.innerHeight-16)))});setQuery('');setIndex(0);setError('');setOpen(true);void catalog().then(setFonts);setFavoritesLoaded(false);void (window.pagehearth?.appState?.()??Promise.resolve({settings:{favoriteFonts:[]}})).then(value=>{setFavorites(normalizeFontFamilies(value.settings.favoriteFonts));setRecent(recentFontFamilies((value.settings as import('../shared/preferences').AppSettings).recentFonts));setFavoritesLoaded(true);}).catch(()=>{setError('Font favorites could not be loaded. Font selection is still available.');});}
 useEffect(()=>{if(requestOpen!==lastSignal.current){lastSignal.current=requestOpen;show();}},[requestOpen]);
 useEffect(()=>{if(!open)return;search.current?.focus();const outside=(e:PointerEvent)=>{if(!popup.current?.contains(e.target as Node)&&!trigger.current?.contains(e.target as Node))close(false);};const resize=()=>close();document.addEventListener('pointerdown',outside,true);window.addEventListener('resize',resize);return()=>{document.removeEventListener('pointerdown',outside,true);window.removeEventListener('resize',resize);};},[open]);
 const available=current&&current!=='Mixed'&&fonts.source==='installed'?fonts.families.some(f=>f.toLocaleLowerCase()===current.toLocaleLowerCase()):true;
 const isFavorite=(family:string)=>favorites.some(value=>value.toLocaleLowerCase('en-US')===family.toLocaleLowerCase('en-US'));
 const groups=fontGroups(fonts.families,favorites,recent,current,query),pinned=groups.favorites,families=groups.all;
 const choices:[string,string|null][]=[['Default / Clear Font',null],...groups.recent.map(f=>[f,f] as [string,string]),...pinned.map(f=>[f,f] as [string,string]),...families.map(f=>[f,f] as [string,string])];
 async function toggleFavorite(family:string){if(favoriteBusy||!favoritesLoaded)return;setFavoriteBusy(true);try{const next=await window.pagehearth.favoriteFont(family,!isFavorite(family));setFavorites(next);setIndex(0);setError('');search.current?.focus();}catch{setError('Could not save font favorites. Font selection is still available.');}finally{setFavoriteBusy(false);}}
 const activeIndex=Math.min(index,choices.length-1);
 useEffect(()=>{popup.current?.querySelector('[data-font-index="'+activeIndex+'"]')?.scrollIntoView({block:'nearest'});},[activeIndex]);
 function choose(family:string|null){const saved=snapshot.current;if(!editor||!saved)return;if(editor.isDestroyed||!editor.isEditable||saved.doc!==editor.state.doc){setError('The document changed. Close and choose the text again.');return;}
   // Focus changes do not authorize applying an old range to a different document.
   const transaction=fontTransaction(saved,family);if(!transaction)return;
   transaction.setSelection(saved.selection.map(transaction.doc,transaction.mapping));if(saved.selection.empty)transaction.setStoredMarks(family===null?(saved.storedMarks??saved.selection.$from.marks()).filter(m=>m.type.name!=='textStyle'):[...(saved.storedMarks??saved.selection.$from.marks()).filter(m=>m.type.name!=='textStyle'),saved.schema.marks.textStyle.create({fontFamily:family})]);
   editor.view.dispatch(transaction);if(family)void window.pagehearth.recentFont(family).then(setRecent).catch(()=>{});close(false);editor.view.focus();
 }
 return <><button ref={trigger} className="smart-font-trigger" aria-label={'Font: '+(current||'Default')} title={(current||'Default (editor typography)')+(available?'':' — not in local font catalog')} aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={()=>open?close():show()}><span>{current||'Default'}</span> ▾</button>{open&&createPortal(<div ref={popup} className="font-popup" role="dialog" aria-label="Choose manuscript font" style={position} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setIndex(i=>Math.max(0,Math.min(choices.length-1,i+(e.key==='ArrowDown'?1:-1))));search.current?.focus();}else if(e.key==='Enter'&&e.target===search.current){e.preventDefault();choose(choices[activeIndex][1]);}}}>
   <label>Font<input ref={search} role="combobox" aria-label="Search fonts" aria-controls="font-options" aria-haspopup="grid" aria-expanded="true" aria-autocomplete="list" aria-activedescendant={'font-option-'+activeIndex} value={query} onChange={e=>{setQuery(e.target.value);setIndex(0);}}/></label>
   {fonts.families.length===0&&<small role="status">Loading local fonts…</small>}{fonts.warning&&<small>{fonts.warning}</small>}{!available&&<small>Stored family is not in this computer’s font catalog; its name is preserved.</small>}{error&&<p role="alert">{error}</p>}
   <small>Arrow keys browse; Enter applies. Tab reaches the highlighted font’s favorite control.</small>
   <div id="font-options" role="grid" aria-label="Font families">{choices.map(([label,value],i)=><div key={value||'default'} role="rowgroup">
    {i===1&&groups.recent.length>0&&<div className="font-section" role="presentation">Recently Used</div>}{i===1+groups.recent.length&&pinned.length>0&&<div className="font-section" role="presentation">Favorites</div>}{i===1+groups.recent.length+pinned.length&&families.length>0&&<div className="font-section" role="presentation">All Fonts</div>}
    <div role="row" id={'font-option-'+i} data-font-index={i} aria-selected={current===value} className={'font-row'+(activeIndex===i?' font-active':'')} onPointerMove={()=>setIndex(i)}>
     <div role="gridcell">{value&&<button className="font-favorite" type="button" tabIndex={activeIndex===i?0:-1} disabled={favoriteBusy||!favoritesLoaded} aria-label={(isFavorite(value)?'Remove ':'Add ')+value+(isFavorite(value)?' from favorites':' to favorites')} aria-pressed={isFavorite(value)} onClick={()=>void toggleFavorite(value)}>{isFavorite(value)?'★':'☆'}</button>}</div>
     <div role="gridcell" className="font-choice-cell"><button className="font-choice" type="button" tabIndex={-1} aria-label={label} title={label} onClick={()=>choose(value)}><span className="font-family-name">{label}</span>{value&&<span className="font-preview" aria-hidden="true" style={{fontFamily:cssFontFamily(value)+', serif'}}>Aa Bb 123</span>}{value&&fonts.source==='installed'&&!fonts.families.some(name=>name.toLocaleLowerCase()===value.toLocaleLowerCase())&&<small>Unavailable</small>}</button></div>
    </div></div>)}</div><button onClick={()=>close()}>Cancel</button>
 </div>,document.body)}</>;
}
