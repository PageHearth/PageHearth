import {describe,it,expect} from 'vitest';
import {TrailingNode} from '@tiptap/extensions';
import {getSchema} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {EditorState,TextSelection} from '@tiptap/pm/state';
import {history,undo,redo,closeHistory,undoDepth,redoDepth} from '@tiptap/pm/history';
import {compositeBody,readScope,scopeDocuments} from '../src/shared/continuous';
import {ManuscriptDocument,ManuscriptSegment,canonicalPosition,compositePosition,changedSegments,safeCompositeTransaction,canonicalClipboard,clipboardPlainText,segments,manuscriptTrailingNode} from '../src/renderer/continuous';
import {defaultAuthor,type Project,type Doc} from '../src/shared/model';
const body=(text:string):Doc=>({type:'doc',content:[{type:'paragraph',content:text?[{type:'text',text}]:[]}]});
const schema=getSchema([StarterKit.configure({document:false}),ManuscriptDocument,ManuscriptSegment]);
function fixture(){const nodes=[{id:'a',parent:null,kind:'Chapter' as const,title:'Chapter'},{id:'b',parent:'a',kind:'Scene' as const,title:'Same'},{id:'c',parent:'a',kind:'Scene' as const,title:'Same'},{id:'d',parent:null,kind:'Chapter' as const,title:'Last'}];return {manifest:{version:1,id:'p',revision:0,title:'Test',nodes,settings:{editor:{},publication:{},workspace:{}}},documents:Object.fromEntries(nodes.map(n=>[n.id,body(n.id==='a'?'parent prose':n.id)])),author:defaultAuthor(),recovery:[]} as Project;}
function state(){const p=fixture();return EditorState.create({schema,doc:schema.nodeFromJSON(compositeBody(p,scopeDocuments(p,{kind:'all'}))),plugins:[history()]});}
describe('Continuous manuscript projection',()=>{
 it('includes parent body before scenes, deduplicates overlapping roots in canonical order',()=>{const p=fixture();expect(scopeDocuments(p,{kind:'roots',ids:['c','a','b']})).toEqual(['a','b','c']);expect(scopeDocuments(p,{kind:'all'})).toEqual(['a','b','c','d']);});
 it('excludes Trash, preserves Scenes Off prose and ignores other systems',()=>{const p=fixture();p.manifest.nodes[1].trashed=true;p.author.scenes='off';expect(scopeDocuments(p,{kind:'all'})).toEqual(['a','c','d']);p.manifest.nodes[0].trashed=true;expect(scopeDocuments(p,{kind:'all'})).toEqual(['d']);});
 it('supports empty and single scopes and sanitizes old preferences',()=>{const p=fixture();expect(readScope(undefined,p)).toBe(null);expect(readScope({kind:'roots',ids:['missing']},p)).toBe(null);expect(scopeDocuments(p,{kind:'roots',ids:['d']})).toEqual(['d']);expect(scopeDocuments(p,{kind:'roots',ids:[]})).toEqual([]);});
 it('maps every local position to the same stable owner, including empty segments',()=>{const p=fixture();p.documents.b=body('');const doc=schema.nodeFromJSON(compositeBody(p,scopeDocuments(p,{kind:'all'})));for(const s of segments(doc)){for(let i=1;i<s.node.content.size;i++)expect(canonicalPosition(doc,compositePosition(doc,s.id,i)!)).toEqual({id:s.id,pos:i});}});
 it('extracts only the changed document and never persists wrapper/title',()=>{const s=state(),pos=compositePosition(s.doc,'b',1)!,tr=s.tr.insertText('new ',pos);expect(safeCompositeTransaction(tr,s)).toBe(true);expect(changedSegments(s.doc,tr.doc)).toEqual([{id:'b',body:body('new b')}]);});
 it('blocks removal/reorder/duplication of boundary identity',()=>{const s=state(),parts=segments(s.doc);expect(safeCompositeTransaction(s.tr.delete(parts[1].offset,parts[1].offset+parts[1].node.nodeSize),s)).toBe(false);expect(safeCompositeTransaction(s.tr.setNodeMarkup(parts[0].offset,undefined,{documentId:'b'}),s)).toBe(false);});
 it('blocks cross-document replacement and formatting but permits read selection',()=>{let s=state();s=s.apply(s.tr.setSelection(TextSelection.create(s.doc,compositePosition(s.doc,'b',1)!,compositePosition(s.doc,'c',2)!)));expect(safeCompositeTransaction(s.tr.insertText('replace'),s)).toBe(false);expect(safeCompositeTransaction(s.tr.addMark(s.selection.from,s.selection.to,schema.marks.bold.create()),s)).toBe(false);expect(safeCompositeTransaction(s.tr.setSelection(TextSelection.create(s.doc,2)),s)).toBe(true);});
 it('copy unwraps segments and retains rich marks without titles or IDs',()=>{const s=state(),tr=s.tr.addMark(2,8,schema.marks.bold.create()),slice=canonicalClipboard(tr.doc.slice(0,tr.doc.content.size));expect(slice.content.toJSON().some((n:any)=>n.type==='manuscriptSegment')).toBe(false);expect(JSON.stringify(slice.toJSON())).not.toContain('documentId');expect(slice.content.firstChild!.firstChild!.marks[0].type.name).toBe('bold');});
 it('undo/redo follows A B A edit order with one body per transaction',()=>{let s=state();const original=s.doc;for(const id of ['a','b','a']){s=s.apply(closeHistory(s.tr));const tr=s.tr.insertText('!',compositePosition(s.doc,id,1)!);s=s.apply(tr);}const edited=s.doc;for(let i=0;i<3;i++)undo(s,tr=>{expect(safeCompositeTransaction(tr,s)).toBe(true);s=s.apply(tr);});expect(s.doc.eq(original)).toBe(true);for(let i=0;i<3;i++)redo(s,tr=>{expect(safeCompositeTransaction(tr,s)).toBe(true);s=s.apply(tr);});expect(s.doc.eq(edited)).toBe(true);});
 it('scope follows reorder, creation, move-out and restore without copied bodies',()=>{const p=fixture(),scope={kind:'roots' as const,ids:['a']};p.manifest.nodes=[p.manifest.nodes[0],p.manifest.nodes[2],p.manifest.nodes[1],p.manifest.nodes[3]];expect(scopeDocuments(p,scope)).toEqual(['a','c','b']);p.manifest.nodes[1].parent=null;expect(scopeDocuments(p,scope)).toEqual(['a','b']);p.manifest.nodes[2].trashed=true;expect(scopeDocuments(p,scope)).toEqual(['a']);p.manifest.nodes[2].trashed=false;expect(scopeDocuments(p,scope)).toEqual(['a','b']);});
});

