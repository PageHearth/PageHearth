import {segments} from './continuous';
import type {Editor} from '@tiptap/core';
import {TextSelection} from '@tiptap/pm/state';
import {literalMatches,type SearchRequest} from '../shared/search';
/** Selection-only transaction: no persistent marks, document changes or undo item. */
export function selectSearchOccurrence(editor:Editor,request:SearchRequest){
 let text='';const positions:number[]=[];
 const visit=(node:typeof editor.state.doc,pos:number)=>{if(node.isText){for(let i=0;i<node.text!.length;i++){text+=node.text![i];positions.push(pos+i);}}else if(['hardBreak','horizontalRule'].includes(node.type.name)){text+='\n';positions.push(pos);}else node.forEach((child,offset)=>{const start=pos+(node.type.name==='doc'?0:1)+offset;visit(child,start);if(['paragraph','heading','codeBlock'].includes(child.type.name)){text+='\n';positions.push(start+child.nodeSize-1);}});};const segment=segments(editor.state.doc).find(s=>s.id===request.target.id);if(segment)segment.node.forEach((child,offset)=>{const pos=segment.offset+1+offset;visit(child,pos);if(['paragraph','heading','codeBlock'].includes(child.type.name)){text+='\n';positions.push(pos+child.nodeSize-1);}});else visit(editor.state.doc,0);
 const match=literalMatches(text,request.query,request.options)[request.hit.ordinal];if(!match)return false;
 // A changed occurrence is never silently redirected to another equal word.
 if(text.slice(match.from,match.to)!==request.hit.match||text.slice(Math.max(0,match.from-45),match.from)!==request.hit.before||text.slice(match.to,match.to+65)!==request.hit.after)return false;
 const from=positions[match.from],to=positions[match.to-1]+1;if(from===undefined||!to)return false;
 editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc,from,to)).setMeta('addToHistory',false).scrollIntoView());editor.view.focus();return true;
}
