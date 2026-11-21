import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {readFileSync,promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {Schema} from '@tiptap/pm/model';
import {EditorState,TextSelection} from '@tiptap/pm/state';
import {history,undo,redo,closeHistory} from '@tiptap/pm/history';
import {EditorCommandBar} from '../src/renderer/EditorCommandBar';
import {createDraftPagePlugin,draftPageKey,firstOffsetOnLine} from '../src/renderer/draftPagePresentation';
import {resolveEditorView} from '../src/shared/draft';
import {Store} from '../src/main/storage';
import {createCollection,addCollectionMembers} from '../src/shared/collections';
const schema=new Schema({nodes:{doc:{content:'paragraph+'},paragraph:{content:'text*'},text:{}},marks:{entityReference:{attrs:{targetId:{},occurrenceId:{}}}}});
it('visual page transactions preserve document, selection, marks, clipboard slice and history',()=>{
 const doc=schema.node('doc',null,[schema.node('paragraph',null,[schema.text('across boundary',[schema.marks.entityReference.create({targetId:'target',occurrenceId:'one'})])])]);
 let state=EditorState.create({doc,selection:TextSelection.create(doc,2,12),plugins:[history(),createDraftPagePlugin()]});const slice=state.selection.content().toJSON();
 const tr=state.tr.setMeta(draftPageKey,[8]);expect(tr.docChanged).toBe(false);state=state.apply(tr);expect(state.doc).toBe(doc);expect(state.selection.content().toJSON()).toEqual(slice);expect(draftPageKey.getState(state)!.find()).toHaveLength(1);
 state=state.apply(closeHistory(state.tr));state=state.apply(state.tr.insertText('edited',6,10));expect(undo(state,tr=>{state=state.apply(tr);})).toBe(true);expect(state.doc.eq(doc)).toBe(true);expect(redo(state,tr=>{state=state.apply(tr);})).toBe(true);
 state=state.apply(state.tr.setMeta(draftPageKey,[]));expect(draftPageKey.getState(state)!.find()).toHaveLength(0);expect(JSON.stringify(state.doc.toJSON())).not.toContain('draft-page');
});
it('locates long-paragraph line boundaries with logarithmic probes',()=>{let calls=0;expect(firstOffsetOnLine(200000,800,index=>{calls++;return Math.floor(index/80)*20;})).toBe(3200);expect(calls).toBeLessThan(20);});
it('renders one formatting/utility toolbar without removed permanent actions',()=>{
 const html=renderToStaticMarkup(React.createElement(EditorCommandBar,{editor:null,disabled:false,navigator:'none',tree:true,inspector:true,onNavigator:()=>{},onTree:()=>{},onInspector:()=>{}}));expect(html.match(/role="toolbar"/g)).toHaveLength(1);
 for(const absent of ['Enter Editor</button>','>Indent</button>','>Outdent</button>','Add to Collection','Reference:'])expect(html).not.toContain(absent);
 for(const label of ['bold','italic','underline','Heading','List','Undo','Redo','Navigator','Inspector'])expect(html).toContain(label);
 expect(html).not.toContain('More…');const main=readFileSync('src/renderer/main.tsx','utf8');expect(main).not.toContain('Open Project…</button></aside>');expect(main).toContain('onOpen={()=>void executeCommand(\'open-project\')}');
});
it('new projects default to Page View, old settings stay absent, and explicit preference persists',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pagehearth-view-'));let store=new Store(root);
 try{await store.create('Presentation');expect(store.project.manifest.settings.workspace.editorView).toBe('pages');const original=JSON.stringify(store.project.documents);const p=structuredClone(store.project);p.manifest.settings.workspace.editorView='continuous';await store.commit(p);await store.release();store=new Store(root);await store.open(async()=>true);expect(store.project.manifest.settings.workspace.editorView).toBe('continuous');expect(JSON.stringify(store.project.documents)).toBe(original);
 const legacy=structuredClone(store.project);delete legacy.manifest.settings.workspace.editorView;await store.commit(legacy);const before=await fs.readFile(store.manifestPath,'utf8');await store.release();store=new Store(root);await store.open(async()=>true);expect(store.project.manifest.settings.workspace).not.toHaveProperty('editorView');expect(resolveEditorView(store.project.manifest.settings.workspace.editorView)).toBe('pages');expect(await fs.readFile(store.manifestPath,'utf8')).toBe(before);expect(JSON.stringify(store.project.documents)).toBe(original);
 const made=createCollection(store.project,'Revision'),id=store.project.manifest.nodes[0].id,next=addCollectionMembers(made.project,made.id,[{type:'document',id}]);expect(next.manifest.nodes).toEqual(store.project.manifest.nodes);expect(next.documents).toEqual(store.project.documents);expect(next.author.collections!.items[0].members[0].id).toBe(id);
 }finally{await store.release();await fs.rm(root,{recursive:true,force:true});}
});
