import type {Doc,Project} from './model.js';
export type ReferenceRange={occurrenceId:string;targetId:string;from:number;to:number;visibleText:string};
const uuid=(x:unknown):x is string=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x);
/** Canonical JSON positions use ProseMirror geometry, including block boundaries. */
const cache=new WeakMap<Doc,ReferenceRange[]>();
export function referenceRanges(body:Doc):ReferenceRange[]{
 const cached=cache.get(body);if(cached)return cached;
 const found=new Map<string,ReferenceRange>();
 const walk=(node:Doc,pos:number,root=false):number=>{
  const marks=node.marks?.filter(m=>m.type==='entityReference')||[];
  if(marks.length){const a=marks[0].attrs;if(marks.length!==1||node.type!=='text'||!node.text||!uuid(a?.occurrenceId)||!uuid(a?.targetId))throw Error('Malformed explicit reference. No text was changed.');
   const old=found.get(a.occurrenceId);if(old&&(old.to!==pos||old.targetId!==a.targetId))throw Error('Disjoint or conflicting explicit reference. No text was changed.');
   found.set(a.occurrenceId,{occurrenceId:a.occurrenceId,targetId:a.targetId,from:old?.from??pos,to:pos+node.text.length,visibleText:(old?.visibleText||'')+node.text});
  }
  if(node.type==='text')return node.text?.length||0;
  if(!node.content?.length)return root?0:['paragraph','heading','blockquote','listItem','codeBlock','manuscriptSegment'].includes(node.type)?2:1;
  let offset=root?0:1;for(const child of node.content)offset+=walk(child,pos+offset);return offset+(root?0:1);
 };
 walk(body,0,true);const result=[...found.values()];cache.set(body,result);return result;
}
export function projectReferenceRanges(project:Pick<Project,'documents'>){
 const found=new Map<string,ReferenceRange&{documentId:string}>();
 for(const [documentId,body] of Object.entries(project.documents))for(const range of referenceRanges(body)){
  if(found.has(range.occurrenceId))throw Error('Duplicate explicit reference occurrence across manuscript documents. No text was changed.');
  found.set(range.occurrenceId,{...range,documentId});
 }return found;
}
export function validateReferenceReplacement(project:Project,id:string,body:Doc){projectReferenceRanges({documents:{...project.documents,[id]:body}});}
export function remintReferences(body:Doc,newId:()=>string=()=>crypto.randomUUID()):Doc{
 const mapping=new Map(referenceRanges(body).map(r=>[r.occurrenceId,newId()]));
 if(new Set(mapping.values()).size!==mapping.size)throw Error('Reference identity allocation failed.');
 const copy=structuredClone(body);const visit=(n:Doc)=>{if(n.marks)n.marks=n.marks.map(m=>m.type==='entityReference'?{...m,attrs:{...m.attrs,occurrenceId:mapping.get(String(m.attrs?.occurrenceId))}}:m);n.content?.forEach(visit);};visit(copy);referenceRanges(copy);return copy;
}
