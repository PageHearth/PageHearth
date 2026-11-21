import {Extension} from '@tiptap/core';
import {Decoration,DecorationSet} from '@tiptap/pm/view';
import {PluginKey,Plugin} from '@tiptap/pm/state';
import {Fragment,Slice,type Node as PMNode} from '@tiptap/pm/model';
import type {Editor} from '@tiptap/core';
import {canonicalPosition,segments} from './continuous';
import {validRevisionId,type RevisionId} from '../shared/revisionPasses';
export const revisionOrigin='revision-origin';
function clean(node:PMNode):PMNode{return node.copy(Fragment.fromArray(Array.from({length:node.childCount},(_,i)=>clean(node.child(i))))).mark(node.marks.filter(m=>m.type.name!=='revisionPass'));}
export function cleanRevisionSlice(slice:Slice){const nodes:PMNode[]=[];slice.content.forEach(n=>nodes.push(clean(n)));return new Slice(Fragment.fromArray(nodes),slice.openStart,slice.openEnd);}
export function revisionInputPlugin(active:()=>RevisionId|null){let input=false;return new Plugin({filterTransaction(tr){for(const step of tr.steps){const value=step.toJSON();let valid=true;const check=(n:any)=>{for(const m of n.marks||[])if(m.type==='revisionPass'&&(!validRevisionId(m.attrs?.slotId)||Object.keys(m.attrs||{}).length!==1))valid=false;for(const c of n.content||[])check(c);};if(value.mark)check({marks:[value.mark]});if(value.slice)check(value.slice);if(!valid)return false;}if(tr.docChanged){if(input&&!tr.getMeta('continuous-refresh')&&!tr.getMeta('preventUpdate')&&!tr.getMeta(revisionOrigin))tr.setMeta(revisionOrigin,'text');input=false;}return true;},props:{handleDOMEvents:{beforeinput:(_view,event)=>{input=/^insert/.test((event as InputEvent).inputType);return false;},keydown:()=>{input=false;return false;},blur:()=>{input=false;return false;}},transformPasted:cleanRevisionSlice,transformCopied:cleanRevisionSlice},appendTransaction:(trs,_old,next)=>{
 const ranges:{from:number;to:number}[]=[];
 for(let ti=0;ti<trs.length;ti++){const tr=trs[ti];if(!tr.docChanged||tr.getMeta(revisionOrigin)==='metadata'||tr.getMeta(revisionOrigin)==='automatic'||tr.getMeta('continuous-refresh')||tr.getMeta('preventUpdate')||tr.getMeta('writing-origin')==='system'||tr.getMeta('history$'))continue;
  for(let si=0;si<tr.steps.length;si++){const step=tr.steps[si],json=step.toJSON();if(json.stepType!=='replace')continue;
   // Text-preserving structure/format replacements must not acquire new identity.
   const before=tr.docs[si].textBetween(json.from,json.to,'\n','\n'),inserted=json.slice?Slice.fromJSON(next.schema,json.slice).content.textBetween(0,Slice.fromJSON(next.schema,json.slice).content.size,'\n','\n'):'';
   if(!inserted||before===inserted&&tr.getMeta(revisionOrigin)!=='text'&&!tr.getMeta('uiEvent'))continue;
   step.getMap().forEach((_a,_b,from,to)=>{for(let j=si+1;j<tr.steps.length;j++){from=tr.steps[j].getMap().map(from,1);to=tr.steps[j].getMap().map(to,-1);}for(let j=ti+1;j<trs.length;j++){from=trs[j].mapping.map(from,1);to=trs[j].mapping.map(to,-1);}if(to>from)ranges.push({from,to});});
  }
 }
 if(!ranges.length)return null;const tr=next.tr,type=next.schema.marks.revisionPass,slot=active();for(const r of ranges)next.doc.nodesBetween(r.from,r.to,(node,pos)=>{if(!node.isText)return;const from=Math.max(pos,r.from),to=Math.min(pos+node.nodeSize,r.to);tr.removeMark(from,to,type);if(slot)tr.addMark(from,to,type.create({slotId:slot}));});return tr.steps.length?tr.setMeta(revisionOrigin,'automatic').setMeta('addToHistory',false):null;
 }});}
export const RevisionInput=Extension.create<{active:()=>RevisionId|null}>({name:'revisionInput',addOptions(){return {active:()=>null};},addProseMirrorPlugins(){return [revisionInputPlugin(this.options.active)];}});
export function markRevisionSelection(editor:Editor,slot:RevisionId|null){if(!editor.isEditable)throw new RevisionCommandRefusal('Enter an editable manuscript pane.');const {from,to}=editor.state.selection;if(from===to)throw new RevisionCommandRefusal('Select manuscript text first.');if(segments(editor.state.doc).length&&canonicalPosition(editor.state.doc,from)?.id!==canonicalPosition(editor.state.doc,to)?.id)throw new RevisionCommandRefusal('A Revision selection must stay within one document.');for(const pos of [from,to]){const at=editor.state.doc.resolve(pos);if(!at.parent.isTextblock)continue;const text=at.parent.textBetween(0,at.parent.content.size,'','\n');const valid=new Set([...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text)].map(x=>x.index));valid.add(text.length);if(!valid.has(at.parentOffset))throw new RevisionCommandRefusal('Select complete Unicode characters.');}const tr=editor.state.tr,type=editor.schema.marks.revisionPass;tr.removeMark(from,to,type);if(slot)editor.state.doc.nodesBetween(from,to,(node,pos)=>{if(node.isText)tr.addMark(Math.max(from,pos),Math.min(to,pos+node.nodeSize),type.create({slotId:slot}));});editor.view.dispatch(tr.setMeta(revisionOrigin,'metadata').setMeta('closeHistory$',true));editor.view.focus();}

// A command refusal is not a persistence failure. Never dispatch on this path.
export class RevisionCommandRefusal extends Error {}
export function revisionSelectionCommand(editor:Editor,active:RevisionId|null,remove:boolean){
 if(!remove&&!active)throw new RevisionCommandRefusal('Choose a Revision pass first.');
 markRevisionSelection(editor,remove?null:active);
}
export const revisionCueKey=new PluginKey<DecorationSet>('revision-selection-cue');
export function revisionCuePlugin(){return new Plugin<DecorationSet>({key:revisionCueKey,state:{init:()=>DecorationSet.empty,apply(tr,old){const capture=tr.getMeta(revisionCueKey);if(capture===false||tr.docChanged||tr.selectionSet)return DecorationSet.empty;if(capture===true){const {from,to}=tr.selection;return from===to?DecorationSet.empty:DecorationSet.create(tr.doc,[Decoration.inline(from,to,{class:'revision-selection-cue'})]);}return old;}},props:{decorations:state=>revisionCueKey.getState(state),handleDOMEvents:{focus:view=>{if(revisionCueKey.getState(view.state)?.find().length)view.dispatch(view.state.tr.setMeta(revisionCueKey,false));return false;}}}});}
export const RevisionSelectionCue=Extension.create({name:'revisionSelectionCue',addProseMirrorPlugins(){return [revisionCuePlugin()];}});
export function revisionSelectionCue(editor:Editor,open:boolean){if(editor.isDestroyed)return;editor.view.dispatch(editor.state.tr.setMeta(revisionCueKey,open).setMeta('addToHistory',false));}
