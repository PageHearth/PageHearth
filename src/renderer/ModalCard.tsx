import './globalPolish.css';
import {useEffect,useRef,useState,type KeyboardEvent,type ReactNode} from 'react';

/** Keep Tab on visible dialog controls, including the last-to-first boundary. */
export function containDialogTab(event:KeyboardEvent<HTMLDialogElement>){
 if(event.defaultPrevented||event.key!=='Tab'||event.altKey||event.ctrlKey||event.metaKey)return;
 const controls=[...event.currentTarget.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],summary,[tabindex]')].filter(el=>el.tabIndex>=0&&!el.matches(':disabled')&&el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden');
 event.preventDefault();
 if(!controls.length){event.currentTarget.focus();return;}
 const at=controls.indexOf(document.activeElement as HTMLElement),next=at<0?(event.shiftKey?controls.length-1:0):(at+(event.shiftKey?-1:1)+controls.length)%controls.length;
 controls[next].focus();
}
/** Existing card presentation with browser-owned modality and focus containment. */
export function ModalCard({label,labelledBy,onClose,children,alert=false,className='',dismissOutside=true}:{label?:string;labelledBy?:string;onClose:()=>void;children:ReactNode;alert?:boolean;className?:string;dismissOutside?:boolean}){
 const ref=useRef<HTMLDialogElement>(null),[origin]=useState(()=>typeof document==='undefined'?null:document.activeElement as HTMLElement|null);
 useEffect(()=>{const el=ref.current;el?.showModal();return()=>{el?.close();if(origin?.isConnected)origin.focus();};},[origin]);
 return <dialog onKeyDown={containDialogTab} ref={ref} className={`modal-card native-modal-card ${className}`} role={alert?'alertdialog':'dialog'} aria-modal="true" aria-label={label} aria-labelledby={labelledBy} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(!dismissOutside||e.target!==e.currentTarget)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}>{children}</dialog>;
}
