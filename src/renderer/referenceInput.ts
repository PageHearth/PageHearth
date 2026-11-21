import {Plugin,PluginKey} from '@tiptap/pm/state';
import {Slice} from '@tiptap/pm/model';
import type {Editor} from '@tiptap/core';
import type {Doc} from '../shared/model';
import {referenceRanges,remintReferences} from '../shared/referenceIntegrity';
import {canonicalClipboard} from './continuous';
import {cleanRevisionSlice} from './revisionInput';
export const referenceInputKey=new PluginKey<boolean>('referenceInput');
const mime='application/x-pagehearth-reference-token';
let clipboard:{token:string;html:string;project:string;slice:Slice;cut:boolean;consumed:boolean}|null=null;
export function typedReference(editor:Editor){
 if(!referenceInputKey.getState(editor.state))return null;
 const at=editor.state.selection.from,before=editor.state.doc.textBetween(Math.max(0,at-120),at,'\n','\0'),match=before.match(/\[\[([^\]\n]{1,80})\]\]$/u);
 return match?{from:at-match[0].length,to:at,visibleText:match[1],query:match[1]}:null;
}
export function referenceInputPlugin(project:()=>string|null,refuse:(message:string)=>void,exists:(id:string)=>boolean=()=>true){
 let typed=false;
 return new Plugin({key:referenceInputKey,state:{init:()=>false,apply:(tr,previous)=>!tr.docChanged||tr.getMeta('appendedTransaction')?previous:!!tr.getMeta(referenceInputKey)},
  filterTransaction(tr){
   if(tr.docChanged){const authored=typed;typed=false;tr.setMeta(referenceInputKey,authored&&!tr.getMeta('uiEvent')&&!tr.getMeta('preventUpdate')&&!tr.getMeta('continuous-refresh')&&!tr.getMeta('history$'));
    try{referenceRanges(tr.doc.toJSON());}catch(error){queueMicrotask(()=>refuse(String(error)));return false;}
   }return true;
  },props:{handleDOMEvents:{beforeinput:(_view,event)=>{typed=['insertText','insertCompositionText'].includes((event as InputEvent).inputType);return false;},keydown:()=>{typed=false;return false;},blur:()=>{typed=false;return false;},paste:()=>{typed=false;return false;},drop:()=>{typed=false;return false;},copy:(view,event)=>copy(view,event as ClipboardEvent),cut:(view,event)=>copy(view,event as ClipboardEvent,true)},
   handlePaste(view,event){typed=false;const c=clipboard,id=project();if(!c||!id||c.project!==id||event.clipboardData?.getData(mime)!==c.token||event.clipboardData.getData('text/html')!==c.html)return false;
    try{const clean=cleanRevisionSlice(canonicalClipboard(c.slice)),body:Doc={type:'doc',content:clean.content.toJSON()},canMove=c.cut&&!c.consumed&&referenceRanges(body).every(r=>!exists(r.occurrenceId)),fresh=canMove?body:remintReferences(body);const slice=Slice.fromJSON(view.state.schema,{content:fresh.content,openStart:clean.openStart,openEnd:clean.openEnd});view.dispatch(view.state.tr.replaceSelection(slice).setMeta('uiEvent','paste'));c.consumed=true;return true;}catch(error){refuse(String(error));return true;}
   }
  }});
 function copy(view:Editor['view'],event:ClipboardEvent,cut=false){
  if(view.state.selection.empty||!event.clipboardData||!project())return false;
  const slice=view.state.selection.content();
  // Cross-segment copying stays supported by the existing Continuous serializer;
  // cutting across segments must still be rejected by its boundary guard.
  if(cut&&slice.content.firstChild?.type.name==='manuscriptSegment'&&slice.content.childCount>1)return false;
  const serialized=view.serializeForClipboard(slice),token=crypto.randomUUID(),html=serialized.dom.innerHTML;
  clipboard={token,html,project:project()!,slice:serialized.slice,cut,consumed:false};
  event.clipboardData.setData('text/html',html);event.clipboardData.setData('text/plain',serialized.text);event.clipboardData.setData(mime,token);event.preventDefault();
  // A cut receipt is single-use. Adoption also proves absence from the current
  // canonical project; uncertain or repeated moves receive new identities.
  if(cut)view.dispatch(view.state.tr.deleteSelection().setMeta('uiEvent','cut'));
  return true;
 }
}
