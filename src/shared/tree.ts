import {invalidateComments} from './comments.js';
import { validate, type Project, type TreeNode } from './model.js';
import { ensureAuthor } from './author.js';
export function branch(nodes:TreeNode[],ids:string[]){
  const selected=new Set(ids);let changed=true;
  while(changed){changed=false;for(const n of nodes)if(n.parent && selected.has(n.parent) && !selected.has(n.id)){selected.add(n.id);changed=true;}}
  return selected;
}
export type TreeAction={kind:'rename';id:string;title:string}|{kind:'trash'|'restore'|'delete';ids:string[]}|{kind:'move';ids:string[];target:string;placement:'before'|'after'|'inside'}|{kind:'relocate';ids:string[];parent:string|null}|{kind:'order';snapshot:TreeOrderSnapshot};
export type TreeOrderSnapshot={id:string;parent:string|null}[];
export class TreeMoveRejected extends Error {}
function sameStructure(a:TreeNode[],b:TreeNode[]){
  if(a.length!==b.length)return false;
  const parents=new Set(a.map(n=>n.parent));
  return a.every(n=>b.some(other=>other.id===n.id&&other.parent===n.parent))&&[...parents].every(parent=>
    a.filter(n=>n.parent===parent).map(n=>n.id).join(',')===b.filter(n=>n.parent===parent).map(n=>n.id).join(','));
}
export function treeOrderSnapshot(project:Project):TreeOrderSnapshot{return project.manifest.nodes.map(({id,parent})=>({id,parent}));}
export function restoreTreeOrder(source:Project,snapshot:TreeOrderSnapshot):Project{
  const p=ensureAuthor(structuredClone(source)),current=new Set(p.manifest.nodes.map(n=>n.id));
  if(snapshot.length!==current.size || new Set(snapshot.map(n=>n.id)).size!==snapshot.length || snapshot.some(n=>!current.has(n.id)))throw Error('The manuscript changed since this reorder; its previous order cannot be restored safely.');
  const byId=new Map(p.manifest.nodes.map(n=>[n.id,n]));p.manifest.nodes=snapshot.map(entry=>({...byId.get(entry.id)!,parent:entry.parent}));validate(p);return p;
}
export function changeTree(source:Project,action:TreeAction):Project{
  if(action.kind==='relocate'&&action.parent!==null)return changeTree(source,{kind:'move',ids:action.ids,target:action.parent,placement:'inside'});
  if(action.kind==='order')return restoreTreeOrder(source,action.snapshot);
  const p=ensureAuthor(structuredClone(source));const nodes=p.manifest.nodes;
  if(action.kind==='rename'){
    const node=nodes.find(n=>n.id===action.id);if(!node || !action.title.trim())throw Error('Enter a document title.');node.title=action.title.trim();
  }else{
    if(!action.ids.length || action.ids.some(id=>!nodes.some(n=>n.id===id)))throw action.kind==='move'||action.kind==='relocate'?new TreeMoveRejected('Select existing documents.'):Error('Select existing documents.');
    const selected=branch(nodes,action.ids);
    if(action.kind==='relocate'){
      const moving=nodes.filter(n=>selected.has(n.id));
      if(moving.some(n=>n.trashed))throw new TreeMoveRejected('Restore trashed documents before moving.');
      // Move to root appends the selected roots, preserving their relative order and subtrees.
      for(const n of moving)if(!n.parent||!selected.has(n.parent))n.parent=null;
      p.manifest.nodes=[...nodes.filter(n=>!selected.has(n.id)),...moving];
      if(sameStructure(source.manifest.nodes,p.manifest.nodes))return source;
    }else if(action.kind==='move'){
      const target=nodes.find(n=>n.id===action.target);if(!target || target.trashed)throw new TreeMoveRejected('Choose an existing document outside Trash.');
      const moving=nodes.filter(n=>selected.has(n.id));if(moving.some(n=>n.trashed))throw new TreeMoveRejected('Restore trashed documents before moving.');
      // Dropping back on a selected root is cancellation, not a new insertion.
      // Inside/self and all descendant destinations still fail closed.
      const roots=moving.filter(n=>!n.parent||!selected.has(n.parent));
      if(selected.has(target.id)){
        if(action.placement!=='inside'&&roots.some(n=>n.id===target.id))return source;
        throw new TreeMoveRejected('Cannot move into the selection or its descendants.');
      }
      for(const n of moving)if(!n.parent || !selected.has(n.parent))n.parent=action.placement==='inside'?target.id:target.parent;
      const remaining=nodes.filter(n=>!selected.has(n.id));let index=remaining.findIndex(n=>n.id===target.id);
      if(action.placement==='after') {const descendants=branch(remaining,[target.id]);while(index+1<remaining.length && descendants.has(remaining[index+1].id))index++;index++;}
      else if(action.placement==='inside')index++;
      remaining.splice(index,0,...moving);p.manifest.nodes=remaining;
      if(sameStructure(source.manifest.nodes,remaining))return source;
    }else if(action.kind==='trash'){for(const n of nodes)if(selected.has(n.id))n.trashed=true;}
    else if(action.kind==='restore'){
      for(const id of [...selected]){let node=nodes.find(n=>n.id===id);while(node){selected.add(node.id);node=nodes.find(n=>n.id===node!.parent);}}
      for(const n of nodes)if(selected.has(n.id))delete n.trashed;
    }else{
      if(nodes.some(n=>selected.has(n.id) && !n.trashed))throw Error('Move documents to Trash before permanent deletion.');
      const remaining=nodes.filter(n=>!selected.has(n.id));const remainingDocs=Object.fromEntries(Object.entries(p.documents).filter(([id])=>!selected.has(id)));
      // References are not rewritten or silently broken; retain the target in Trash.
      const {workspace,...settings}=p.manifest.settings;
      const {comments,...referenceAuthor}=p.author;
      const referenceData=JSON.stringify({...p,author:referenceAuthor,manifest:{...p.manifest,nodes:remaining,settings},documents:remainingDocs,recovery:[]});
      if([...selected].some(id=>referenceData.includes(id)))throw Error('Other content references this selection. Keep it in Trash or remove those references before permanent deletion.');
      p.manifest.nodes=remaining;p.documents=remainingDocs;
      for(const id of selected)p.author.comments=invalidateComments(p.author.comments,id,undefined,'document-missing');
      const positions=p.manifest.settings.workspace.positions as Record<string,unknown>|undefined;
      if(positions)for(const id of selected)delete positions[id];
    }
  }
  if(action.kind==='move'||action.kind==='relocate'){
    const reveal=new Set<string>();
    for(const id of action.ids){let parent=p.manifest.nodes.find(n=>n.id===id)?.parent;while(parent&&!reveal.has(parent)){reveal.add(parent);parent=p.manifest.nodes.find(n=>n.id===parent)?.parent;}}
    const workspace=p.manifest.settings.workspace;
    if(Array.isArray(workspace.collapsed))workspace.collapsed=workspace.collapsed.filter(id=>!reveal.has(String(id)));
  }
  validate(p);return p;
}
