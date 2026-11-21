import {SpecialText} from './specialText';
import {Extension,Mark,type Command} from '@tiptap/core';
import type {EditorState} from '@tiptap/pm/state';
import {closeHistory} from '@tiptap/pm/history';
import {validFontSize,validAlignment,type TextAlignment} from '../shared/typography';
export const FontSize=Mark.create({
 name:'fontSize',
 addAttributes(){return {points:{default:null,parseHTML:element=>{const match=element.style.fontSize.match(/^(\d+(?:\.\d)?)pt$/);return match&&validFontSize(Number(match[1]))?Number(match[1]):null;},renderHTML:attrs=>validFontSize(attrs.points)?{style:`font-size: ${attrs.points}pt`}:{}}};},
 parseHTML(){return [{tag:'span[style]',getAttrs:element=>{const match=(element as HTMLElement).style.fontSize.match(/^(\d+(?:\.\d)?)pt$/);return match&&validFontSize(Number(match[1]))?{}:false;}}];},
 renderHTML({HTMLAttributes}){return ['span',HTMLAttributes,0];},
});
export function sizeTransaction(state:EditorState,points:number|null){
 if(points!==null&&!validFontSize(points))throw Error('Use a size from 6 to 144 pt, with at most one decimal place.');
 const mark=state.schema.marks.fontSize,tr=closeHistory(state.tr),{from,to,empty}=state.selection;
 if(empty)return points===null?tr.removeStoredMark(mark):tr.addStoredMark(mark.create({points}));
 return points===null?tr.removeMark(from,to,mark):tr.addMark(from,to,mark.create({points}));
}
export function activeSize(state:EditorState):number|null|'Mixed'{
 const size=(marks:readonly {type:{name:string};attrs:Record<string,any>}[])=>marks.find(m=>m.type.name==='fontSize')?.attrs.points??null;
 if(state.selection.empty)return size(state.storedMarks??state.selection.$from.marks());
 const values=new Set<number|null>(),defaults=new Set<string>();
 state.doc.nodesBetween(state.selection.from,state.selection.to,(node,_pos,parent)=>{if(node.isText){const value=size(node.marks);values.add(value);if(value===null)defaults.add(parent?.type.name+':'+(parent?.attrs.level??''));}});
 return values.size>1||defaults.size>1?'Mixed':values.values().next().value??null;
}
export function activeAlignment(state:EditorState):TextAlignment|'Mixed'{
 const values=new Set<TextAlignment>();state.doc.nodesBetween(state.selection.from,state.selection.to,node=>{if(node.type.name==='paragraph'||node.type.name==='heading')values.add(node.attrs.textAlign??'left');});
 return values.size>1?'Mixed':values.values().next().value??'left';
}
export function alignmentTransaction(state:EditorState,alignment:TextAlignment){
 if(!validAlignment(alignment))throw Error('Unsupported text alignment.');
 const tr=closeHistory(state.tr);state.doc.nodesBetween(state.selection.from,state.selection.to,(node,pos)=>{if((node.type.name==='paragraph'||node.type.name==='heading')&&(node.attrs.textAlign??'left')!==alignment)tr.setNodeMarkup(pos,undefined,{...node.attrs,textAlign:alignment==='left'?null:alignment});});return tr;
}
declare module '@tiptap/core'{interface Commands<ReturnType>{textAlignment:{alignText:(alignment:TextAlignment)=>ReturnType}}}
export const TextAlignmentExtension=Extension.create({
 name:'textAlignment',
 addGlobalAttributes(){return [{types:['paragraph','heading'],attributes:{textAlign:{default:null,parseHTML:element=>validAlignment(element.style.textAlign)?element.style.textAlign:null,renderHTML:attrs=>validAlignment(attrs.textAlign)?{style:'text-align: '+attrs.textAlign}:{}}}}];},
 addCommands(){return {alignText:(alignment:TextAlignment):Command=>({state,dispatch})=>{if(!validAlignment(alignment))return false;const tr=alignmentTransaction(state,alignment);if(dispatch&&tr.docChanged)dispatch(tr);return true;}};},
});

export const manuscriptTypography=[FontSize,TextAlignmentExtension,SpecialText];
