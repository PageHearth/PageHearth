import type {EditorState} from '@tiptap/pm/state';
export type PressedState=boolean|'mixed';
export type FormatToggle='bold'|'italic'|'underline'|'heading'|'list';
const aggregate=(values:Set<string>,off:string):PressedState=>values.size>1?'mixed':values.size===1&&!values.has(off);
/** Read only the current caret or selected range. Never dispatch or persist UI reflection. */
export function formattingState(state:EditorState){
 const marks={bold:new Set<string>(),italic:new Set<string>(),underline:new Set<string>()},headings=new Set<string>(),lists=new Set<string>();
 const collectMarks=(active:readonly {type:{name:string}}[])=>{for(const name of ['bold','italic','underline'] as const)marks[name].add(active.some(m=>m.type.name===name)?'on':'off');};
 const collectBlock=(pos:number)=>{const resolved=state.doc.resolve(pos);headings.add(resolved.parent.type.name==='heading'?String(resolved.parent.attrs.level):'off');let list='off';for(let depth=resolved.depth;depth>0;depth--){const name=resolved.node(depth).type.name;if(['bulletList','orderedList','taskList'].includes(name)){list=name;break;}}lists.add(list);};
 if(state.selection.empty){collectMarks(state.storedMarks??state.selection.$from.marks());collectBlock(state.selection.from);}
 else state.doc.nodesBetween(state.selection.from,state.selection.to,(node,pos)=>{if(node.isText)collectMarks(node.marks);if(node.isTextblock)collectBlock(pos+1);});
 const pressed:Record<FormatToggle,PressedState>={bold:aggregate(marks.bold,'off'),italic:aggregate(marks.italic,'off'),underline:aggregate(marks.underline,'off'),heading:aggregate(headings,'off'),list:aggregate(lists,'off')};
 return {pressed,heading:pressed.heading===true?'Heading '+[...headings][0]:pressed.heading==='mixed'?'Mixed headings / blocks':'Paragraph',list:pressed.list===true?([...lists][0]==='bulletList'?'Bullet list':[...lists][0]==='orderedList'?'Numbered list':'Task list'):pressed.list==='mixed'?'Mixed list contexts':'Not in a list'};
}
