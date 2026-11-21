import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {Editor} from '@tiptap/react';
import type {EditorState} from '@tiptap/pm/state';
import {fontSizes,parseFontSize} from '../shared/typography';
import {activeSize,sizeTransaction} from './typography';
export function FontSizePicker({editor,disabled,requestOpen=0}:{editor:Editor|null;disabled:boolean;requestOpen?:number}){
 const [open,setOpen]=useState(false),[value,setValue]=useState(''),[error,setError]=useState(''),[position,setPosition]=useState({left:8,top:8});
 const trigger=useRef<HTMLButtonElement>(null),popup=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null),saved=useRef<EditorState|null>(null),origin=useRef<HTMLElement|null>(null),signal=useRef(0);
 const current=editor?activeSize(editor.state):null;
 function close(restore=true){setOpen(false);saved.current=null;if(restore)origin.current?.focus();}
 function show(){if(!editor||disabled)return;saved.current=editor.state;const anchor=trigger.current?.getClientRects().length?trigger.current:trigger.current?.closest('.editor-command-bar')?.querySelector<HTMLElement>('[aria-label="More editor actions"]');origin.current=anchor??null;const box=anchor?.getBoundingClientRect();setPosition({left:Math.max(8,Math.min(box?.left??8,window.innerWidth-260)),top:Math.max(8,Math.min(box?.bottom??8,window.innerHeight-300))});setValue(typeof current==='number'?String(current):'');setError('');setOpen(true);}
 useEffect(()=>{if(signal.current!==requestOpen){signal.current=requestOpen;show();}},[requestOpen]);
 useEffect(()=>{close(false);},[editor]);
 useEffect(()=>{if(!open)return;input.current?.focus();const outside=(event:PointerEvent)=>{if(!popup.current?.contains(event.target as Node)&&!trigger.current?.contains(event.target as Node))close(false);};const resize=()=>close();document.addEventListener('pointerdown',outside,true);window.addEventListener('resize',resize);return()=>{document.removeEventListener('pointerdown',outside,true);window.removeEventListener('resize',resize);};},[open]);
 function choose(points:number|null){const snapshot=saved.current;if(!editor||!snapshot)return;if(editor.isDestroyed||!editor.isEditable||snapshot.doc!==editor.state.doc){setError('The document changed. Close and select the text again.');return;}editor.view.dispatch(sizeTransaction(snapshot,points));close(false);editor.view.focus();}
 return <><button ref={trigger} className="font-size-trigger" disabled={disabled} title="Manuscript Font Size (points)" aria-label={'Font Size: '+(current??'Default')} aria-haspopup="dialog" aria-expanded={open} onClick={()=>open?close():show()}>{current??'Size'} ▾</button>{open&&createPortal(<div ref={popup} role="dialog" aria-label="Manuscript Font Size" className="size-popup" style={position} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}}}>
 <form onSubmit={event=>{event.preventDefault();const size=parseFontSize(value);if(size===null){setError('Enter 6–144 pt, with at most one decimal place.');return;}choose(size);}}><label>Font Size (pt)<input ref={input} aria-label="Custom font size" aria-describedby="font-size-help" aria-invalid={!!error} inputMode="decimal" value={value} onChange={event=>{setValue(event.target.value);setError('');}}/></label><button type="submit">Apply</button></form>
 <small id="font-size-help">6–144 pt; up to one decimal place.</small>{error&&<p role="alert">{error}</p>}
 <div className="size-presets" aria-label="Font size presets">{fontSizes.map(size=><button key={size} onClick={()=>choose(size)} aria-label={size+' pt'}>{size}</button>)}</div><button onClick={()=>choose(null)}>Default / Clear Size</button><button onClick={()=>close()}>Cancel</button>
 </div>,document.body)}</>;
}
