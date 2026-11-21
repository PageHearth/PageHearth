import {referenceRanges} from '../shared/referenceIntegrity';
import type {EditorState} from '@tiptap/pm/state';
import {TextSelection} from '@tiptap/pm/state';
export function captureReferenceFormat(state:EditorState,from:number,to:number,trigger=false){return {doc:state.doc,from,to,trigger,marks:state.storedMarks??state.doc.resolve(to).marks()};}
export function createReferenceTransaction(state:EditorState,saved:ReturnType<typeof captureReferenceFormat>,targetId:string,occurrenceId:string){
 if(state.doc!==saved.doc)throw Error('The text changed. Select it again before creating a reference.');
 const {from,to,trigger}=saved,tr=state.tr;let end=to;
 if(from>=to||referenceRanges(state.doc.toJSON()).some(r=>r.from<to&&r.to>from))throw Error('Select unlinked text within one paragraph.');
 if(state.doc.resolve(from).parent!==state.doc.resolve(to).parent)throw Error('Select text within one paragraph.');
 if(trigger){if(state.doc.textBetween(from,from+2)!=='[['||state.doc.textBetween(to-2,to)!==']]')throw Error('Reference trigger changed.');tr.delete(to-2,to).delete(from,from+2);end-=4;}
 tr.addMark(from,end,state.schema.marks.entityReference.create({targetId,occurrenceId}));
 tr.setSelection(TextSelection.near(tr.doc.resolve(end)));
 tr.setStoredMarks(saved.marks.filter(mark=>mark.type.name!=='entityReference'));
 referenceRanges(tr.doc.toJSON());return tr;
}
