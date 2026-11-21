import {referenceRanges,projectReferenceRanges} from './referenceIntegrity.js';
import {commentBody,missingAnchor} from './comments.js';
import {Fragment,type Node as PMNode,type Schema} from '@tiptap/pm/model';
import {blank,validate,words,type Doc,type Project,type TreeNode} from './model.js';
import type {ManuscriptScope} from './continuous.js';

export type SceneSelection={projectId:string;sourceId:string;from:number;to:number;body:string;revision:number};
export type ScenePlan={project:Project;sourceId:string;selectedId:string;selectedFrom:number;createdIds:string[];pieceIds:string[]};
export const bodyFingerprint=(body:Doc)=>JSON.stringify(body);
export function sceneResultScope(scope:ManuscriptScope|null,p:Project,sourceId:string,pieces:string[]):ManuscriptScope|null{
 // Chapter scopes must keep their existing descendants as well as the new Scenes.
 if(scope?.kind==='roots'&&scope.ids.includes(sourceId)&&p.manifest.nodes.find(n=>n.id===sourceId)?.kind==='Scene')return {kind:'roots',ids:[...new Set(scope.ids.flatMap(id=>id===sourceId?pieces:[id]))]};
 return scope;
}
const meaningful=(node:PMNode)=>!!node.textContent.trim()||hasRule(node);
function hasRule(node:PMNode){let found=false;node.descendants(n=>{if(n.type.name==='horizontalRule')found=true;});return found;}

