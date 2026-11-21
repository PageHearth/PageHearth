import {randomUUID} from 'node:crypto';
import {clearRevisionPass,type RevisionId} from '../shared/revisionPasses.js';
import type {Project,Doc} from '../shared/model.js';
export type RevisionClearRecord={id:string;projectId:string;before:Record<string,Doc>;after:Record<string,Doc>;applied:boolean};
export class RevisionOperations{
 records=new Map<string,RevisionClearRecord>();
 prepare(p:Project,slot:RevisionId){const {project,ids}=clearRevisionPass(p,slot);const record:RevisionClearRecord={id:randomUUID(),projectId:p.manifest.id,before:Object.fromEntries(ids.map(id=>[id,p.documents[id]])),after:Object.fromEntries(ids.map(id=>[id,project.documents[id]])),applied:true};if(Buffer.byteLength(JSON.stringify(record))>16*1024*1024)throw Error('Clear exceeds the safe Undo budget. No marks were removed.');return {project,record};}
 remember(record:RevisionClearRecord){this.records.set(record.id,structuredClone(record));while(this.records.size>32||Buffer.byteLength(JSON.stringify([...this.records.values()]))>32*1024*1024)this.records.delete(this.records.keys().next().value!);}
 traverse(p:Project,id:string,direction:'undo'|'redo'){const r=this.records.get(id);if(!r||r.projectId!==p.manifest.id||r.applied!==(direction==='undo'))throw Error('Revision Clear history is unavailable.');const expected=r.applied?r.after:r.before,target=r.applied?r.before:r.after;for(const key of Object.keys(expected))if(JSON.stringify(p.documents[key])!==JSON.stringify(expected[key]))throw Error('Affected manuscript changed. Revision Clear history cannot overwrite newer work.');const next={...p,documents:{...p.documents,...structuredClone(target)}};if(p.author.comments){const comments={...p.author.comments,documentBases:{...p.author.comments.documentBases}};for(const key of Object.keys(target))if(Object.hasOwn(comments.documentBases,key))comments.documentBases[key]=JSON.stringify(target[key]);next.author={...p.author,comments};}return {project:next,record:r};}
}
export type RevisionClearReply={project:Project;operationId:string};
