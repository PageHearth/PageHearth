import {blank, validate, type Project, type TreeNode} from './model.js';

// Creation affordances only. Existing projects and move operations retain their
// general hierarchy model, including structures created by older versions.
export function creationDestinations(project:Project,kind:TreeNode['kind']):TreeNode[]{
  return project.manifest.nodes.filter(node=>{
    let cursor:TreeNode|undefined=node;
    const seen=new Set<string>();
    while(cursor){
      if(cursor.trashed||seen.has(cursor.id))return false;
      seen.add(cursor.id);cursor=project.manifest.nodes.find(n=>n.id===cursor!.parent);
    }
    return node.kind==='Folder'||(kind==='Scene'?node.kind==='Chapter':node.kind==='Part');
  });
}
export function defaultCreationParent(project:Project,kind:TreeNode['kind'],active:string|null):string|null{
  const allowed=creationDestinations(project,kind),node=project.manifest.nodes.find(n=>n.id===active);
  if(allowed.some(n=>n.id===active))return active;
  if(kind==='Scene'&&node?.kind==='Scene'&&allowed.some(n=>n.id===node.parent))return node.parent;
  return null;
}
export function creationPath(project:Project,id:string):string{
  const parts:string[]=[],seen=new Set<string>();let node=project.manifest.nodes.find(n=>n.id===id);
  while(node&&!seen.has(node.id)){seen.add(node.id);parts.unshift(`${node.title} (${node.kind})`);node=project.manifest.nodes.find(n=>n.id===node!.parent);}
  return parts.join(' / ');
}
export function createTreeNode(source:Project,kind:TreeNode['kind'],title:string,parent:string|null,id:string):Project{
  if(kind==='Scene'&&source.author.scenes!=='available')throw Error('Enable Scenes before adding a Scene.');
  if(parent!==null&&!creationDestinations(source,kind).some(n=>n.id===parent))throw Error('The creation destination is no longer available. Choose another destination.');
  if(source.manifest.nodes.some(n=>n.id===id)||Object.hasOwn(source.documents,id))throw Error('Document identity already exists.');
  const p=structuredClone(source);
  p.manifest.nodes.push({id,parent,title:title.trim()||`New ${kind}`,kind});p.documents[id]=blank();
  const ancestors=new Set<string>();let ancestor=parent;
  while(ancestor){ancestors.add(ancestor);ancestor=p.manifest.nodes.find(n=>n.id===ancestor)?.parent??null;}
  const workspace=p.manifest.settings.workspace;
  if(Array.isArray(workspace.collapsed))workspace.collapsed=workspace.collapsed.filter(key=>!ancestors.has(String(key)));
  validate(p);return p;
}
