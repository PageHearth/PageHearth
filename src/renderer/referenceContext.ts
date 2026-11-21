import {referenceRanges} from '../shared/referenceIntegrity';
import type {Editor} from '@tiptap/core';
import type {Node as PMNode} from '@tiptap/pm/model';
import type {EditorState} from '@tiptap/pm/state';

export function occurrenceAt(doc:PMNode,pos:number){
  const node=doc.nodeAt(pos),marks=node?.marks.filter(m=>m.type.name==='entityReference')||[],mark=marks.length===1?marks[0]:undefined;
  if(!mark||!mark.attrs.occurrenceId)return null;
  let range;try{range=referenceRanges(doc.toJSON()).find(r=>r.occurrenceId===mark.attrs.occurrenceId);}catch{return null;}
  if(!range)return null;const ranges=[{from:range.from,to:range.to}];
  return {occurrenceId:mark.attrs.occurrenceId as string,targetId:mark.attrs.targetId as string,mark,ranges};
}
export function removeOccurrence(state:EditorState,original:PMNode,occurrence:NonNullable<ReturnType<typeof occurrenceAt>>){
  if(state.doc!==original)return null;
  const transaction=state.tr;
  for(const range of occurrence.ranges)transaction.removeMark(range.from,range.to,occurrence.mark);
  return transaction;
}
export function selectionReferenceContext(doc:PMNode,from:number,to:number,pointer:number|null){
  const hit=pointer===null?null:occurrenceAt(doc,pointer);
  if(from===to)return hit?{kind:'remove' as const,occurrence:hit}:null;
  let marked=false;doc.nodesBetween(from,to,node=>{if(node.isText&&node.marks.some(m=>m.type.name==='entityReference'))marked=true;});
  if(marked){
    // A selection must be wholly inside this one occurrence. Mixed/plain overlap is ambiguous.
    if(!hit)return null;
    let covered=from;for(const range of hit.ranges){if(range.to<=covered)continue;if(range.from>covered)break;covered=Math.max(covered,range.to);}
    return covered>=to?{kind:'remove' as const,occurrence:hit}:null;
  }
  return doc.textBetween(from,to,' ').trim()?{kind:'add' as const,from,to}:null;
}
const editors=new Set<Editor>();
type Pending={editor:Editor;doc:PMNode;token:string;action:NonNullable<ReturnType<typeof selectionReferenceContext>>};
let pending:Pending|null=null,captured:{at:number;value:{kind:'add'|'remove';token:string;targetId?:string}|null}|null=null;
export function referenceAtPointer(editor:Editor,element:Element|null){
 const span=element?.closest('[data-entity-reference]');
 if(!span||!editor.view.dom.contains(span))return null;
 const hit=occurrenceAt(editor.state.doc,editor.view.posAtDOM(span,0));
 return hit?.occurrenceId===span.getAttribute('data-occurrence-id')&&hit.targetId===span.getAttribute('data-target-id')?hit:null;
}
function atPoint(editor:Editor,element:Element|null){
  const hit=referenceAtPointer(editor,element),pointer=hit?.ranges[0].from??null;
  const {doc,selection}=editor.state,action=selectionReferenceContext(doc,selection.from,selection.to,pointer);
  pending=null;if(!action)return null;
  const token=crypto.randomUUID();pending={editor,doc,token,action};return {kind:action.kind,token,...(action.kind==='remove'?{targetId:action.occurrence.targetId}:{})};
}
/** DOM event coordinates are CSS pixels; native coordinates can differ at application zoom. */
export function referenceMenuAt(x:number,y:number){
  if(captured&&Date.now()-captured.at<1500){const value=captured.value;captured=null;return value;}
  pending=null;const element=document.elementFromPoint(x,y),editor=[...editors].find(e=>!e.isDestroyed&&e.isEditable&&element&&e.view.dom.contains(element));
  return editor?atPoint(editor,element):null;
}
export function restoreReferenceSelection(token:string){
  const context=pending;
  if(!context||context.token!==token||context.action.kind!=='add')return false;
  pending=null;const {editor,doc,action}=context;
  if(editor.isDestroyed||!editor.isEditable||editor.state.doc!==doc)return false;
  editor.commands.setTextSelection({from:action.from,to:action.to});editor.view.focus();return true;
}
function openReferenceTarget(id:string){void window.pagehearth.openReference(id).catch(error=>window.alert('Could not open reference: '+String(error)));}
const clearContext=()=>{captured=null;pending=null;};
export function registerReferenceEditor(editor:Editor){
  if(!editors.size)document.addEventListener('contextmenu',clearContext,true);
  editors.add(editor);
  (window as any).__pagehearthReferenceMenu=referenceMenuAt;
  (window as any).__pagehearthRestoreReferenceSelection=restoreReferenceSelection;
  // Preserve deliberate selection before Chromium's right-button default can move it.
  let press:{x:number;y:number;occurrenceId:string}|null=null;
  const move=(event:MouseEvent)=>{if(press&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>4)press=null;};
  const down=(event:MouseEvent)=>{press=null;if(event.button===0&&event.ctrlKey&&!event.shiftKey&&!event.altKey&&!event.metaKey){const hit=referenceAtPointer(editor,event.target as Element);if(hit)press={x:event.clientX,y:event.clientY,occurrenceId:hit.occurrenceId};}if(event.button===2&&editor.isEditable&&!editor.state.selection.empty)event.preventDefault();};
  const click=(event:MouseEvent)=>{if(event.button!==0||!event.ctrlKey||event.shiftKey||event.altKey||event.metaKey)return;const hit=referenceAtPointer(editor,event.target as Element),started=press;press=null;if(!hit||!started||started.occurrenceId!==hit.occurrenceId||Math.hypot(event.clientX-started.x,event.clientY-started.y)>4)return;event.preventDefault();event.stopPropagation();openReferenceTarget(hit.targetId);};
  const context=(event:MouseEvent)=>{let value=editor.isEditable?atPoint(editor,event.target as Element):null;if(!value&&editor.isEditable&&!event.clientX&&!event.clientY){const pos=editor.state.selection.from,hit=occurrenceAt(editor.state.doc,pos)||occurrenceAt(editor.state.doc,Math.max(0,pos-1));if(hit){const token=crypto.randomUUID();pending={editor,doc:editor.state.doc,token,action:{kind:'remove',occurrence:hit}};value={kind:'remove',token,targetId:hit.targetId};}}captured={at:Date.now(),value};};
  editor.view.dom.addEventListener('mousemove',move,true);
  editor.view.dom.addEventListener('click',click,true);
  editor.view.dom.addEventListener('mousedown',down,true);
  editor.view.dom.addEventListener('contextmenu',context,true);
  const stop=window.pagehearth?.onCommand(command=>{
    if(command.kind!=='remove-reference'||!pending||pending.editor!==editor||pending.token!==command.token||pending.action.kind!=='remove')return;
    const context=pending;pending=null;
    if(editor.isDestroyed||!editor.isEditable||editor.state.doc!==context.doc||context.action.kind!=='remove')return;
    const transaction=removeOccurrence(editor.state,context.doc,context.action.occurrence);
    if(transaction)editor.view.dispatch(transaction);editor.view.focus();
  });
  return ()=>{stop?.();editor.view.dom.removeEventListener('mousemove',move,true);editor.view.dom.removeEventListener('click',click,true);editor.view.dom.removeEventListener('mousedown',down,true);editor.view.dom.removeEventListener('contextmenu',context,true);editors.delete(editor);if(!editors.size)document.removeEventListener('contextmenu',clearContext,true);if(pending?.editor===editor){pending=null;captured=null;}};
}
