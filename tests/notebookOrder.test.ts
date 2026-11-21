import {it,expect} from 'vitest';
import {blank,defaultAuthor,type Project} from '../src/shared/model';
import {createFolder,createNote,reorderNote} from '../src/shared/author';
import {Store} from '../src/main/storage';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {changeTree} from '../src/shared/tree';
function fixture(){let p:Project={manifest:{id:crypto.randomUUID(),version:1,title:'Order',revision:0,nodes:[],settings:{editor:{},publication:{},workspace:{}}},documents:{},author:defaultAuthor(),recovery:[]};const folder=createFolder(p,null,'Folder');p=folder.project;for(const [title,f] of [['A',null],['B',folder.id],['C',null]] as const)p=createNote(p,f,title,blank()).project;return p;}
const ordered=(p:Project)=>p.author.notebook.notes.slice().sort((a,b)=>a.order-b.order);
it('All Notes arrows cross folder boundaries without moving membership or rebuilding content',()=>{const p=fixture(),before=ordered(p),id=before[1].id;const next=reorderNote(p,id,-1,'all');expect(ordered(next).map(n=>n.id)).toEqual([id,before[0].id,before[2].id]);expect(next.documents).toBe(p.documents);for(const note of next.author.notebook.notes){const old=p.author.notebook.notes.find(n=>n.id===note.id)!;expect(note.body).toBe(old.body);expect({...note,order:old.order}).toEqual(old);}expect(ordered(reorderNote(next,id,1,'all')).map(n=>n.id)).toEqual(before.map(n=>n.id));expect(new Set(next.author.notebook.notes.map(n=>n.id)).size).toBe(3);});
it('ties normalize on intentional move; boundaries are identity no-ops',()=>{const p=fixture();p.author.notebook.notes.forEach(n=>n.order=0);const [a,b,c]=ordered(p);expect(reorderNote(p,a.id,-1,'all')).toBe(p);expect(reorderNote(p,c.id,1,'all')).toBe(p);const next=reorderNote(p,b.id,1,'all');expect(ordered(next).map(n=>n.id)).toEqual([a.id,c.id,b.id]);});
it('folder order affects only compatible active peers and survives serialization',()=>{const p=fixture(),[a,b,c]=p.author.notebook.notes;b.favorite=true;const next=reorderNote(p,c.id,-1);expect(ordered(next).filter(n=>n.folder===null).map(n=>n.id)).toEqual([c.id,a.id]);expect(next.author.notebook.notes.find(n=>n.id===b.id)).toBe(b);const restored=JSON.parse(JSON.stringify(next));expect(ordered(restored).map(n=>n.id)).toEqual(ordered(next).map(n=>n.id));});
it('persists repaired Note order and canonical Outliner placement through real Store reopen',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pagehearth-order-'));const store=new Store(root),reopened=new Store(root);
 try{await store.create('Order durability');let p=store.project;const f=createFolder(p,null,'Filed');p=createNote(f.project,null,'A').project;p=createNote(p,f.id,'B').project;const b=p.author.notebook.notes.find(n=>n.title==='B')!;p=reorderNote(p,b.id,-1,'all');const node={id:crypto.randomUUID(),title:'Second',parent:null,kind:'Chapter' as const};p={...p,manifest:{...p.manifest,nodes:[...p.manifest.nodes,node]},documents:{...p.documents,[node.id]:blank()}};p=changeTree(p,{kind:'move',ids:[node.id],target:p.manifest.nodes[0].id,placement:'before'});await store.commit(p);await store.release();await reopened.open();expect(ordered(reopened.project).map(n=>n.id)).toEqual(ordered(p).map(n=>n.id));expect(reopened.project.author.notebook.notes).toEqual(p.author.notebook.notes);expect(reopened.project.manifest.nodes).toEqual(p.manifest.nodes);
 }finally{await store.release();await reopened.release();await fs.rm(root,{recursive:true,force:true});}
});
