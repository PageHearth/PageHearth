import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {blank,defaultAuthor,type Project,type TreeNode} from '../src/shared/model';
import {changeTree,TreeMoveRejected} from '../src/shared/tree';
import {moveDestinations,treeDropPlacement} from '../src/shared/treeMoving';
function fixture(){
  const ids=Array.from({length:5},()=>randomUUID()),[part,chapter,scene,folder,other]=ids;
  const nodes:TreeNode[]=[{id:part,parent:null,kind:'Part',title:'Part'},{id:chapter,parent:part,kind:'Chapter',title:'Chapter'},{id:scene,parent:chapter,kind:'Scene',title:'Scene'},{id:folder,parent:null,kind:'Folder',title:'Folder'},{id:other,parent:null,kind:'Chapter',title:'Other'}];
  const p:Project={manifest:{version:1,id:randomUUID(),title:'Moves',revision:0,nodes,settings:{editor:{},publication:{},workspace:{collapsed:[folder]}}},author:{...defaultAuthor(),scenes:'available'},documents:Object.fromEntries(ids.map(id=>[id,blank()])),recovery:[]};return {p,part,chapter,scene,folder,other};
}
it('uses center half for Part/Folder nesting, edges for ordering, and retains Shift',()=>{
  for(const kind of ['Part','Folder'] as const){expect(treeDropPlacement(kind,.5,false)).toBe('inside');expect(treeDropPlacement(kind,.1,false)).toBe('before');expect(treeDropPlacement(kind,.9,false)).toBe('after');expect(treeDropPlacement(kind,.5,false,true)).toBe('after');}
  for(const kind of ['Chapter','Scene'] as const){expect(treeDropPlacement(kind,.4,false)).toBe('before');expect(treeDropPlacement(kind,.6,false)).toBe('after');expect(treeDropPlacement(kind,.1,true)).toBe('inside');}
});
it('lists valid generic parents but excludes entire selected branches and Trash',()=>{
  const {p,part,folder,other}=fixture();expect(moveDestinations(p,[part]).map(n=>n.id)).toEqual([folder,other]);
  p.manifest.nodes.find(n=>n.id===folder)!.trashed=true;expect(moveDestinations(p,[part]).map(n=>n.id)).toEqual([other]);expect(moveDestinations(p,[part,other])).toEqual([]);
});
it('moves overlapping group roots atomically with complete subtrees, reveals parents, and preserves data',()=>{
  const {p,part,chapter,scene,folder,other}=fixture(),before=structuredClone(p);
  const next=changeTree(p,{kind:'relocate',ids:[part,chapter,other],parent:folder});
  expect(next.manifest.nodes.find(n=>n.id===part)?.parent).toBe(folder);expect(next.manifest.nodes.find(n=>n.id===chapter)?.parent).toBe(part);expect(next.manifest.nodes.find(n=>n.id===scene)?.parent).toBe(chapter);expect(next.manifest.nodes.find(n=>n.id===other)?.parent).toBe(folder);
  expect(next.documents).toEqual(p.documents);expect(next.author).toEqual(p.author);expect(p).toEqual(before);expect(next.manifest.settings.workspace.collapsed).toEqual([]);
});
it('root destination appends selected roots in canonical order without flattening descendants',()=>{
  const {p,chapter,scene,folder}=fixture();const next=changeTree(p,{kind:'relocate',ids:[folder,chapter],parent:null});
  expect(next.manifest.nodes.slice(-3).map(n=>n.id)).toEqual([chapter,scene,folder]);expect(next.manifest.nodes.find(n=>n.id===scene)?.parent).toBe(chapter);
  expect(changeTree(next,{kind:'relocate',ids:[chapter,folder],parent:null})).toBe(next);
});
it('invalid grouped destinations cannot mutate original or leave partial reparenting',()=>{
  const {p,part,chapter,scene,folder}=fixture(),before=structuredClone(p);
  for(const parent of [part,chapter,scene,randomUUID()])expect(()=>changeTree(p,{kind:'relocate',ids:[part,folder],parent})).toThrow(TreeMoveRejected);
  expect(()=>changeTree(p,{kind:'relocate',ids:[randomUUID()],parent:null})).toThrow(TreeMoveRejected);expect(p).toEqual(before);
  p.manifest.nodes.find(n=>n.id===folder)!.trashed=true;expect(()=>changeTree(p,{kind:'relocate',ids:[folder],parent:null})).toThrow(TreeMoveRejected);
});
