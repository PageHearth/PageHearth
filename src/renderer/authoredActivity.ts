import {Extension} from '@tiptap/core';
import {Plugin,type Transaction} from '@tiptap/pm/state';
import {Step,StepResult} from '@tiptap/pm/transform';
import type {Node} from '@tiptap/pm/model';
export type Contribution={id:string;added:number;removed:number;apply:boolean;initial?:boolean};
/** A document-neutral history step. Undo inverts the original contribution, never infers it from text. */
export class ActivityStep extends Step{
 constructor(readonly contribution:Contribution){super();}
 apply(doc:Node){return StepResult.ok(doc);}
 invert(){return new ActivityStep({...this.contribution,apply:!this.contribution.apply});}
 map(){return this;}
 toJSON(){return {stepType:'writingActivity',contribution:this.contribution};}
 static fromJSON(_schema:unknown,json:any){return new ActivityStep(json.contribution);}
}
Step.jsonID('writingActivity',ActivityStep);
import {wordTokens} from '../shared/textAnalysis';
export type AuthoredDelta={added:number;removed:number};
/** Count token creation/removal, not every character typed into an existing word. */
export function authoredDelta(before:string,after:string,selected=''):AuthoredDelta{
 if(before===after)return {added:0,removed:0};
 const a=wordTokens(before).length,b=wordTokens(after).length;
 if(selected&&before.includes(selected)&&wordTokens(selected).length){const removed=Math.min(a,wordTokens(selected).length);return {removed,added:Math.max(0,b-a+removed)};}
 return {added:Math.max(0,b-a),removed:Math.max(0,a-b)};
}
export const ActivityInput=Extension.create<{record:(delta:Contribution)=>void}>({name:'activityInput',addOptions(){return {record:()=>{}};},addProseMirrorPlugins(){
 let origin='',expiry=0;
 const signal=(value:string)=>{origin=value;expiry=performance.now()+150;};
 const record=this.options.record;
 return [new Plugin({props:{handleDOMEvents:{keydown:(_v,e)=>{const key=e as KeyboardEvent;if(['Backspace','Delete','Enter'].includes(key.key)&&!key.metaKey&&!key.altKey)signal('authored');else if(key.ctrlKey||key.metaKey)signal('excluded');return false;},beforeinput:(_v,e)=>{const t=(e as InputEvent).inputType;signal(/^(insertText|insertReplacementText|insertCompositionText|insertParagraph|insertLineBreak|deleteContentBackward|deleteContentForward|deleteWordBackward|deleteWordForward|deleteByCut)$/.test(t)?'authored':'excluded');return false;},paste:()=>{signal('excluded');return false;},drop:()=>{signal('excluded');return false;},cut:()=>{signal('authored');return false;}}},appendTransaction:(trs,old,next)=>{
  for(const tr of trs)for(const step of tr.steps)if(step instanceof ActivityStep)queueMicrotask(()=>record(step.contribution));
  const changed=trs.filter(tr=>tr.docChanged);if(!changed.length)return null;const active=origin;origin='';
  if(active!=='authored'||performance.now()>expiry||changed.some(excluded))return null;
  const from=old.doc.content.findDiffStart(next.doc.content);if(from===null)return null;const end=old.doc.content.findDiffEnd(next.doc.content);if(!end)return null;
  // Expand only the affected block neighborhood; do not scan the entire manuscript.
  const a=old.doc.resolve(Math.min(from,old.doc.content.size)),b=next.doc.resolve(Math.min(from,next.doc.content.size));
  const startA=a.depth?a.start():0,startB=b.depth?b.start():0;
  const endA=old.doc.resolve(Math.min(end.a,old.doc.content.size)),endB=next.doc.resolve(Math.min(end.b,next.doc.content.size));
  const before=old.doc.textBetween(startA,endA.depth?endA.end():old.doc.content.size,'\n','\n'),after=next.doc.textBetween(startB,endB.depth?endB.end():next.doc.content.size,'\n','\n');
  const {from:sf,to:st}=old.selection;
  const edges=old.doc.textBetween(Math.max(0,sf-1),sf,'','')+old.doc.textBetween(st,Math.min(old.doc.content.size,st+1),'','');
  const selected=old.selection.empty||/[\p{L}\p{N}]/u.test(edges)?'':old.doc.textBetween(sf,st,'\n','\n');
  const delta=authoredDelta(before,after,selected);if(delta.added||delta.removed){const contribution={...delta,id:crypto.randomUUID(),apply:true};queueMicrotask(()=>record({...contribution,initial:true}));return next.tr.step(new ActivityStep(contribution));}return null;
 }} )];
}});
function excluded(tr:Transaction){return tr.getMeta('history$')||tr.getMeta('preventUpdate')||tr.getMeta('continuous-refresh')||['paste','drop'].includes(tr.getMeta('uiEvent'))||tr.getMeta('writing-origin')==='system';}
