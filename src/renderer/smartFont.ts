import {Mark} from '@tiptap/core';
import type {EditorState} from '@tiptap/pm/state';
import {TextSelection,AllSelection} from '@tiptap/pm/state';
import {validFontFamily,cssFontFamily} from '../shared/fonts';
export const SmartFont=Mark.create({
  name:'textStyle',
  addAttributes(){return {fontFamily:{default:null,parseHTML:element=>{const raw=element.style.fontFamily;const name=raw.replace(/^(['"])(.*)\1$/u,'$2');return validFontFamily(name)?name:null;},renderHTML:attrs=>validFontFamily(attrs.fontFamily)?{style:'font-family: '+cssFontFamily(attrs.fontFamily)}:{}}};},
  parseHTML(){return [{tag:'span[style]',getAttrs:element=>{const raw=(element as HTMLElement).style.fontFamily.replace(/^(['"])(.*)\1$/u,'$2');return validFontFamily(raw)?{}:false;}}];},
  renderHTML({HTMLAttributes}){return ['span',HTMLAttributes,0];},
});
export function activeFont(state:EditorState):string|null|'Mixed'{
  const font=(marks:readonly {type:{name:string};attrs:Record<string,any>}[])=>marks.find(mark=>mark.type.name==='textStyle')?.attrs.fontFamily||null;
  if(state.selection.empty)return font(state.storedMarks??state.selection.$from.marks());
  const values=new Set<string|null>();
  state.doc.nodesBetween(state.selection.from,state.selection.to,node=>{if(values.size>1)return false;if(node.isText)values.add(font(node.marks));});
  return values.size>1?'Mixed':values.values().next().value??null;
}
export function fontTransaction(state:EditorState,family:string|null){
  if(family!==null&&!validFontFamily(family))throw Error('Invalid font family.');
  if(!(state.selection instanceof TextSelection)&&!(state.selection instanceof AllSelection))return null;
  const mark=state.schema.marks.textStyle;if(!mark)return null;
  const tr=state.tr,{from,to,empty}=state.selection;
  if(empty)return family===null?tr.removeStoredMark(mark):tr.addStoredMark(mark.create({fontFamily:family}));
  return family===null?tr.removeMark(from,to,mark):tr.addMark(from,to,mark.create({fontFamily:family}));
}
