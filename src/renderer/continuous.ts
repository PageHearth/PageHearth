import {Node as ExtensionNode} from '@tiptap/core';
import type {Editor} from '@tiptap/core';
import {Fragment,Slice,type Node as PMNode} from '@tiptap/pm/model';
import {Plugin,TextSelection,type EditorState,type Transaction} from '@tiptap/pm/state';
import {closeHistory} from '@tiptap/pm/history';
import type {Doc} from '../shared/model';

export type Segment={id:string;node:PMNode;offset:number};
export function segments(doc:PMNode):Segment[]{const list:Segment[]=[];doc.forEach((node,offset)=>{if(node.type.name==='manuscriptSegment')list.push({id:node.attrs.documentId,node,offset});});return list;}
export function segmentAt(doc:PMNode,pos:number):Segment|undefined{return segments(doc).find(s=>pos>s.offset&&pos<s.offset+s.node.nodeSize);}
export function canonicalPosition(doc:PMNode,pos:number){const s=segmentAt(doc,pos);return s?{id:s.id,pos:pos-s.offset-1}:null;}
export function compositePosition(doc:PMNode,id:string,pos:number){const s=segments(doc).find(s=>s.id===id);return s?s.offset+1+Math.max(1,Math.min(s.node.content.size-1,pos)):null;}
// A projected document already ends in its final canonical body. StarterKit must
// never append an unowned root paragraph after a segment on selection updates.
export const manuscriptTrailingNode={notAfter:['manuscriptSegment']};
export const boundaryMessage='That selection spans multiple documents. Edit within one document at a time to preserve manuscript structure.';
export function changedSegments(before:PMNode,after:PMNode):{id:string;body:Doc}[]{const old=segments(before);return segments(after).flatMap((s,i)=>old[i]?.node.content===s.node.content?[]:[{id:s.id,body:{type:'doc',content:s.node.toJSON().content}}]);}
/** Only the session owner may replace scope. Ordinary transactions cannot change IDs/order/wrappers. */
export function safeCompositeTransaction(tr:Transaction,state:EditorState):boolean{
 if(!tr.docChanged||tr.getMeta('continuous-refresh'))return true;
 const old=segments(state.doc);if(!old.length)return !segments(tr.doc).length;
 const next=segments(tr.doc);if(old.length!==next.length||next.length!==tr.doc.childCount)return false;
 if(old.some((s,i)=>s.id!==next[i].id))return false;
 let count=0;for(let i=0;i<old.length;i++){if(!old[i].node.content.eq(next[i].node.content))count++;}
 if(count>1)return false;
 // Read/copy across documents is supported. Mutations of that selection are not.
 const from=segmentAt(state.doc,state.selection.from),to=segmentAt(state.doc,state.selection.to);
 if(!tr.getMeta('history$')&&count&&(!from||!to||from.id!==to.id))return false;
 let nested=false;for(const s of next)s.node.descendants(n=>{if(n.type.name==='manuscriptSegment')nested=true;});return !nested;
}
function unwrapped(fragment:Fragment):Fragment{const nodes:PMNode[]=[];fragment.forEach(n=>{if(n.type.name==='manuscriptSegment')unwrapped(n.content).forEach(child=>nodes.push(child));else nodes.push(n);});return Fragment.from(nodes);}
export function canonicalClipboard(slice:Slice){let wrapped=false;slice.content.forEach(n=>{if(n.type.name==='manuscriptSegment')wrapped=true;});if(!wrapped)return slice;const content=unwrapped(slice.content);return Slice.maxOpen(content);}
export function clipboardPlainText(slice:Slice){const content=unwrapped(slice.content);return content.textBetween(0,content.size,'\n\n',node=>node.type.name==='hardBreak'?'\n':'');}
export const ManuscriptDocument=ExtensionNode.create({name:'doc',topNode:true,content:'block+ | manuscriptSegment+'});
export const ManuscriptSegment=ExtensionNode.create<{label:(id:string)=>string;open:(id:string)=>void;blocked:()=>void}>({
 name:'manuscriptSegment',content:'block+',isolating:true,defining:true,selectable:false,
 addOptions(){return {label:id=>id,open:()=>{},blocked:()=>{}};},
 addAttributes(){return {documentId:{default:null}};},
 parseHTML(){return [];},renderHTML(){return ['section',{'data-manuscript-segment':''},0];},
 addNodeView(){return ({node})=>{const dom=document.createElement('section');dom.className='manuscript-segment';dom.dataset.documentId=node.attrs.documentId;const header=document.createElement('div');header.className='manuscript-boundary';header.contentEditable='false';header.dataset.manuscriptUi='true';const button=document.createElement('button');button.type='button';button.textContent=this.options.label(node.attrs.documentId);button.setAttribute('aria-label','Open document independently: '+button.textContent);button.addEventListener('click',()=>this.options.open(node.attrs.documentId));header.append(button);const contentDOM=document.createElement('div');contentDOM.className='manuscript-body';dom.append(header,contentDOM);return {dom,contentDOM,stopEvent:event=>header.contains(event.target as globalThis.Node),ignoreMutation:m=>header.contains(m.target)};};},
 addProseMirrorPlugins(){const blocked=this.options.blocked;return [new Plugin({
  filterTransaction:(tr,state)=>{const safe=safeCompositeTransaction(tr,state);if(!safe)queueMicrotask(blocked);return safe;},
  props:{transformCopied:canonicalClipboard,transformPasted:canonicalClipboard,clipboardTextSerializer:clipboardPlainText,handleDOMEvents:{cut:(view,event)=>{if(segments(view.state.doc).length&&(!segmentAt(view.state.doc,view.state.selection.from)||segmentAt(view.state.doc,view.state.selection.from)?.id!==segmentAt(view.state.doc,view.state.selection.to)?.id)){event.preventDefault();blocked();return true;}return false;}},
   handleKeyDown:(view,event)=>{const {state}=view,s=segmentAt(state.doc,state.selection.head);if(!s)return false;
    if(state.selection.empty&&((event.key==='Backspace'&&state.selection.head===s.offset+2)||(event.key==='Delete'&&state.selection.head===s.offset+s.node.nodeSize-2))){event.preventDefault();return true;}
    const list=segments(state.doc),i=list.findIndex(x=>x.id===s.id);const target=state.selection.empty&&((event.key==='ArrowRight'||event.key==='ArrowDown')&&state.selection.head===s.offset+s.node.nodeSize-2)?list[i+1]:state.selection.empty&&((event.key==='ArrowLeft'||event.key==='ArrowUp')&&state.selection.head===s.offset+2)?list[i-1]:undefined;
    if(target&&!event.shiftKey){view.dispatch(state.tr.setSelection(TextSelection.create(state.doc,target.offset+(target.offset>s.offset?2:target.node.nodeSize-2))).scrollIntoView());event.preventDefault();return true;}return false;
   }},
  appendTransaction:(_trs,old,next)=>{if(segmentAt(old.doc,old.selection.head)?.id!==segmentAt(next.doc,next.selection.head)?.id)return closeHistory(next.tr);return null;}
 })];}
});
export function replaceSegment(editor:Editor,id:string,body:Doc){const s=segments(editor.state.doc).find(s=>s.id===id);if(!s)return false;editor.commands.setTextSelection(s.offset+2);const content=editor.schema.nodeFromJSON(body).content;editor.view.dispatch(editor.state.tr.replaceWith(s.offset+1,s.offset+s.node.nodeSize-1,content));return true;}
