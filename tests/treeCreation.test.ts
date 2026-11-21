import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Store} from '../src/main/storage';
import {blank,defaultAuthor,type Project,type TreeNode} from '../src/shared/model';
import {creationDestinations,defaultCreationParent,createTreeNode} from '../src/shared/treeCreation';
function fixture(){
  const [part,folder,chapter,scene]=Array.from({length:4},()=>randomUUID());
  const nodes:TreeNode[]=[{id:part,parent:null,kind:'Part',title:'Part'},{id:folder,parent:part,kind:'Folder',title:'Folder'},{id:chapter,parent:folder,kind:'Chapter',title:'Chapter'},{id:scene,parent:chapter,kind:'Scene',title:'Scene'}];
  const p:Project={manifest:{version:1,id:randomUUID(),title:'Creation',revision:0,nodes,settings:{editor:{},publication:{},workspace:{collapsed:[part,folder,chapter]}}},documents:Object.fromEntries(nodes.map(n=>[n.id,blank()])),author:{...defaultAuthor(),scenes:'available'},recovery:[]};
  return {p,part,folder,chapter,scene};
}
it('defaults Chapter to selected Part and all supported items to selected Folder',()=>{
  const {p,part,folder}=fixture();expect(defaultCreationParent(p,'Chapter',part)).toBe(part);
  for(const kind of ['Part','Chapter','Scene','Folder'] as const){expect(defaultCreationParent(p,kind,folder)).toBe(folder);const next=createTreeNode(p,kind,kind,folder,randomUUID());expect(next.manifest.nodes.at(-1)?.parent).toBe(folder);}
});
it('preserves Chapter/Scene contextual Scene creation and permits explicit root selection',()=>{
  const {p,chapter,scene,part}=fixture();expect(defaultCreationParent(p,'Scene',chapter)).toBe(chapter);expect(defaultCreationParent(p,'Scene',scene)).toBe(chapter);
  expect(defaultCreationParent(p,'Chapter',null)).toBeNull();expect(defaultCreationParent(p,'Chapter',scene)).toBeNull();
  const next=createTreeNode(p,'Chapter','Root chapter',null,randomUUID());expect(next.manifest.nodes.at(-1)?.parent).toBeNull();expect(defaultCreationParent(p,'Chapter',part)).toBe(part);
});
it('reveals ancestors without changing existing identities, prose, metadata or ordering',()=>{
  const {p,folder,chapter}=fixture();p.author.metadata[chapter]={summary:'Retained',status:'',inspectorNote:'',tags:['tag']};
  const before=structuredClone(p),next=createTreeNode(p,'Chapter','Nested',folder,randomUUID());
  expect(p).toEqual(before);expect(next.manifest.nodes.slice(0,-1)).toEqual(p.manifest.nodes);expect(next.author).toEqual(p.author);
  for(const [id,doc] of Object.entries(p.documents))expect(next.documents[id]).toEqual(doc);
  expect(next.manifest.settings.workspace.collapsed).toEqual([chapter]);
});
it('rejects missing, trashed, invalid and duplicate destinations/identities without mutating source',()=>{
  const {p,part,folder,chapter,scene}=fixture();const before=structuredClone(p);
  for(const parent of [randomUUID(),scene,chapter])expect(()=>createTreeNode(p,'Chapter','Bad',parent,randomUUID())).toThrow('destination');
  expect(()=>createTreeNode(p,'Chapter','Bad',folder,chapter)).toThrow('identity');expect(p).toEqual(before);
  p.manifest.nodes.find(n=>n.id===part)!.trashed=true;expect(creationDestinations(p,'Chapter')).toEqual([]);
  expect(()=>createTreeNode(p,'Chapter','Bad',folder,randomUUID())).toThrow('destination');
  p.author.scenes='off';expect(()=>createTreeNode(p,'Scene','Hidden',null,randomUUID())).toThrow('Enable Scenes');
});
it('saves and reopens newly nested and root nodes using canonical storage',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'pagehearth-parent-create-')),store=new Store(root);let reopened:Store|undefined;
  try{
    await store.create('Parent creation');const original=structuredClone(store.project),part=randomUUID(),chapter=randomUUID(),folder=randomUUID(),scene=randomUUID(),rootId=randomUUID();
    let p=createTreeNode(store.project,'Part','Part',null,part);p=createTreeNode(p,'Chapter','Nested chapter',part,chapter);p=createTreeNode(p,'Folder','Folder',part,folder);p.author.scenes='available';p=createTreeNode(p,'Scene','Scene',chapter,scene);p=createTreeNode(p,'Chapter','Root',null,rootId);
    await store.commit(p);await store.release();reopened=new Store(root);await reopened.open();
    expect(reopened.project.manifest.nodes).toEqual(p.manifest.nodes);expect(reopened.project.documents).toEqual(p.documents);expect(reopened.project.documents[original.manifest.nodes[0].id]).toEqual(original.documents[original.manifest.nodes[0].id]);
  }finally{await reopened?.release();await store.release();await rm(root,{recursive:true,force:true});}
});
