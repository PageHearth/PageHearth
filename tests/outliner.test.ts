import {describe,expect,it} from 'vitest';
import {blank,defaultAuthor,type Project} from '../src/shared/model';
import {metadata,outlineDepth,parseTags,sortOutline,updateMetadata,visibleStructure,type OutlineSort,type OutlineSortDirection} from '../src/shared/author';
import {changeTree,restoreTreeOrder,treeOrderSnapshot} from '../src/shared/tree';
import {OutlinerStructureHistory} from '../src/renderer/outlinerHistory';
import {moveVisibleColumn,normalizeColumnOrder,visibleColumnOrder} from '../src/renderer/workspaces';

const ID={a:'00000000-0000-4000-8000-00000000000a',b:'00000000-0000-4000-8000-00000000000b',a1:'00000000-0000-4000-8000-0000000000a1',a2:'00000000-0000-4000-8000-0000000000a2',a3:'00000000-0000-4000-8000-0000000000a3',b1:'00000000-0000-4000-8000-0000000000b1',b2:'00000000-0000-4000-8000-0000000000b2'};
function fixture():Project{
  const ids=ID;
  // Children are intentionally interleaved. Parent identity, rather than adjacency,
  // must establish the hierarchy in every Outliner view.
  const nodes=[
    {id:ids.a,parent:null,title:'Z Chapter',kind:'Chapter' as const},
    {id:ids.b,parent:null,title:'A Chapter',kind:'Chapter' as const},
    {id:ids.b1,parent:ids.b,title:'B One',kind:'Scene' as const},
    {id:ids.a1,parent:ids.a,title:'A One',kind:'Scene' as const},
    {id:ids.b2,parent:ids.b,title:'B Two',kind:'Scene' as const},
    {id:ids.a2,parent:ids.a,title:'A Two',kind:'Scene' as const},
    {id:ids.a3,parent:ids.a,title:'A Three',kind:'Scene' as const},
  ];
  return {manifest:{version:1,id:'00000000-0000-4000-8000-000000000001',title:'Outliner',revision:0,nodes,settings:{editor:{},publication:{},workspace:{}}},documents:Object.fromEntries(nodes.map(n=>[n.id,blank()])),author:defaultAuthor(),recovery:[]};
}

const ids=(project:Project,order:OutlineSort='manuscript',direction:OutlineSortDirection='asc')=>sortOutline(visibleStructure(project),order,project,direction).map(n=>n.id);

