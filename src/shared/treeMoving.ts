import type {Project,TreeNode} from './model.js';
import {branch,changeTree,TreeMoveRejected} from './tree.js';

/** Edge quarters reorder; middle half of organizational containers nests. */
export function treeDropPlacement(kind:TreeNode['kind'],fraction:number,shift:boolean,returningToRoot=false):'before'|'after'|'inside'{
  if(shift)return 'inside';
  if(!returningToRoot&&(kind==='Part'||kind==='Folder')&&fraction>=.25&&fraction<=.75)return 'inside';
  return fraction<.5?'before':'after';
}
export function moveDestinations(project:Project,ids:string[]):TreeNode[]{
  const moved=branch(project.manifest.nodes,ids);
  // Preserve the existing generic hierarchy rules: any active node outside the
  // moving subtree may be a parent. This includes legacy Chapter/Scene containers.
  return project.manifest.nodes.filter(node=>{
    if(node.trashed||moved.has(node.id))return false;
    let parent=node.parent;const seen=new Set<string>();
    while(parent){if(seen.has(parent))return false;seen.add(parent);const ancestor=project.manifest.nodes.find(n=>n.id===parent);if(!ancestor||ancestor.trashed)return false;parent=ancestor.parent;}
    try{changeTree(project,{kind:'relocate',ids,parent:node.id});return true;}catch(e){if(e instanceof TreeMoveRejected)return false;throw e;}
  });
}
