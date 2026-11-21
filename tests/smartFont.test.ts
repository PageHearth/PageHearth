import {it,expect,vi} from 'vitest';
import {getSchema} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {EditorState,TextSelection,AllSelection} from '@tiptap/pm/state';
import {history,undo,redo,closeHistory} from '@tiptap/pm/history';
import {SmartFont,activeFont,fontTransaction} from '../src/renderer/smartFont';
import {EntityReferenceMark} from '../src/renderer/entityReference';
import {normalizeFontFamilies,validFontFamily} from '../src/shared/fonts';
import {createFontCatalog} from '../src/main/fontCatalog';
import {resolveEditorView} from '../src/shared/draft';
import {Store} from '../src/main/storage';
import {restoreBackup} from '../src/main/archive';
import {createEntity,manuscriptOccurrences} from '../src/shared/worldBible';
import {validate,type Doc} from '../src/shared/model';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const schema=getSchema([StarterKit,SmartFont,EntityReferenceMark]);
const font=(name:string)=>schema.marks.textStyle.create({fontFamily:name});
const reference=schema.marks.entityReference.create({targetId:crypto.randomUUID(),occurrenceId:crypto.randomUUID()});
function base(){const doc=schema.node('doc',null,[schema.node('paragraph',null,[schema.text('Before '),schema.text('Mina',[reference,schema.marks.bold.create(),schema.marks.italic.create(),schema.marks.underline.create()]),schema.text(' after')])]);return EditorState.create({doc,selection:TextSelection.create(doc,9,11),plugins:[history()]});}
it('font affects only selected characters and composes with reference/B/I/U',()=>{let state=base();const original=state.doc.textContent;state=state.apply(fontTransaction(state,'Consolas')!);expect(state.doc.textContent).toBe(original);expect(state.doc.nodeAt(8)!.marks.some(m=>m.type.name==='textStyle')).toBe(false);expect(state.doc.nodeAt(9)!.marks.map(m=>m.type.name)).toEqual(expect.arrayContaining(['textStyle','entityReference','bold','italic','underline']));expect(state.doc.nodeAt(11)!.marks.some(m=>m.type.name==='textStyle')).toBe(false);state=state.apply(fontTransaction(state,null)!);expect(state.doc.eq(base().doc)).toBe(true);});
it('collapsed caret changes stored marks only, then new typing inherits',()=>{let state=base();state=state.apply(state.tr.setSelection(TextSelection.create(state.doc,2)));const original=state.doc;state=state.apply(fontTransaction(state,'Georgia')!);expect(state.doc).toBe(original);expect(activeFont(state)).toBe('Georgia');state=state.apply(state.tr.insertText('X'));expect(state.doc.nodeAt(2)!.marks).toContainEqual(font('Georgia'));expect(state.doc.nodeAt(1)!.marks).not.toContainEqual(font('Georgia'));state=state.apply(fontTransaction(state,null)!);expect(activeFont(state)).toBeNull();});
it('caret/default/mixed state inspects selected text rather than first character',()=>{let state=base();state=state.apply(fontTransaction(state,'Arial')!);expect(activeFont(state)).toBe('Arial');state=state.apply(state.tr.setSelection(TextSelection.create(state.doc,10)));expect(activeFont(state)).toBe('Arial');state=state.apply(state.tr.setSelection(TextSelection.create(state.doc,8,12)));expect(activeFont(state)).toBe('Mixed');state=state.apply(state.tr.addMark(8,9,font('Consolas')));expect(activeFont(state)).toBe('Mixed');state=state.apply(state.tr.setSelection(TextSelection.create(state.doc,1,4)));expect(activeFont(state)).toBeNull();});
it('font and clear use ordinary undo/redo; headings/lists retain structure',()=>{const doc=schema.node('doc',null,[schema.node('heading',{level:2},schema.text('Title')),schema.node('bulletList',null,[schema.node('listItem',null,[schema.node('paragraph',null,schema.text('Item'))])])]);let state=EditorState.create({doc,selection:TextSelection.create(doc,1,doc.content.size-3),plugins:[history()]});state=state.apply(fontTransaction(state,'Missing Portable Family')!);expect(state.doc.child(0).type.name).toBe('heading');expect(state.doc.child(1).type.name).toBe('bulletList');expect(undo(state,tr=>{state=state.apply(tr);})).toBe(true);expect(state.doc.eq(doc)).toBe(true);expect(redo(state,tr=>{state=state.apply(tr);})).toBe(true);state=state.apply(closeHistory(state.tr.setSelection(TextSelection.create(state.doc,1,state.doc.content.size-3))));state=state.apply(fontTransaction(state,null)!);expect(activeFont(state)).toBeNull();expect(undo(state,tr=>{state=state.apply(tr);})).toBe(true);expect(activeFont(state)).toBe('Missing Portable Family');});
it('catalog normalizes families without inventing style duplicates; failures are cached and local',async()=>{expect(normalizeFontFamilies([' Arial ','arial','',null,'@Arial','Noto  Sans','bad;style','字体'])).toEqual(['Arial','Noto Sans','字体']);const provider=vi.fn().mockResolvedValue(['Arial','Arial']);const get=createFontCatalog(provider,'win32');expect(await get()).toEqual({source:'installed',families:['Arial']});await get();expect(provider).toHaveBeenCalledTimes(1);const bad=vi.fn().mockRejectedValue(Error('unavailable'));const fallback=createFontCatalog(bad,'win32');expect((await fallback()).families.length).toBeGreaterThan(20);expect((await fallback()).source).toBe('fallback');expect(bad).toHaveBeenCalledTimes(1);const unsupported=vi.fn();expect((await createFontCatalog(unsupported,'linux')()).source).toBe('fallback');expect(unsupported).not.toHaveBeenCalled();});
it.each([undefined,null,'pages','invalid'])('missing/non-continuous preference %s resolves to Page View without mutation',value=>{expect(resolveEditorView(value)).toBe('pages');expect(resolveEditorView('continuous')).toBe('continuous');});
it('invalid font styles fail closed',()=>{for(const bad of ['', 'font; color:red','x\\y','x\n','x,'.repeat(100)]){expect(validFontFamily(bad)).toBe(false);expect(()=>fontTransaction(base(),bad)).toThrow('Invalid font');}});
it('font spans survive protection/recovery/restart/verified backup restore and keep one reference occurrence',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'pagehearth-font-')),root=path.join(dir,'Novel');await fs.mkdir(root);let store=new Store(root);let restored:Store|undefined;
 try{await store.create('Fonts');const made=createEntity(store.project,'character','Mina');await store.commit(made.project);const id=store.project.manifest.nodes[0].id,occurrenceId=crypto.randomUUID();
 const doc=schema.node('doc',null,[schema.node('paragraph',null,[schema.text('Mina',[schema.marks.entityReference.create({targetId:made.id,occurrenceId})])])]);let state=EditorState.create({doc,selection:TextSelection.create(doc,2,4)});state=state.apply(fontTransaction(state,'Unavailable Portable Family')!);const json=state.doc.toJSON() as Doc;
 await store.stageDocument(id,json);await store.release();store=new Store(root);await store.open(async()=>true);expect(store.project.documents[id]).toEqual(json);expect(manuscriptOccurrences(store.project,made.id)).toEqual([expect.objectContaining({occurrenceId,visibleText:'Mina',from:1,to:5,total:1})]);validate(store.project);
 const backup=await store.backup();await Store.verifyBackup(backup);const destination=await restoreBackup(backup,dir);restored=new Store(destination);await restored.open();expect(restored.project.documents[id]).toEqual(json);
 const project=structuredClone(store.project);project.manifest.settings.workspace.editorView='continuous';await store.commit(project);await store.release();store=new Store(root);await store.open();expect(resolveEditorView(store.project.manifest.settings.workspace.editorView)).toBe('continuous');project.manifest.settings.workspace.editorView='pages';await store.commit({...store.project,manifest:{...store.project.manifest,settings:project.manifest.settings}});await store.release();store=new Store(root);await store.open();expect(resolveEditorView(store.project.manifest.settings.workspace.editorView)).toBe('pages');expect(store.project.documents[id]).toEqual(json);
 }finally{await restored?.release();await store.release();await fs.rm(dir,{recursive:true,force:true});}
});

it('explicit Select All applies font while retaining separate reference identities',()=>{
 const targetId=crypto.randomUUID(),first=crypto.randomUUID(),second=crypto.randomUUID();
 const doc=schema.node('doc',null,[schema.node('paragraph',null,[schema.text('Mina',[schema.marks.entityReference.create({targetId,occurrenceId:first})]),schema.text('Mina',[schema.marks.entityReference.create({targetId,occurrenceId:second})])])]);
 let state=EditorState.create({doc,selection:new AllSelection(doc)});state=state.apply(fontTransaction(state,'Georgia')!);
 expect(activeFont(state)).toBe('Georgia');expect(state.doc.textContent).toBe('MinaMina');
 const project={manifest:{nodes:[{id:'chapter',title:'Chapter'}]},documents:{chapter:state.doc.toJSON()}} as any;
 const spans=manuscriptOccurrences(project,targetId);expect(spans).toHaveLength(2);expect(spans.map(s=>s.occurrenceId)).toEqual([first,second]);
});
