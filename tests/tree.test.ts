import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {changeTree,TreeMoveRejected} from '../src/shared/tree';
import {blank, defaultAuthor, type Project} from '../src/shared/model';
function fixture(){const a=randomUUID(),b=randomUUID(),c=randomUUID(),d=randomUUID();const p:Project={manifest:{version:1,id:randomUUID(),title:'Tree',revision:0,settings:{editor:{},publication:{},workspace:{}},nodes:[{id:a,parent:null,title:'A',kind:'Chapter'},{id:b,parent:a,title:'Child',kind:'Scene'},{id:c,parent:null,title:'C',kind:'Chapter'},{id:d,parent:null,title:'D',kind:'Chapter'}]},documents:Object.fromEntries([a,b,c,d].map(id=>[id,{...blank(),content:[{type:'paragraph',content:[{type:'text',text:'Prose '+id}]}]}])),author:defaultAuthor(),recovery:[]};return {p,a,b,c,d};}
it('rename touches only title, leaving IDs, prose, order and unknown metadata intact',()=>{const {p,a}=fixture();const next=changeTree(p,{kind:'rename',id:a,title:'New name'});expect(next.documents).toEqual(p.documents);expect(next.manifest.nodes.map(n=>n.id)).toEqual(p.manifest.nodes.map(n=>n.id));expect(p.manifest.nodes[0].title).toBe('A');});
it('multi-move preserves a subtree, stable IDs and prose and rejects cycles',()=>{const {p,a,b,c,d}=fixture();const next=changeTree(p,{kind:'move',ids:[a,c],target:d,placement:'after'});expect(next.manifest.nodes.map(n=>n.id)).toEqual([d,a,b,c]);expect(next.manifest.nodes.find(n=>n.id===b)?.parent).toBe(a);expect(next.documents).toEqual(p.documents);expect(()=>changeTree(p,{kind:'move',ids:[a],target:b,placement:'inside'})).toThrow('descendants');});
it('Trash and restore keep original hierarchy, document order and content',()=>{const {p,a,b}=fixture();const trashed=changeTree(p,{kind:'trash',ids:[a]});expect(trashed.manifest.nodes.filter(n=>n.trashed).map(n=>n.id)).toEqual([a,b]);expect(trashed.documents).toEqual(p.documents);const restored=changeTree(trashed,{kind:'restore',ids:[a]});expect(restored).toEqual(p);});
it('permanent delete requires Trash and refuses references including unknown manifest metadata',()=>{const {p,a,c}=fixture();expect(()=>changeTree(p,{kind:'delete',ids:[a]})).toThrow('Trash');let next=changeTree(p,{kind:'trash',ids:[a]});(next.manifest as any).metadata={links:[a]};expect(()=>changeTree(next,{kind:'delete',ids:[a]})).toThrow('references');delete (next.manifest as any).metadata;next.documents[c].content!.push({type:'paragraph',content:[{type:'text',text:a}]});expect(()=>changeTree(next,{kind:'delete',ids:[a]})).toThrow('references');});
it('returning each node kind onto itself before/after is an identity-preserving no-op',()=>{
  for(const kind of ['Part','Folder','Chapter','Scene'] as const){const {p,a}=fixture();p.manifest.nodes[0].kind=kind;
    for(const placement of ['before','after'] as const)expect(changeTree(p,{kind:'move',ids:[a],target:a,placement})).toBe(p);
  }
});
it('unchanged adjacent sibling slots and existing first-child nesting are no-ops',()=>{
  const {p,a,b,c,d}=fixture();
  expect(changeTree(p,{kind:'move',ids:[a],target:c,placement:'before'})).toBe(p);
  expect(changeTree(p,{kind:'move',ids:[c],target:a,placement:'after'})).toBe(p);
  expect(changeTree(p,{kind:'move',ids:[b],target:a,placement:'inside'})).toBe(p);
  // Canonical arrays can interleave descendants; compare sibling order, not raw array layout.
  p.manifest.nodes=[p.manifest.nodes[0],p.manifest.nodes[2],p.manifest.nodes[1],p.manifest.nodes[3]];
  expect(changeTree(p,{kind:'move',ids:[c],target:d,placement:'before'})).toBe(p);
});
it('group returns are no-ops and self/descendant nesting is rejected without partial mutation',()=>{
  const {p,a,b,c,d}=fixture(),before=structuredClone(p);
  expect(changeTree(p,{kind:'move',ids:[a,c],target:c,placement:'after'})).toBe(p);
  expect(changeTree(p,{kind:'move',ids:[a,c],target:d,placement:'before'})).toBe(p);
  for(const target of [a,b])expect(()=>changeTree(p,{kind:'move',ids:[a,c],target,placement:'inside'})).toThrow(TreeMoveRejected);
  for(const placement of ['before','after'] as const)expect(()=>changeTree(p,{kind:'move',ids:[a,b],target:b,placement})).toThrow(TreeMoveRejected);
  expect(()=>changeTree(p,{kind:'move',ids:[a],target:randomUUID(),placement:'after'})).toThrow(TreeMoveRejected);
  expect(p).toEqual(before);
  const valid=changeTree(p,{kind:'move',ids:[a,c],target:d,placement:'inside'});
  expect(valid.manifest.nodes.find(n=>n.id===a)?.parent).toBe(d);expect(valid.manifest.nodes.find(n=>n.id===c)?.parent).toBe(d);expect(valid.manifest.nodes.find(n=>n.id===b)?.parent).toBe(a);expect(valid.documents).toEqual(p.documents);
});
