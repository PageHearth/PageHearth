import {anchors,restoreAnchors,type AnchorSide} from '../shared/comments.js';
import {createHash,randomUUID} from 'node:crypto';
import {manuscriptSchema} from '../shared/manuscriptSchema.js';
import {planSceneSelection,type SceneSelection} from '../shared/sceneSelection.js';
import {validate,type Project,type Doc,type TreeNode} from '../shared/model.js';
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
type Side={anchors:AnchorSide;bodies:Record<string,Doc>;nodes:TreeNode[];scenes:Project['author']['scenes'];guard:string};
export type SceneOperation={id:string;projectId:string;sourceId:string;createdIds:string[];pieceIds:string[];selectedId:string;selectedFrom:number;originalFrom:number;before:Side;after:Side;applied:boolean};
function guard(p:Project,ids:string[]){const {scenes,comments,...author}=p.author;return digest({nodes:p.manifest.nodes,author,bodies:ids.map(id=>p.documents[id]??null)});}
function side(p:Project,ids:string[]):Side{return {anchors:Object.fromEntries(Object.entries(anchors(p.author.comments)).filter(([,a])=>ids.includes(a.documentId))),bodies:Object.fromEntries(ids.filter(id=>p.documents[id]).map(id=>[id,p.documents[id]])),nodes:p.manifest.nodes,scenes:p.author.scenes,guard:guard(p,ids)};}
/** Main-owned bounded capabilities; never accepted from renderer JSON. */
export class SceneOperations{
 records=new Map<string,SceneOperation>();
 prepare(p:Project,request:SceneSelection){
  const plan=planSceneSelection(p,request,manuscriptSchema,randomUUID),ids=[request.sourceId,...plan.createdIds];
  const record:SceneOperation={id:randomUUID(),projectId:p.manifest.id,sourceId:plan.sourceId,createdIds:plan.createdIds,pieceIds:plan.pieceIds,selectedId:plan.selectedId,selectedFrom:plan.selectedFrom,originalFrom:request.from,before:side(p,ids),after:side(plan.project,ids),applied:true};
  if(Buffer.byteLength(JSON.stringify(record))>16*1024*1024)throw Error('This selection exceeds the safe structural Undo budget. Split a smaller document.');
  return {record,plan};
 }
 remember(record:SceneOperation){this.records.set(record.id,structuredClone(record));while(this.records.size>32||Buffer.byteLength(JSON.stringify([...this.records.values()]))>32*1024*1024)this.records.delete(this.records.keys().next().value!);}
 traverse(p:Project,id:string,direction:'undo'|'redo'){
  const record=this.records.get(id);if(!record||record.projectId!==p.manifest.id||record.applied!==(direction==='undo'))throw Error('Structural history is no longer available in this project session.');
  const ids=[record.sourceId,...record.createdIds],expected=record.applied?record.after:record.before,target=record.applied?record.before:record.after;
  if(guard(p,ids)!==expected.guard||p.author.scenes!==expected.scenes){this.records.delete(id);throw Error('The manuscript structure, affected prose or Author data changed. Structural history was invalidated; no content was overwritten.');}
  const next=structuredClone(p);next.manifest.nodes=structuredClone(target.nodes);next.author.scenes=target.scenes;
  for(const key of ids){if(target.bodies[key])next.documents[key]=structuredClone(target.bodies[key]);else delete next.documents[key];}
  // Other manuscript bodies can gain references without changing affected bodies.
  if(direction==='undo')for(const [key,body] of Object.entries(next.documents))if(!ids.includes(key)&&record.createdIds.some(created=>JSON.stringify(body).includes(created)))throw Error('New manuscript dependencies prevent structural Undo.');
  next.author.comments=restoreAnchors(p.author.comments,expected.anchors,target.anchors,target.bodies);
  if(p.author.comments&&Object.values(p.author.comments.byId).some(c=>ids.includes(c.anchor.documentId)&&!Object.hasOwn(expected.anchors,c.id)))throw Error('New comments prevent structural history traversal.');
  validate(next);return {record,project:next};
 }
 reply(project:Project,record:SceneOperation){return {project,operationId:record.id,sourceId:record.sourceId,createdIds:record.createdIds,pieceIds:record.pieceIds,selectedId:record.applied?record.selectedId:record.sourceId,selectedFrom:record.applied?record.selectedFrom:record.originalFrom};}
}
export type SceneReply=ReturnType<SceneOperations['reply']>;