import {afterEach} from 'vitest';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {Store} from '../src/main/storage';
import {restoreBackup} from '../src/main/archive';
import {plain,validate} from '../src/shared/model';
import {SearchIndexService} from '../src/shared/search';
const roots:string[]=[],stores:Store[]=[];
afterEach(async()=>{for(const s of stores.splice(0))await s.release();for(const root of roots.splice(0))await fs.rm(root,{recursive:true,force:true});});
it('protects three projected owners, recovers without canonical save, snapshots and restores a portable backup',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pagehearth-continuous-'));roots.push(root);const store=new Store(root);stores.push(store);await store.create('Continuous');const p=structuredClone(store.project),a=p.manifest.nodes[0].id,b=randomUUID(),c=randomUUID();for(const id of [b,c]){p.manifest.nodes.push({id,parent:a,title:'Scene',kind:'Scene'});p.documents[id]=body('old');}p.manifest.settings.workspace.manuscriptScope={kind:'all'};await store.commit(p);
 let state=EditorState.create({schema,doc:schema.nodeFromJSON(compositeBody(store.project,scopeDocuments(store.project,{kind:'all'})))});const latest={...store.project,documents:{...store.project.documents}};
 for(const id of [a,b,c]){state=state.apply(state.tr.setSelection(TextSelection.create(state.doc,compositePosition(state.doc,id,1)!)));const tr=state.tr.insertText('protected '+id+' ');expect(safeCompositeTransaction(tr,state)).toBe(true);const updates=changedSegments(state.doc,tr.doc);expect(updates).toHaveLength(1);latest.documents[id]=updates[0].body;await store.stageDocument(id,updates[0].body);state=state.apply(tr);}
 validate(latest);expect(await fs.readdir(path.join(root,'.storyloom','drafts'))).toHaveLength(3);
 await store.release();const reopened=new Store(root);stores.push(reopened);await reopened.open();for(const id of [a,b,c])expect(plain(reopened.project.documents[id])).toContain('protected '+id);
 const snap=(await reopened.history.capture(b,reopened.project.documents[b]))!;const index=new SearchIndexService();index.update(reopened.project);expect(index.query('protected')).toHaveLength(3);const archive=await reopened.backup();await expect(Store.verifyBackup(archive)).resolves.toBe(true);const restored=await restoreBackup(archive,path.dirname(root));roots.push(restored);const restoredStore=new Store(restored);stores.push(restoredStore);await restoredStore.open();expect(scopeDocuments(restoredStore.project,{kind:'all'})).toEqual([a,b,c]);expect((await restoredStore.history.read(b,snap.id)).body).toEqual(reopened.project.documents[b]);expect((await fs.readdir(path.join(restored,'manuscript'))).sort()).toEqual([a,b,c].map(id=>id+'.json').sort());
});
it('workspace scope alone does not create backup churn or change canonical document schema',async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'pagehearth-continuous-'));roots.push(root);const s=new Store(root);stores.push(s);await s.create('Scope');await s.backup();const p=structuredClone(s.project);p.manifest.settings.workspace.manuscriptScope={kind:'all'};await s.commit(p);expect(s.backupDirty).toBe(false);validate(s.project);});