describe('Outliner canonical hierarchy projection and movement',()=>{
  it('projects interleaved canonical nodes by exact parent identity and sibling manuscript order',()=>{
    const p=fixture();
    expect(ids(p)).toEqual([ID.a,ID.a1,ID.a2,ID.a3,ID.b,ID.b1,ID.b2]);
    expect(p.manifest.nodes.find(n=>n.id===ID.b1)?.parent).toBe(ID.b);
    expect(outlineDepth(p.manifest.nodes,ID.b1)).toBe(1);
  });

  it('analytical sorting, Quick Find-style filtering, and metadata filtering never reparent scenes',()=>{
    let p=fixture();p=updateMetadata(p,ID.a2,{status:'Needs Revision',summary:'silver clue',tags:['mystery']});
    for(const order of ['title','status'] as const){
      const projection=sortOutline(visibleStructure(p),order,p);
      expect(projection.find(n=>n.id===ID.a2)?.parent).toBe(ID.a);
      expect(projection.find(n=>n.id===ID.b1)?.parent).toBe(ID.b);
    }
    const query=sortOutline(visibleStructure(p),'manuscript',p).filter(n=>n.title.includes('Two')||metadata(p,n.id).summary.includes('silver'));
    expect(query.map(n=>[n.id,n.parent])).toEqual([[ID.a2,ID.a],[ID.b2,ID.b]]);
  });

  it('sorts Summary and Status in both directions and Words numerically without changing canonical structure',()=>{
    let p=fixture();p=updateMetadata(p,ID.a,{summary:'Zulu',status:'Draft'});p=updateMetadata(p,ID.b,{summary:'Alpha',status:'Ready'});
    p.documents[ID.a]={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'two words'}]}]};
    p.documents[ID.b]={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'one two three four five six seven eight nine ten'}]}]};
    const before=structuredClone(p.manifest.nodes);
    expect(ids(p,'summary','asc')).toEqual([ID.b,ID.b1,ID.b2,ID.a,ID.a1,ID.a2,ID.a3]);
    expect(ids(p,'summary','desc')).toEqual([ID.a,ID.a1,ID.a2,ID.a3,ID.b,ID.b1,ID.b2]);
    expect(ids(p,'status','asc')).toEqual([ID.a,ID.a1,ID.a2,ID.a3,ID.b,ID.b1,ID.b2]);
    expect(ids(p,'status','desc')).toEqual([ID.b,ID.b1,ID.b2,ID.a,ID.a1,ID.a2,ID.a3]);
    expect(ids(p,'words','asc')).toEqual([ID.a,ID.a1,ID.a2,ID.a3,ID.b,ID.b1,ID.b2]);
    expect(ids(p,'words','desc')).toEqual([ID.b,ID.b1,ID.b2,ID.a,ID.a1,ID.a2,ID.a3]);
    expect(ids(p,'manuscript','desc')).toEqual([ID.a,ID.a1,ID.a2,ID.a3,ID.b,ID.b1,ID.b2]);
    expect(p.manifest.nodes).toEqual(before);
  });

  it('parses comma-delimited tags while preserving spaces and ordinary punctuation',()=>{
    expect(parseTags(' slow burn, found family, act 2, POV:Mina, clue #3, !@#$%^&*, , ')).toEqual(['slow burn','found family','act 2','POV:Mina','clue #3','!@#$%^&*']);
    const p=updateMetadata(fixture(),ID.a,{tags:parseTags('slow burn, clue #3')});
    expect(metadata(p,ID.a).tags).toEqual(['slow burn','clue #3']);
  });

  it('remembers deterministic column positions while columns are hidden and shown again',()=>{
    const defaults=['summary','status','words','tags','inspectorNote','custom-a'];
    let order=normalizeColumnOrder(defaults,['status','custom-a','summary']);
    expect(order).toEqual(['status','custom-a','summary','words','tags','inspectorNote']);
    expect(visibleColumnOrder(defaults,order,['summary','status','words'])).toEqual(['status','summary','words']);
    order=moveVisibleColumn(order,visibleColumnOrder(defaults,order,['summary','status','words']),'summary',-1);
    expect(visibleColumnOrder(defaults,order,['summary','status','words'])).toEqual(['summary','status','words']);
    expect(visibleColumnOrder(defaults,order,['summary','status','words','custom-a'])).toEqual(['summary','custom-a','status','words']);
  });

  it('Scenes Off hides dormant scenes without changing their parents, order, prose, or IDs',()=>{
    const p=fixture(),nested='00000000-0000-4000-8000-0000000000f1';p.manifest.nodes.push({id:nested,parent:ID.a1,title:'Nested under hidden Scene',kind:'Folder'});p.documents[nested]=blank();const before=structuredClone(p.manifest.nodes),documents=p.documents;p.author.scenes='off';
    expect(ids(p)).toEqual([ID.a,ID.b]);
    expect(p.manifest.nodes).toEqual(before);expect(p.documents).toBe(documents);
    p.author.scenes='available';expect(ids(p)).toEqual([ID.a,ID.a1,nested,ID.a2,ID.a3,ID.b,ID.b1,ID.b2]);
  });

  it('moves first and middle scenes into the final sibling slot without changing identity or content',()=>{
    const original=fixture();original.documents[ID.a1]={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Attached prose'}]}]};original.author.metadata[ID.a1]={summary:'Attached summary',status:'Draft',inspectorNote:'Keep note',tags:['continuity']};
    const first=changeTree(original,{kind:'move',ids:[ID.a1],target:ID.a3,placement:'after'});
    expect(ids(first).slice(1,4)).toEqual([ID.a2,ID.a3,ID.a1]);
    expect(first.documents[ID.a1]).toEqual(original.documents[ID.a1]);expect(first.author.metadata[ID.a1]).toEqual(original.author.metadata[ID.a1]);
    const middle=changeTree(original,{kind:'move',ids:[ID.a2],target:ID.a3,placement:'after'});
    expect(ids(middle).slice(1,4)).toEqual([ID.a1,ID.a3,ID.a2]);
  });

  it('reparents an actual scene and reorders a chapter subtree through the canonical tree service',()=>{
    let p=fixture();p=changeTree(p,{kind:'move',ids:[ID.a2],target:ID.b,placement:'inside'});
    expect(p.manifest.nodes.find(n=>n.id===ID.a2)?.parent).toBe(ID.b);
    expect(ids(p)).toEqual([ID.a,ID.a1,ID.a3,ID.b,ID.a2,ID.b1,ID.b2]);
    p=changeTree(p,{kind:'move',ids:[ID.b],target:ID.a,placement:'before'});
    expect(ids(p).slice(0,4)).toEqual([ID.b,ID.a2,ID.b1,ID.b2]);
  });

  it('rejects circular drops and restores the exact original hierarchy in one undo',()=>{
    const p=fixture(),snapshot=treeOrderSnapshot(p);
    expect(()=>changeTree(p,{kind:'move',ids:[ID.a],target:ID.a1,placement:'inside'})).toThrow('descendants');
    const moved=changeTree(p,{kind:'move',ids:[ID.a1],target:ID.a3,placement:'after'}),undone=restoreTreeOrder(moved,snapshot);
    expect(undone.manifest.nodes.map(n=>({id:n.id,parent:n.parent}))).toEqual(snapshot);
    expect(ids(undone)).toEqual(ids(p));
  });

  it('keeps bounded Outliner-only Undo/Redo over the canonical structure',()=>{
    const p=fixture(),before=treeOrderSnapshot(p),moved=changeTree(p,{kind:'move',ids:[ID.a1],target:ID.a3,placement:'after'}),after=treeOrderSnapshot(moved),history=new OutlinerStructureHistory(before,2);
    history.record(before,after);history.observe(after);expect(history.sizes).toEqual({undo:1,redo:0});
    const undo=history.undo(after)!;expect(undo).toEqual(before);history.observe(undo);expect(history.sizes).toEqual({undo:0,redo:1});
    const redo=history.redo(undo)!;expect(redo).toEqual(after);history.observe(redo);expect(history.sizes).toEqual({undo:1,redo:0});
    let current=moved;for(const target of [ID.a2,ID.a3,ID.a2]){const previous=treeOrderSnapshot(current);current=changeTree(current,{kind:'move',ids:[ID.a1],target,placement:'after'});history.record(previous,treeOrderSnapshot(current));history.observe(treeOrderSnapshot(current));}
    expect(history.sizes.undo).toBe(2);
  });

  it('invalidates Outliner history instead of replaying over an external structural change',()=>{
    const p=fixture(),before=treeOrderSnapshot(p),moved=changeTree(p,{kind:'move',ids:[ID.a1],target:ID.a3,placement:'after'}),after=treeOrderSnapshot(moved),history=new OutlinerStructureHistory(before);
    history.record(before,after);history.observe(after);
    const external=changeTree(moved,{kind:'move',ids:[ID.b],target:ID.a,placement:'before'}),externalOrder=treeOrderSnapshot(external);
    expect(history.observe(externalOrder)).toBe(true);expect(history.sizes).toEqual({undo:0,redo:0});expect(history.undo(externalOrder)).toBeNull();
    expect(treeOrderSnapshot(external)).toEqual(externalOrder);
  });
});
