import {useEffect} from 'react';
import type {Editor} from '@tiptap/core';
import {textFocusKey,type FocusPreferences} from './textFocus';
/** Presentation controller only: no document transactions or canonical save callbacks. */
export function FocusPane({editor,active,enabled,preferences}:{editor:Editor;active:boolean;enabled:boolean;preferences:FocusPreferences}){
 useEffect(()=>{
  const dom=editor.view.dom,scroll=dom.closest<HTMLElement>('.draft-scroll');if(!scroll)return;
  const inset=()=>{const before=dom.getBoundingClientRect().top;scroll.style.setProperty('--typewriter-inset',Math.round(scroll.clientHeight*.5)+'px');scroll.classList.toggle('typewriter-scroll',enabled&&preferences.typewriter);scroll.scrollTop+=dom.getBoundingClientRect().top-before;};
  const resize=new ResizeObserver(inset);resize.observe(scroll);inset();
  return()=>resize.disconnect();
 },[editor,enabled,preferences.typewriter]);
 useEffect(()=>{
  const dom=editor.view.dom,scroll=dom.closest<HTMLElement>('.draft-scroll');if(!scroll)return;
  let frame=0,second=0,typing=false,settleUntil=0,corrections=0;
  const decorate=(suspended:boolean)=>{if(editor.isDestroyed)return;const old=textFocusKey.getState(editor.state),mode=active?preferences.text:'off';if(old?.mode!==mode||old.suspended!==suspended)editor.view.dispatch(editor.state.tr.setMeta(textFocusKey,{mode,suspended}).setMeta('addToHistory',false));};
  const suspend=()=>{typing=false;settleUntil=0;cancelAnimationFrame(frame);cancelAnimationFrame(second);decorate(true);};
  const engage=()=>decorate(false);
  const center=()=>{if(!active||!preferences.typewriter||editor.isDestroyed||editor.view.composing)return;const caret=editor.view.coordsAtPos(editor.state.selection.head),box=scroll.getBoundingClientRect();const delta=(caret.top+caret.bottom)/2-(box.top+box.height*.5);if(Math.abs(delta)>2){corrections++;scroll.scrollTop+=delta;}};
  const queueCenter=()=>{cancelAnimationFrame(frame);cancelAnimationFrame(second);frame=requestAnimationFrame(()=>{second=requestAnimationFrame(center);});};
  // Chromium/ProseMirror may reveal a previously offscreen caret after the first
  // centering frame. Settle that input turn only; never follow review scrolling.
  const schedule=()=>{if(!active||!preferences.typewriter)return;settleUntil=performance.now()+200;corrections=0;queueCenter();};
  const afterReveal=()=>{if(performance.now()<settleUntil&&corrections<4)queueCenter();};
  const input=()=>{typing=true;engage();};
  const key=(event:KeyboardEvent)=>{if(['PageUp','PageDown'].includes(event.key)){suspend();return;}if(!event.altKey&&!event.ctrlKey&&!event.metaKey&&(event.key.length===1||['Enter','Backspace','Delete','Tab'].includes(event.key)))input();if(event.key.startsWith('Arrow')||event.key==='Home'||event.key==='End'){engage();if(!event.altKey&&!event.ctrlKey&&!event.metaKey)schedule();}};
  const click=(event:PointerEvent)=>{if(dom.contains(event.target as Node)){typing=false;settleUntil=0;cancelAnimationFrame(frame);cancelAnimationFrame(second);engage();}else suspend();};
  const transaction=({transaction:tr}:any)=>{if(typing&&tr.docChanged&&!tr.getMeta('preventUpdate')){typing=false;schedule();}};
  decorate(false);
  scroll.addEventListener('scroll',afterReveal,{passive:true});scroll.addEventListener('wheel',suspend,{passive:true});scroll.addEventListener('touchmove',suspend,{passive:true});scroll.addEventListener('pointerdown',click);dom.addEventListener('keydown',key,true);dom.addEventListener('beforeinput',input);dom.addEventListener('compositionend',schedule);editor.on('transaction',transaction);
  return()=>{cancelAnimationFrame(frame);cancelAnimationFrame(second);scroll.removeEventListener('scroll',afterReveal);scroll.removeEventListener('wheel',suspend);scroll.removeEventListener('touchmove',suspend);scroll.removeEventListener('pointerdown',click);dom.removeEventListener('keydown',key,true);dom.removeEventListener('beforeinput',input);dom.removeEventListener('compositionend',schedule);editor.off('transaction',transaction);};
 },[editor,active,preferences.text,preferences.typewriter]);
 return null;
}
