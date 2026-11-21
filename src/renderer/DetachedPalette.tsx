import {useEffect,useState} from 'react';
import type {Project} from '../shared/model';
import {commandForInput,type CommandId,type Keybindings} from '../shared/commands';
import {CommandPalette} from './CommandPalette';
import {beginTransientOverlay} from './transientOverlay';
/** Detached windows expose only routes main explicitly permits. No WRITE ownership. */
export function DetachedPalette({project,workspace}:{project:Project;workspace:string}){
 const [origin,setOrigin]=useState<HTMLElement|null|undefined>(),[bindings,setBindings]=useState<Keybindings>({}),[recent,setRecent]=useState<CommandId[]>([]),[failure,setFailure]=useState('');
 useEffect(()=>{const update=(s:Awaited<ReturnType<typeof window.pagehearth.paletteSettings>>)=>{if(s){setBindings(s.keybindings||{});setRecent(s.recentCommands||[]);}};void window.pagehearth.paletteSettings().then(update).catch(()=>{});return window.pagehearth.onSettings(update);},[]);
 useEffect(()=>{const open=()=>{if(document.querySelector('dialog[open],[aria-modal="true"]'))return;const target=document.activeElement as HTMLElement;beginTransientOverlay();setOrigin(target);void window.pagehearth.paletteSettings().then(s=>{if(s){setBindings(s.keybindings||{});setRecent(s.recentCommands||[]);}}).catch(()=>{});};const stop=window.pagehearth.onCommand(c=>{if(c.kind==='command-palette')open();});const key=(e:KeyboardEvent)=>{if(commandForInput({key:e.key,control:e.ctrlKey,alt:e.altKey,shift:e.shiftKey,meta:e.metaKey,isComposing:e.isComposing},bindings)==='command-palette'){e.preventDefault();open();}};window.addEventListener('keydown',key);return()=>{stop();window.removeEventListener('keydown',key);};},[bindings]);
 if(origin===undefined)return failure?<p role="alert">{failure}<button onClick={()=>setFailure('')}>Dismiss</button></p>:null;
 return <CommandPalette origin={origin} bindings={bindings} recent={recent} onClose={()=>setOrigin(undefined)} context={{project:!!project,workspace,detached:true,manuscript:false,selection:false,singleDocument:false,busy:false,composing:false,focus:false,typewriter:false,revisionActive:false,revisionVisible:false,revisionAll:false,split:false,locked:false,undo:false,redo:false,tree:false,inspector:false,pages:false}} onExecute={async id=>{try{setFailure('');const result=await window.pagehearth.paletteDetached(id);if(['completed','opened'].includes(result.status))setRecent(await window.pagehearth.paletteRecent(id));return result;}catch(e){setFailure('Command could not finish: '+String(e));return {status:'failed'};}}}/>;
}
