import {Extension} from '@tiptap/core';
import {Plugin,PluginKey} from '@tiptap/pm/state';
import {Decoration,DecorationSet} from '@tiptap/pm/view';
export const draftPageKey=new PluginKey<DecorationSet>('draft-page-presentation');
export const draftPageGap=14;
export const draftPagePadding=20;
/** Widgets exist only in the view. Clipboard/export/history serialize the document, not these. */
export function createDraftPagePlugin(){return new Plugin({key:draftPageKey,state:{init:()=>DecorationSet.empty,apply(transaction,previous){
  const positions=transaction.getMeta(draftPageKey) as number[]|undefined;
  if(positions)return DecorationSet.create(transaction.doc,positions.map(pos=>Decoration.widget(pos,()=>{const gap=document.createElement('span');gap.className='draft-page-break';gap.contentEditable='false';gap.setAttribute('aria-hidden','true');gap.setAttribute('data-draft-gap','');return gap;},{side:-1,key:'draft-gap-'+pos,ignoreSelection:true,stopEvent:()=>true})));
  return previous.map(transaction.mapping,transaction.doc);
}},props:{decorations:state=>draftPageKey.getState(state)}});}
export const DraftPagePresentation=Extension.create({name:'draftPagePresentation',addProseMirrorPlugins(){return [createDraftPagePlugin()];}});

/** Find the first character on a measured line in logarithmic range queries. */
export function firstOffsetOnLine(length:number,target:number,topAt:(offset:number)=>number){
  let lo=0,hi=length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(topAt(mid)<target-.5)lo=mid+1;else hi=mid;}
  return lo;
}
