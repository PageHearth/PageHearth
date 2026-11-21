import {registerSpellingView} from './spellingContext';
import {Extension} from '@tiptap/core';
import {Plugin,PluginKey} from '@tiptap/pm/state';
import {Decoration,DecorationSet,type EditorView} from '@tiptap/pm/view';
import type {Node as PMNode} from '@tiptap/pm/model';
import {normalizeSpelling,spellingTokens,type SpellingToken} from '../shared/spelling';
import {spellService,type SpellService} from './spellService';

type Range={from:number;to:number};
type State={decos:DecorationSet;dirty:Range[];revision:number;project:string};
export const spellingKey=new PluginKey<State>('pagehearthSpelling');
function merge(ranges:Range[]){const out:Range[]=[];for(const r of ranges.sort((a,b)=>a.from-b.from)){const last=out.at(-1);if(last&&r.from<=last.to+1)last.to=Math.max(last.to,r.to);else out.push({...r});}return out;}
export function spellingBlocks(doc:PMNode,ranges:Range[]){
 const found=new Map<number,{from:number;to:number;text:string;start:number;end:number}>();
 for(const r of ranges){const from=Math.max(0,r.from-1),to=Math.min(doc.content.size,r.to+1);doc.nodesBetween(from,to,(node,pos)=>{if(!node.isTextblock)return;
  let start=0,end=node.content.size;
  if(end>4096&&(from>pos||to<pos+node.nodeSize)){
   start=Math.max(0,Math.min(end,from-pos-1));end=Math.max(start,Math.min(end,to-pos-1));const boundary=/[^\p{L}\p{M}'’\-]/gu;
   while(start>0){const left=Math.max(0,start-64),chunk=node.textBetween(left,start,'','\n'),last=[...chunk.matchAll(boundary)].at(-1);if(last){start=left+last.index!+last[0].length;break;}start=left;}
   while(end<node.content.size){const right=Math.min(node.content.size,end+64),chunk=node.textBetween(end,right,'','\n'),first=[...chunk.matchAll(boundary)][0];if(first){end+=first.index!;break;}end=right;}
  }
  const previous=found.get(pos);if(previous){start=Math.min(start,previous.start);end=Math.max(end,previous.end);}
  found.set(pos,{start,end,from:pos+start,to:pos+end+1,text:node.textBetween(start,end,'','\n')});return false;
 });}return [...found.values()];
}
export function spellingPlugin(service:SpellService=spellService){return new Plugin<State>({key:spellingKey,
 state:{init:(_,state)=>({decos:DecorationSet.empty,dirty:[{from:0,to:state.doc.content.size}],revision:0,project:service.snapshot.projectId}),apply(tr,old,_before,next){
  const result=tr.getMeta(spellingKey);const value={...old};
  if(tr.docChanged){value.revision++;value.decos=old.decos.map(tr.mapping,tr.doc);value.dirty=old.dirty.map(r=>({from:tr.mapping.map(r.from,-1),to:tr.mapping.map(r.to,1)}));
   tr.mapping.maps.forEach((map,index)=>map.forEach((_a,_b,from,to)=>{const rest=tr.mapping.slice(index+1);value.dirty.push({from:rest.map(from,-1),to:rest.map(to,1)});}));value.dirty=merge(value.dirty);
   const changed=spellingBlocks(tr.doc,value.dirty);value.decos=value.decos.remove(value.decos.find().filter(d=>changed.some(b=>d.from<b.to&&d.to>b.from)));
  }
  if(result?.refresh){if(value.project!==service.snapshot.projectId||result.composition)value.decos=DecorationSet.empty;else{value.decos=value.decos.remove(value.decos.find().filter(d=>service.approves(d.spec.word)));}value.project=service.snapshot.projectId;value.dirty=[{from:0,to:tr.doc.content.size}];}
  if(result?.done&&result.revision===value.revision&&result.epoch===service.epoch&&result.project===service.snapshot.projectId){value.decos=DecorationSet.create(next.doc,[...value.decos.find().filter(d=>!result.blocks.some((b:Range)=>d.from<b.to&&d.to>b.from)),...result.ranges.map((r:SpellingToken)=>Decoration.inline(r.from,r.to,{class:'pagehearth-spelling-error'},{word:r.word}))]);value.dirty=[];}
  if(result?.error){value.decos=DecorationSet.empty;value.dirty=[];}
  return value;
 }},props:{attributes:{spellcheck:'false'},decorations:state=>spellingKey.getState(state)!.decos,handleDOMEvents:{keydown:(view,event)=>{const key=event as KeyboardEvent;if(key.key==='ContextMenu'||key.key==='F10'&&key.shiftKey){event.preventDefault();const at=view.coordsAtPos(view.state.selection.from);void window.pagehearth.spellContext(at.left+1,(at.top+at.bottom)/2);return true;}return false;},compositionstart:view=>{view.dispatch(view.state.tr.setMeta(spellingKey,{refresh:true,composition:true}).setMeta('addToHistory',false));return false;},compositionend:view=>{setTimeout(()=>{if(!view.isDestroyed)view.dispatch(view.state.tr.setMeta(spellingKey,{wake:true}).setMeta('addToHistory',false));},0);return false;}}},
 view(view){const unregister=registerSpellingView(view);let running=false,dead=false,request=0;const refresh=()=>{if(!dead)view.dispatch(view.state.tr.setMeta(spellingKey,{refresh:true}).setMeta('addToHistory',false));};service.listeners.add(refresh);
  async function schedule(){if(running||dead||view.composing)return;const state=spellingKey.getState(view.state)!;if(!state.dirty.length)return;running=true;const id=++request,doc=view.state.doc,revision=state.revision,epoch=service.epoch,project=service.snapshot.projectId;
   const current=()=>!dead&&!view.composing&&id===request&&revision===spellingKey.getState(view.state)!.revision&&epoch===service.epoch&&project===service.snapshot.projectId;
   try{const work=spellingBlocks(doc,state.dirty),tokens:SpellingToken[]=[];for(let i=0;i<work.length;i++){const b=work[i];tokens.push(...spellingTokens(b.text,b.from+1));if(i%32===31)await new Promise(r=>setTimeout(r,0));if(!current())return;}
    const ranges=await service.check(tokens);if(current())view.dispatch(view.state.tr.setMeta(spellingKey,{done:true,revision,epoch,project,blocks:work,ranges}).setMeta('addToHistory',false));
   }catch{if(current())view.dispatch(view.state.tr.setMeta(spellingKey,{error:true}).setMeta('addToHistory',false));}
   finally{running=false;if(!dead&&!view.composing&&spellingKey.getState(view.state)!.dirty.length)queueMicrotask(schedule);}
  }
  queueMicrotask(schedule);return {update(){queueMicrotask(schedule);},destroy(){unregister();dead=true;request++;service.listeners.delete(refresh);}};
 }
});}
export const SpellingDecorations=Extension.create({name:'pagehearthSpelling',addProseMirrorPlugins(){return [spellingPlugin()];}});
export function spellingTokenAt(view:EditorView,pos:number){const at=view.state.doc.resolve(Math.max(0,Math.min(pos,view.state.doc.content.size)));if(!at.parent.isTextblock)return null;return spellingTokens(at.parent.textBetween(0,at.parent.content.size,'','\n'),at.start()).find(t=>pos>=t.from&&pos<t.to)||null;}
