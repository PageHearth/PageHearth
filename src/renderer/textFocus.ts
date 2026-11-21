import {Extension} from '@tiptap/core';
import {Plugin,PluginKey,type EditorState} from '@tiptap/pm/state';
import {Decoration,DecorationSet} from '@tiptap/pm/view';
import type {EditorView} from '@tiptap/pm/view';
import type {TextFocusMode} from '../shared/focus';
export {focusPreferences,type TextFocusMode,type FocusPreferences} from '../shared/focus';
export function sentenceRange(text:string,offset:number):[number,number]{
 const segmenter=new Intl.Segmenter(undefined,{granularity:'sentence'});
 let last:[number,number]=[0,text.length];
 for(const item of segmenter.segment(text)){last=[item.index,item.index+item.segment.length];if(offset<last[1])return last;}
 return last;
}
// Offsets remain ProseMirror offsets: each inline atom occupies one position.
// Blank lines are a presentation boundary, never a manuscript normalization.
export function visualParagraphRange(text:string,offset:number):[number,number]{
 let start=0;
 for(const match of text.matchAll(/\n[ \t]*\n(?:[ \t]*\n)*/g)){
  if(offset<match.index+match[0].length)return [start,match.index];
  start=match.index+match[0].length;
 }
 return [start,text.length];
}
type FocusState={mode:TextFocusMode;suspended:boolean};
export const textFocusKey=new PluginKey<FocusState>('textFocus');
export function focusDecorations(state:EditorState,mode:TextFocusMode){
 const at=state.selection.$head;if(mode==='off'||!at.parent.isTextblock||!at.depth)return DecorationSet.empty;
 const start=at.start(),end=at.end();
 const visualText=mode==='paragraph'?at.parent.textBetween(0,at.parent.content.size,'',node=>node.type.name==='hardBreak'?'\n':'\ufffc'):'';
 const visualRange=mode==='paragraph'?visualParagraphRange(visualText,at.parentOffset):null;
 const divided=visualRange!==null&&(visualRange[0]>0||visualRange[1]<at.parent.content.size);
 const decorations=[Decoration.node(at.before(),at.after(),{class:mode==='paragraph'?(divided?'focus-current-block focus-visual-band':'focus-current-block focus-current-paragraph'):'focus-current-block'})];
 if(divided&&visualRange){
  const [a,b]=visualRange;
  if(b>a)decorations.push(Decoration.inline(start+a,start+b,{class:'focus-current-visual-paragraph'}));
  if(a)decorations.push(Decoration.inline(start,start+a,{class:'focus-subdued'}));
  if(start+b<end)decorations.push(Decoration.inline(start+b,end,{class:'focus-subdued'}));
 }
 if(mode==='sentence'){
  // Only inspect the caret's textblock. Inline atoms occupy one position, preserving offsets.
  const text=at.parent.textBetween(0,at.parent.content.size,'','\ufffc');
  const [a,b]=sentenceRange(text,at.parentOffset);
  if(b>a)decorations.push(Decoration.inline(start+a,start+b,{class:'focus-current-sentence'}));
  if(a)decorations.push(Decoration.inline(start,start+a,{class:'focus-subdued'}));
  if(start+b<end)decorations.push(Decoration.inline(start+b,end,{class:'focus-subdued'}));
 }
 return DecorationSet.create(state.doc,decorations);
}
/** Paint a full-width band on the existing block, without inserting layout/content nodes. */
function visualParagraphBand(view:EditorView){
 let frame=0,host:HTMLElement|null=null,disposed=false;
 // Keep measured CSS variables outside ProseMirror's observed content DOM.
 const clear=()=>{if(host){host.style.removeProperty('--focus-band-top');host.style.removeProperty('--focus-band-height');host=null;}};
 const paint=()=>{
  frame=0;clear();
  const spans=Array.from(view.dom.querySelectorAll<HTMLElement>('.focus-current-visual-paragraph'));
  if(!spans.length)return;
  const block=spans[0].closest<HTMLElement>('.focus-current-block');if(!block)return;
  const bounds=block.getBoundingClientRect(),scale=bounds.height/block.offsetHeight;
  if(!Number.isFinite(scale)||scale<=0)return;
  const rects=spans.flatMap(span=>Array.from(span.getClientRects())).filter(r=>r.height>0);
  if(!rects.length)return;
  const lineHeight=parseFloat(getComputedStyle(block).lineHeight);
  const top=Math.min(...rects.map(r=>r.top-Math.max(0,(lineHeight*scale-r.height)/2)));
  const bottom=Math.max(...rects.map(r=>r.bottom+Math.max(0,(lineHeight*scale-r.height)/2)));
  const y=Math.max(0,(top-bounds.top)/scale),end=Math.min(block.offsetHeight,(bottom-bounds.top)/scale);
  host=view.dom.parentElement;if(!host)return;
  host.style.setProperty('--focus-band-top',y+'px');host.style.setProperty('--focus-band-height',Math.max(0,end-y)+'px');
 };
 const schedule=()=>{if(disposed)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(paint);};
 const resize=new ResizeObserver(schedule);resize.observe(view.dom);
 window.addEventListener('resize',schedule);document.fonts.addEventListener('loadingdone',schedule);schedule();
 return {update:schedule,destroy(){disposed=true;cancelAnimationFrame(frame);resize.disconnect();window.removeEventListener('resize',schedule);document.fonts.removeEventListener('loadingdone',schedule);clear();}};
}
export const TextFocus=Extension.create({name:'textFocus',addProseMirrorPlugins(){return [new Plugin<FocusState>({key:textFocusKey,view:visualParagraphBand,state:{init:()=>({mode:'off',suspended:false}),apply:(tr,previous)=>tr.getMeta(textFocusKey)?{...previous,...tr.getMeta(textFocusKey)}:previous},props:{attributes:state=>{const v=textFocusKey.getState(state)!;return {'data-text-focus':v.suspended?'off':v.mode};},decorations:state=>{const v=textFocusKey.getState(state)!;return focusDecorations(state,v.suspended?'off':v.mode);}}})];}});