it('clipboard preserves soft line breaks while removing composite wrappers',()=>{const p=fixture();p.documents.a={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'before'},{type:'hardBreak'},{type:'text',text:'after'}]}]};const doc=schema.nodeFromJSON(compositeBody(p,['a']));expect(clipboardPlainText(doc.slice(0,doc.content.size))).toBe('before\nafter');});

function guardedState(blocked:()=>void,configured=true){
 const trailing=(TrailingNode.config.addProseMirrorPlugins as Function).call({editor:{schema},options:configured?manuscriptTrailingNode:{notAfter:[]}});
 const guard=(ManuscriptSegment.config.addProseMirrorPlugins as Function).call({options:{blocked}});
 return EditorState.create({schema,doc:state().doc,plugins:[...guard,...trailing,history()]});
}
it('reproduces rejected trailing paragraphs on caret movement with the old StarterKit configuration',async()=>{
 let notices=0,s=guardedState(()=>notices++,false);const before=s.doc;
 s=s.apply(s.tr.setSelection(TextSelection.create(s.doc,3)));await Promise.resolve();
 expect(notices).toBeGreaterThan(0);expect(s.doc.eq(before)).toBe(true);expect(undoDepth(s)).toBe(0);
});
it('configured trailing-node plugin never attempts an unowned paragraph on selection/navigation',async()=>{
 let notices=0,s=guardedState(()=>notices++);const before=s.doc;
 for(const [from,to] of [[2,3],[2,before.content.size-2],[3,3],[before.content.size-2,before.content.size-2],[2,2]]){
 const result=s.applyTransaction(s.tr.setSelection(TextSelection.create(s.doc,from,to)));
 expect(result.transactions.every(tr=>!tr.docChanged)).toBe(true);s=result.state;
 }
 await Promise.resolve();expect(notices).toBe(0);expect(s.doc.eq(before)).toBe(true);expect(undoDepth(s)).toBe(0);
});
it('blocked mutations notify once each, keep prose/history identical, then permit normal editing',async()=>{
 let notices=0,s=guardedState(()=>notices++);s=s.apply(s.tr.setSelection(TextSelection.create(s.doc,2,s.doc.content.size-2)));const before=s.doc;
 for(const kind of ['type','delete','paste','format']){
 const tr=kind==='format'?s.tr.addMark(s.selection.from,s.selection.to,schema.marks.bold.create()):kind==='delete'?s.tr.deleteSelection():s.tr.insertText(kind);
 expect(s.applyTransaction(tr).transactions).toHaveLength(0);await Promise.resolve();
 }
 expect(notices).toBe(4);expect(s.doc.eq(before)).toBe(true);expect(undoDepth(s)).toBe(0);expect(redoDepth(s)).toBe(0);
 s=s.apply(s.tr.setSelection(TextSelection.create(s.doc,3)));s=s.apply(s.tr.insertText('safe'));
 await Promise.resolve();expect(notices).toBe(4);expect(undoDepth(s)).toBe(1);expect(changedSegments(before,s.doc)).toHaveLength(1);
});
it('Single-document trailing paragraph behavior remains enabled after a heading',()=>{
 const trailing=(TrailingNode.config.addProseMirrorPlugins as Function).call({editor:{schema},options:manuscriptTrailingNode});
 let s=EditorState.create({schema,doc:schema.node('doc',null,[schema.node('heading',null,[schema.text('Title')])]),plugins:trailing});
 s=s.apply(s.tr.setSelection(TextSelection.create(s.doc,2)));expect(s.doc.lastChild?.type.name).toBe('paragraph');
});
