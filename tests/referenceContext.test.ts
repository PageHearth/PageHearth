import {describe,expect,it} from 'vitest';
import {Schema} from '@tiptap/pm/model';
import {EditorState} from '@tiptap/pm/state';
import {history,undo,redo} from '@tiptap/pm/history';
import {occurrenceAt,removeOccurrence,selectionReferenceContext} from '../src/renderer/referenceContext';
const schema=new Schema({nodes:{doc:{content:'paragraph+'},paragraph:{content:'text*'},text:{}},marks:{entityReference:{attrs:{targetId:{},occurrenceId:{}}},bold:{}}});
const reference=schema.marks.entityReference.create({targetId:'11111111-1111-4111-8111-111111111111',occurrenceId:'33333333-3333-4333-8333-333333333333'}),other=schema.marks.entityReference.create({targetId:'22222222-2222-4222-8222-222222222222',occurrenceId:'44444444-4444-4444-8444-444444444444'});
function document(){return schema.node('doc',null,[schema.node('paragraph',null,[schema.text('Before '),schema.text('Mi',[reference]),schema.text('na',[reference,schema.marks.bold.create()]),schema.text(' after '),schema.text('Other',[other])])]);}
describe('occurrence removal without text selection',()=>{
  it('resolves a split-format occurrence and removes only its mark while retaining text and other references',()=>{
    const doc=document(),found=occurrenceAt(doc,8)!;expect(found.ranges).toEqual([{from:8,to:12}]);const state=EditorState.create({doc});const transaction=removeOccurrence(state,doc,found)!;
    expect(transaction.doc.textContent).toBe(doc.textContent);expect(occurrenceAt(transaction.doc,8)).toBeNull();expect(transaction.doc.nodeAt(10)?.marks.some(m=>m.type.name==='bold')).toBe(true);expect(occurrenceAt(transaction.doc,19)?.occurrenceId).toBe('44444444-4444-4444-8444-444444444444');
  });
  it('rejects a stale document context and ignores ordinary text',()=>{const doc=document(),state=EditorState.create({doc});expect(occurrenceAt(doc,2)).toBeNull();expect(removeOccurrence(state.apply(state.tr.insertText('x',1)),doc,occurrenceAt(doc,8)!)).toBeNull();});
  it('participates in ordinary editor undo/redo without changing words',()=>{const doc=document();let state=EditorState.create({doc,plugins:[history()]});state=state.apply(removeOccurrence(state,doc,occurrenceAt(doc,8)!)!);expect(occurrenceAt(state.doc,8)).toBeNull();expect(undo(state,tr=>{state=state.apply(tr);})).toBe(true);expect(state.doc.eq(doc)).toBe(true);expect(redo(state,tr=>{state=state.apply(tr);})).toBe(true);expect(state.doc.textContent).toBe(doc.textContent);expect(occurrenceAt(state.doc,8)).toBeNull();});
});

it('context selection matrix refuses mixed boundaries and permits missing-target removal',()=>{
 const doc=document();expect(selectionReferenceContext(doc,1,1,2)).toBeNull();expect(selectionReferenceContext(doc,1,7,2)?.kind).toBe('add');
 expect(selectionReferenceContext(doc,8,8,8)?.kind).toBe('remove');expect(selectionReferenceContext(doc,8,12,8)?.kind).toBe('remove');
 expect(selectionReferenceContext(doc,7,12,8)).toBeNull();expect(selectionReferenceContext(doc,8,14,8)).toBeNull();expect(selectionReferenceContext(doc,8,24,8)).toBeNull();expect(selectionReferenceContext(doc,8,12,2)).toBeNull();
});
