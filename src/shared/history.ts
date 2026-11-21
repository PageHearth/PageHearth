import {remintReferences,validateReferenceReplacement} from './referenceIntegrity.js';
import {type Doc,type Project,validate,words} from './model.js';
export type HistoryRetention=0|10|30|100;
export type HistoryMeta={schema:1;id:string;documentId:string;kind:'manual'|'automatic';capturedAt:string;title:string;documentKind:'Chapter'|'Scene';wordCount:number;hash:string;label:string;note:string};
export type HistoryEntry=HistoryMeta&{damaged?:string};
export type HistoryList={entries:HistoryEntry[];warnings:string[];retention:HistoryRetention};
export const HISTORY_INTERVAL=15*60*1000;
export function historyDocument(project:Project,id:string,body?:Doc){const node=project.manifest.nodes.find(n=>n.id===id);if(!node||!['Chapter','Scene'].includes(node.kind))throw Error('Select a Chapter or Scene.');if(body)validate({...project,documents:{...project.documents,[id]:remintReferences(body)}});return node;}
export function restoredCopy(project:Project,sourceId:string,body:Doc,title:string,id=crypto.randomUUID()):Project{const fresh=remintReferences(body),source=historyDocument(project,sourceId,fresh);if(source.trashed)throw Error('Restore this document from Trash before creating a sibling.');if(!title.trim())throw Error('Enter a title.');const next=structuredClone(project);let at=next.manifest.nodes.findIndex(n=>n.id===sourceId)+1;const descendants=new Set([sourceId]);while(at<next.manifest.nodes.length&&descendants.has(next.manifest.nodes[at].parent||'')){descendants.add(next.manifest.nodes[at].id);at++;}next.manifest.nodes.splice(at,0,{id,title:title.trim(),kind:source.kind,parent:source.parent});next.documents[id]=fresh;validateReferenceReplacement(next,id,next.documents[id]);validate(next);return next;}
export {words};
