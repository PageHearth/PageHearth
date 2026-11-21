import {describe,it,expect} from 'vitest';
import {getSchema} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {EditorState,TextSelection} from '@tiptap/pm/state';
import {captureCommandOrigin,validCommandOrigin} from '../src/renderer/commandOrigin';
import type {ManuscriptPanes} from '../src/renderer/manuscriptPanes';
const schema=getSchema([StarterKit]);
function fixture(){const doc=schema.nodeFromJSON({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Original paragraph'}]}]});return {epoch:1,active:{id:'a',documentId:'chapter',scope:null,editor:{state:EditorState.create({schema,doc,selection:TextSelection.create(doc,1,5)}),isDestroyed:false}}} as unknown as ManuscriptPanes;}
describe('ephemeral palette manuscript origin',()=>{
 it('reads only and preserves immutable selection/doc evidence',()=>{const p=fixture(),before=p.active.editor.state,c=captureCommandOrigin(p,'p');expect(p.active.editor.state).toBe(before);expect(c.doc).toBe(before.doc);expect(c.selection).toBe(before.selection);expect(validCommandOrigin(c,p,'p')).toBe(true);});
 it.each(['project','epoch','pane','document','body','selection','marks','scope','destroyed'])('refuses changed %s evidence',kind=>{const p=fixture(),a=p.active as any;if(kind==='marks')a.editor.state=a.editor.state.apply(a.editor.state.tr.setSelection(TextSelection.create(a.editor.state.doc,2)));const c=captureCommandOrigin(p,'p');let id='p';if(kind==='project')id='other';if(kind==='epoch')(p as any).epoch++;if(kind==='pane')a.id='b';if(kind==='document')a.documentId='different';if(kind==='body')a.editor.state=a.editor.state.apply(a.editor.state.tr.insertText('new',1));if(kind==='selection')a.editor.state=a.editor.state.apply(a.editor.state.tr.setSelection(TextSelection.create(a.editor.state.doc,2)));if(kind==='marks')a.editor.state=a.editor.state.apply(a.editor.state.tr.setStoredMarks([schema.marks.bold.create()]));if(kind==='scope')a.scope={kind:'all'};if(kind==='destroyed')a.editor.isDestroyed=true;expect(validCommandOrigin(c,p,id)).toBe(false);});
});