/** Exact cuts with explicit ancestor closure. No filler, HTML or clipboard conversion. */
export type PartitionSpan={from:number;to:number;target:number};
function cut(node:PMNode,from:number,to:number,spans:PartitionSpan[],source=0,target=0):PMNode{
 const children:PMNode[]=[];let firstIndex=-1;
 node.forEach((child,offset,index)=>{
  const a=Math.max(0,from-offset),b=Math.min(child.nodeSize,to-offset);if(a>=b)return;
  if(firstIndex<0)firstIndex=index;
  const dest=target+children.reduce((n,c)=>n+c.nodeSize,0);
  if(a===0&&b===child.nodeSize){spans.push({from:source+offset,to:source+offset+child.nodeSize,target:dest});children.push(child);return;}
  if(child.isText){spans.push({from:source+offset+a,to:source+offset+b,target:dest});children.push(child.cut(a,b));return;}
  if(child.isLeaf)throw Error('Move the selection boundary outside the embedded block.');
  const innerA=Math.max(0,a-1),innerB=Math.min(child.content.size,b-1);
  if(innerA<innerB)children.push(cut(child,innerA,innerB,spans,source+offset+1,dest+1));
 });
 const attrs=node.type.name==='orderedList'?{...node.attrs,start:node.attrs.start+Math.max(0,firstIndex)}:node.attrs;
 // In particular, a partial list item that no longer starts with a paragraph is
 // refused rather than silently manufacturing a paragraph or flattening a list.
 if(!node.type.validContent(Fragment.from(children)))throw Error('This boundary cannot preserve the list/block structure. Select a complete item or paragraph.');
 return node.type.createChecked(attrs,children,node.marks);
}
function leafLedger(docs:PMNode[]):string{
 const result:{value:string;style:string;text:boolean}[]=[];
 for(const doc of docs)doc.descendants(node=>{
  if(node.isText){const style=JSON.stringify(node.marks.map(m=>m.toJSON())),last=result.at(-1);if(last?.text&&last.style===style)last.value+=node.text!;else result.push({value:node.text!,style,text:true});}
  else if(node.isLeaf||(node.isTextblock&&node.content.size===0))result.push({value:JSON.stringify(node.toJSON()),style:'',text:false});
 });return JSON.stringify(result);
}
function references(doc:PMNode){return new Map(referenceRanges(doc.toJSON()).map(r=>[r.occurrenceId,{from:r.from,to:r.to,target:r.targetId}]));}
function boundary(doc:PMNode,pos:number){
 const p=doc.resolve(pos);if(!p.parent.isTextblock)return;
 const text=p.parent.textBetween(0,p.parent.content.size,'','\n'),offset=p.parentOffset;
 const boundaries=new Set([...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text)].map(x=>x.index));boundaries.add(text.length);
 if(!boundaries.has(offset))throw Error('Move the selection boundary outside the Unicode character.');
 // PageHearth counts whitespace tokens, including punctuation inside a word.
 if(offset>0&&offset<text.length&&!/\s/u.test(text[offset-1])&&!/\s/u.test(text[offset]))throw Error('Move the selection boundary between words.');
}
export function partitionScene(schema:Schema,body:Doc,from:number,to:number){
 const doc=schema.nodeFromJSON(body);doc.check();
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to>doc.content.size||from>=to)throw Error('Select some manuscript text first.');
 if(!doc.textBetween(from,to,'\n','\n').trim())throw Error('Select meaningful manuscript text first.');
 for(const range of references(doc).values())if([from,to].some(p=>p>range.from&&p<range.to))throw Error('A PageHearth reference cannot be split.');
 boundary(doc,from);boundary(doc,to);
 // Fold nonmeaningful edges before cutting, preserving the original selection offset.
 const before=from?doc.cut(0,from):null,after=to<doc.content.size?doc.cut(to):null;
 const start=before&&meaningful(before)?from:0,end=after&&meaningful(after)?to:doc.content.size;
 const ranges=[[0,start],[start,end],[end,doc.content.size]].filter(([a,b])=>a<b);
 const provenance:PartitionSpan[][]=[];const parts=ranges.map(([a,b])=>{const spans:PartitionSpan[]=[];provenance.push(spans);return cut(doc,a,b,spans);});for(const part of parts)part.check();
 if(leafLedger(parts)!==leafLedger([doc]))throw Error('The selection cannot be separated without changing prose or formatting.');
 const bodies=parts.map(n=>n.toJSON() as Doc);
 if(bodies.reduce((sum,d)=>sum+words(d),0)!==words(body))throw Error('Move the selection boundary between words.');
 const selected=ranges.findIndex(([a,b])=>a===start&&b===end);
 // Position of selected text after reconstructing its ancestor chain.
 const prefix=doc.textBetween(start,from,'','\n');let offset=1;
 if(start===0)offset=from;else {const resolved=doc.resolve(from);offset=resolved.depth;}
 if(prefix&&start===0)offset=from;
 return {bodies,selected,selectedFrom:Math.max(1,offset),ranges,provenance};
}
export function planSceneSelection(p:Project,r:SceneSelection,schema:Schema,newId:()=>string):ScenePlan{
 if(p.manifest.id!==r.projectId||p.manifest.revision!==r.revision||bodyFingerprint(p.documents[r.sourceId])!==r.body)throw Error('The source changed. Select the text again.');
 const source=p.manifest.nodes.find(n=>n.id===r.sourceId);
 if(!source||source.trashed||!['Chapter','Scene'].includes(source.kind))throw Error('Select text within one active Chapter or Scene.');
 const parent=source.kind==='Chapter'?source:p.manifest.nodes.find(n=>n.id===source.parent);
 if(parent?.kind!=='Chapter')throw Error('Scenes must be direct children of a Chapter.');
 if(source.kind==='Scene'&&p.manifest.nodes.some(n=>n.parent===source.id))throw Error('This Scene has children. Resolve its hierarchy before splitting it.');
 projectReferenceRanges(p);
 const occurrences=references(schema.nodeFromJSON(p.documents[source.id]));
 if(occurrences.size)for(const [id,body] of Object.entries(p.documents))if(id!==source.id){const visit=(n:Doc)=>{if(n.marks?.some(m=>m.type==='entityReference'&&occurrences.has(String(m.attrs?.occurrenceId))))throw Error('Duplicate PageHearth reference occurrence evidence; no text was changed.');n.content?.forEach(visit);};visit(body);}
 const result=partitionScene(schema,p.documents[source.id],r.from,r.to);
 if(source.kind==='Scene'&&result.bodies.length===1)throw Error('This selection already fills the current Scene.');
 const next=structuredClone(p),createdIds:string[]=[],pieceIds:string[]=[],nodes:TreeNode[]=[];
 const titles=new Set(p.manifest.nodes.filter(n=>n.parent===parent.id).map(n=>n.title));let number=1;
 for(let i=0;i<result.bodies.length;i++){
  let node:TreeNode;if(source.kind==='Scene'&&i===0)node={...source};else{
   while(titles.has('Scene '+number))number++;const title='Scene '+number++;titles.add(title);
   const id=newId();if(next.documents[id]||createdIds.includes(id))throw Error('Scene identity collision.');
   node={id,parent:parent.id,title,kind:'Scene'};createdIds.push(id);
  }
  pieceIds.push(node.id);nodes.push(node);next.documents[node.id]=result.bodies[i];
 }
 if(source.kind==='Chapter')next.documents[source.id]=blank();
 const at=next.manifest.nodes.findIndex(n=>n.id===source.id);
 if(source.kind==='Scene')next.manifest.nodes.splice(at,1,...nodes);
 else {const child=next.manifest.nodes.findIndex(n=>n.parent===source.id);next.manifest.nodes.splice(child<0?at+1:child,0,...nodes);}
 if(next.author.comments){const comments=next.author.comments;for(const c of Object.values(comments.byId)){const a=c.anchor;if(a.documentId!==source.id||a.status!=='attached')continue;
 const piece=result.ranges.findIndex(([start,end],i)=>a.from>=start&&(a.kind==='caret'?(a.from<end||i===result.ranges.length-1&&a.from===end):a.to<=end));
 const spans=result.provenance[piece]||[],point=(pos:number,assoc:number)=>{const matches=spans.filter(s=>pos>=s.from&&pos<=s.to);const span=assoc>0?matches.at(-1):matches[0];return span?span.target+pos-span.from:null;};const from=point(a.from,1),to=point(a.to,a.kind==='caret'?1:-1);
 if(comments.documentBases[source.id]!==commentBody(p.documents[source.id])||piece<0||from===null||to===null)c.anchor=missingAnchor(a,'structural-split');else c.anchor={...a,documentId:pieceIds[piece],from,to};
 }for(const id of [source.id,...pieceIds])comments.documentBases[id]=commentBody(next.documents[id]);}
 next.author.scenes='available';validate(next);
 if(Object.values(next.documents).reduce((sum,d)=>sum+words(d),0)!==Object.values(p.documents).reduce((sum,d)=>sum+words(d),0))throw Error('Manuscript word conservation failed.');
 return {project:next,sourceId:source.id,selectedId:pieceIds[result.selected],selectedFrom:result.selectedFrom,createdIds,pieceIds};
}
