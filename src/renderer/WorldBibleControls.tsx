import React,{useEffect,useRef,useState} from 'react';
import type {FieldKind} from '../shared/worldBible';

export const FIELD_TYPE_LABELS:Record<FieldKind,string>={text:'Text',longText:'Long Text',entityReference:'Reference',number:'Number',boolean:'Yes / No',date:'Date',singleSelect:'Single Choice',multiSelect:'Multiple Choice',url:'Link',media:'Media'};
const PRIMARY_TYPES:FieldKind[]=['text','longText','entityReference'];
const ADVANCED_TYPES:FieldKind[]=['number','boolean','date','singleSelect','multiSelect','url'];

export function useTransientPopover(open:boolean,setOpen:React.Dispatch<React.SetStateAction<boolean>>,root:React.RefObject<HTMLElement|null>,trigger:React.RefObject<HTMLElement|null>){
  useEffect(()=>{if(!open)return;const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setOpen(false);trigger.current?.focus();}};window.addEventListener('pointerdown',outside);window.addEventListener('keydown',escape);return()=>{window.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',escape);};},[open,setOpen,root,trigger]);
}

export function FieldTypePicker({value,onChange,label='Type'}:{value:FieldKind;onChange:(value:FieldKind)=>void;label?:string}){
  const [advanced,setAdvanced]=useState(ADVANCED_TYPES.includes(value));
  const values=[...PRIMARY_TYPES,...(advanced?ADVANCED_TYPES:[])];
  return <div className="field-type-picker"><label>{label}<select value={value} onChange={event=>onChange(event.target.value as FieldKind)}>{values.map(kind=><option key={kind} value={kind}>{FIELD_TYPE_LABELS[kind]}</option>)}</select></label><button type="button" aria-expanded={advanced} onClick={()=>setAdvanced(value=>!value)}>{advanced?'Fewer Field Types':'More Field Types…'}</button></div>;
}

export function FieldDefinitionCreate({label,onLabel,kind,onKind,options,onOptions,onCreate}:{label:string;onLabel:(value:string)=>void;kind:FieldKind;onKind:(value:FieldKind)=>void;options:string;onOptions:(value:string)=>void;onCreate:()=>void}){
  const hasChoices=kind==='singleSelect'||kind==='multiSelect';
  return <form className="manage-create field-definition-create" onSubmit={event=>{event.preventDefault();onCreate();}}><label className="field-definition-label">Field Label<input aria-label="New field label" placeholder="Field label" value={label} onChange={event=>onLabel(event.target.value)}/></label><FieldTypePicker label="Field Type" value={kind} onChange={onKind}/>{hasChoices&&<label className="field-definition-choices">Choices<input aria-label="Field choices" placeholder="Choices separated by commas" value={options} onChange={event=>onOptions(event.target.value)}/></label>}<button className="primary" type="submit" disabled={!label.trim()}>Create Field</button></form>;
}

export function ActionsMenu({children}:{children:React.ReactNode}){
  const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
  useTransientPopover(open,setOpen,root,trigger);
  const items=React.Children.map(children,child=>React.isValidElement<Record<string,unknown>>(child)?React.cloneElement(child,{role:'menuitem'}):child);
  return <div className="entity-actions-menu" ref={root}><button ref={trigger} type="button" aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>Actions</button>{open&&<div className="entity-actions-popover" role="menu" onClick={event=>{if((event.target as HTMLElement).closest('button'))setOpen(false);}}>{items}</div>}</div>;
}

type ImageSourceMenuProps={disabled?:boolean;label?:string;onChoose:()=>void;onPaste:()=>void;status?:string};
export function ImageSourceMenu({disabled=false,label='+ Add Image',onChoose,onPaste,status}:ImageSourceMenuProps){
  const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
  useTransientPopover(open,setOpen,root,trigger);
  return <div className="media-add-menu" ref={root}><button ref={trigger} type="button" disabled={disabled} aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>{label}</button>{open&&<div role="menu" className="media-add-popover"><button type="button" role="menuitem" onClick={()=>{setOpen(false);onPaste();}}>Paste from Clipboard</button><button type="button" role="menuitem" onClick={()=>{setOpen(false);onChoose();}}>Choose Image File…</button></div>}{status&&<span role="status" className="media-import-status">{status}</span>}</div>;
}

export function MediaAddMenu(props:Omit<ImageSourceMenuProps,'label'>){return <ImageSourceMenu {...props} label="+ Add Image"/>;}

export type StagedEntityImage={token:string;dataUrl:string};
export function useStagedEntityImage(){
  const [image,setImage]=useState<StagedEntityImage|null>(null),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),token=useRef<string|null>(null);
  useEffect(()=>()=>{if(token.current)void window.pagehearth.discardEntityMedia(token.current);},[]);
  const replace=async(source:'clipboard'|'file')=>{setBusy(true);setStatus('');try{const selected=source==='clipboard'?await window.pagehearth.pasteEntityMedia():await window.pagehearth.chooseEntityMedia();if(!selected){if(source==='clipboard')setStatus('No image is available on the clipboard.');return;}const prior=token.current;if(prior)await window.pagehearth.discardEntityMedia(prior);token.current=selected.token;setImage(selected);}finally{setBusy(false);}};
  const discard=async()=>{const prior=token.current;token.current=null;setImage(null);setStatus('');if(prior)await window.pagehearth.discardEntityMedia(prior);};
  const consumed=()=>{token.current=null;setImage(null);setStatus('');};
  return {image,busy,status,choose:()=>replace('file'),paste:()=>replace('clipboard'),discard,consumed};
}
