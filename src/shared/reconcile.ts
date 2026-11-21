import {commentBody} from './comments.js';
import {blankMetadata, validate, type Project} from './model.js';

const missing=Symbol('missing');
type Value=unknown|typeof missing;
const equal=(left:Value,right:Value)=>left===missing||right===missing?left===right:JSON.stringify(left)===JSON.stringify(right);
const object=(value:Value):value is Record<string,unknown>=>value!==missing&&value!==null&&typeof value==='object'&&!Array.isArray(value);
const clone=<T>(value:T):T=>value===missing?value:structuredClone(value);

function mergeValue(base:Value,local:Value,canonical:Value,path:string,conflicts:string[]):Value{
  if(equal(local,base))return clone(canonical);
  if(equal(canonical,base)||equal(local,canonical))return clone(local);
  if(/^author\.comments\.byId\.[^.]+\.anchor$/.test(path)){conflicts.push(path);return clone(canonical);}
  if((base===missing||object(base))&&object(local)&&object(canonical)){
    const baseObject=base===missing?{}:base;
    const result:Record<string,unknown>={};
    for(const key of new Set([...Object.keys(baseObject),...Object.keys(local),...Object.keys(canonical)])){
      const value=mergeValue(Object.hasOwn(baseObject,key)?baseObject[key]:missing,Object.hasOwn(local,key)?local[key]:missing,Object.hasOwn(canonical,key)?canonical[key]:missing,path?`${path}.${key}`:key,conflicts);
      if(value!==missing)result[key]=value;
    }
    return result;
  }
  conflicts.push(path||'project');
  return clone(canonical);
}

export type ReconcileResult={project?:Project;conflicts:string[]};

/**
 * Conservatively combines edits made from the same acknowledged Project.
 * Arrays and scalar values are atomic: concurrent changes to either are a
 * conflict, never an implicit last-write-wins choice.
 */
export function reconcileProject(base:Project,local:Project,canonical:Project):ReconcileResult{
  if(base.manifest.id!==local.manifest.id||base.manifest.id!==canonical.manifest.id)return {conflicts:['manifest.id']};
  // Metadata is sparse on disk, but a missing entry has defined empty values in
  // the Author model. Materialize that semantic base before comparing two
  // renderers that independently created the same object's metadata record.
  const normalized=[base,local,canonical].map(project=>structuredClone(project));
  const metadataIds=new Set([...Object.keys(local.author.metadata),...Object.keys(canonical.author.metadata)]);
  for(const project of normalized)for(const id of metadataIds)project.author.metadata[id]??=blankMetadata();
  const conflicts:string[]=[];
  const project=mergeValue(normalized[0],normalized[1],normalized[2],'',conflicts) as Project;
  if(conflicts.length)return {conflicts:[...new Set(conflicts)]};
  validate(project);
  for(const c of Object.values(project.author.comments?.byId||{}))if(c.anchor.status==='attached'&&project.author.comments!.documentBases[c.anchor.documentId]!==commentBody(project.documents[c.anchor.documentId]))conflicts.push('author.comments.documentBases.'+c.anchor.documentId);
  return conflicts.length?{conflicts:[...new Set(conflicts)]}:{project,conflicts:[]};
}
