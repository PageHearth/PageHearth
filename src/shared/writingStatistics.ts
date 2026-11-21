import type {Doc,Project} from './model.js';
import {analyze,manuscriptIds,sumStats,type TextStats} from './textAnalysis.js';
export type StatisticsSnapshot={projectId:string;defaultScope:string;rows:{id:string;label:string;stats:TextStats;chapters:number;scenes:number}[]};
/** Read-only derived values for the utility. No prose, editor instance or shadow project is transported. */
export function statisticsSnapshot(project:Project,selected:string,editorIds?:string[],selection?:Doc):StatisticsSnapshot{
 const nodes=project.manifest.nodes.filter(n=>!n.trashed&&['Chapter','Scene'].includes(n.kind));
 const row=(id:string,label:string,ids:string[])=>({id,label,stats:sumStats(ids.map(id=>project.documents[id]).filter(Boolean)),chapters:nodes.filter(n=>n.kind==='Chapter'&&ids.includes(n.id)).length,scenes:nodes.filter(n=>n.kind==='Scene'&&ids.includes(n.id)).length});
 return {projectId:project.manifest.id,defaultScope:selection?'selection':editorIds?'editor':'document',rows:[...(selection?[{id:'selection',label:'Selection',stats:analyze(selection),chapters:0,scenes:0}]:[]),...(editorIds?[row('editor','Current editor scope',editorIds)]:[]),row('document','Current document',[selected]),row('manuscript','Entire manuscript',manuscriptIds(project)),...nodes.map(n=>row(n.id,`${n.kind}: ${n.title}`,manuscriptIds(project,n.id)))]};
}
