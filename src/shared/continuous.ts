import {type Doc,type Project} from './model.js';

/** Presentation only. Never contains copied manuscript content or file paths. */
export type ManuscriptScope={kind:'all'}|{kind:'roots';ids:string[]};
export function readScope(value:unknown,p:Project):ManuscriptScope|null{
 if(!value||typeof value!=='object')return null;
 const v=value as Partial<{kind:string;ids:unknown}>;
 if(v.kind==='all')return {kind:'all'};
 if(v.kind!=='roots'||!Array.isArray(v.ids))return null;
 const ids=[...new Set(v.ids.filter((id):id is string=>typeof id==='string'&&p.manifest.nodes.some(n=>n.id===id)))];
 return ids.length?{kind:'roots',ids}:null;
}
export function scopeDocuments(p:Project,scope:ManuscriptScope):string[]{
 const children=new Map<string|null,typeof p.manifest.nodes>();
 for(const node of p.manifest.nodes){const siblings=children.get(node.parent)||[];siblings.push(node);children.set(node.parent,siblings);}
 const roots=new Set(scope.kind==='roots'?scope.ids:[]),result:string[]=[],seen=new Set<string>();
 function visit(parent:string|null,included:boolean){for(const n of children.get(parent)||[]){if(seen.has(n.id)||n.trashed)continue;seen.add(n.id);const take=included||roots.has(n.id);if(take&&p.documents[n.id])result.push(n.id);visit(n.id,take);}}
 visit(null,scope.kind==='all');return result;
}
export function compositeBody(p:Project,ids:string[]):Doc{return {type:'doc',content:ids.map(id=>({type:'manuscriptSegment',attrs:{documentId:id},content:p.documents[id].content}))};}
export function segmentLabel(p:Project,id:string):string{const names:string[]=[];let node=p.manifest.nodes.find(n=>n.id===id);const seen=new Set<string>();while(node&&!seen.has(node.id)){seen.add(node.id);names.unshift(node.title);node=p.manifest.nodes.find(n=>n.id===node!.parent);}return names.join(' › ');}
