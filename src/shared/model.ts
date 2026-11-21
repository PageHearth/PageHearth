import {validManuscriptImage} from './manuscriptImages.js';
import {validSpecialText,validSpecialRegionId} from './specialText.js';
import {validatePublication,type PublicationPlan} from './publication.js';
import {validateProjectDictionary,type ProjectDictionary} from './spelling.js';
import {projectReferenceRanges} from './referenceIntegrity.js';
import {validateRevisionPasses,validRevisionId,type RevisionPasses} from './revisionPasses.js';
import {validateComments,type CommentsState} from './comments.js';
import {validFontSize,validAlignment} from './typography.js';
import {validateTimeline,type TimelineState} from './timeline.js';
import {validFontFamily} from './fonts.js';
import {analyze} from './textAnalysis.js';
export type Doc = { type: string; text?: string; attrs?: Record<string, unknown>; marks?: {type: string; attrs?: Record<string, unknown>}[]; content?: Doc[] };
export type TreeNode = { id: string; parent: string | null; title: string; kind: 'Part' | 'Chapter' | 'Scene' | 'Folder'; trashed?:boolean };
export type Manifest = { version: 1; id: string; title: string; revision: number; nodes: TreeNode[]; settings: { editor: Record<string, unknown>; publication: Record<string, unknown>; workspace: Record<string, unknown>; backup?:{directory?:string;daily?:boolean} } };
export type ObjectMetadata = { summary:string; status:string; inspectorNote:string; tags:string[]; primaryLocationId?:string };
export type CustomFieldDefinition = { id:string; label:string; kinds:TreeNode['kind'][]; order:number };
export type CustomFields = { definitions:CustomFieldDefinition[]; values:Record<string,Record<string,string>> };
export type NotebookFolder = { id:string; parent:string|null; title:string; order:number; trashed?:boolean; system?:'quicknotes' };
export type NotebookNote = { id:string; folder:string|null; title:string; body:Doc; tags:string[]; favorite:boolean; created:string; modified:string; order:number; trashed?:boolean };
export type ExplicitReference = { id:string; sourceType:'note'|'document'|'card'; sourceId:string; targetType:'note'|'document'; targetId:string; label:string };
export type PlanningCard = { id:string; kind:'planning'; text:string; x:number; y:number; color?:string };
export type ReferenceCard = { id:string; kind:'reference'; targetType:'note'|'document'; targetId:string; targetLabel?:string; parentId?:string|null; parentLabel?:string; x:number; y:number; color?:string };
export type Corkboard = { contextId:string; cards:(PlanningCard|ReferenceCard)[] };
import type {WorldBibleState} from './worldBible.js';
import {defaultWorldBible,validateWorldBible} from './worldBible.js';
import type {ResearchState} from './research.js';
import {defaultResearch,validateResearch} from './research.js';
import type {CollectionsState} from './collections.js';
import {defaultCollections,validateCollections} from './collections.js';
export type AuthorState = {
  publication?:PublicationPlan;
  projectDictionary?:ProjectDictionary;
  comments?:CommentsState;
  revisionPasses?:RevisionPasses;
  version:1;
  scenes:'off'|'available';
  metadata:Record<string,ObjectMetadata>;
  customFields:CustomFields;
  notebook:{folders:NotebookFolder[];notes:NotebookNote[]};
  references:ExplicitReference[];
  corkboards:Record<string,Corkboard>;
  quickNotes:{text:string;lastCleared?:string;updated?:string};
  worldBible?:WorldBibleState;
  research?:ResearchState;
  collections?:CollectionsState;
  timeline?:TimelineState;
};
export type Project = { manifest: Manifest; documents: Record<string, Doc>; author:AuthorState; recovery: string[] };
export const blank = (): Doc => ({ type: 'doc', content: [{ type: 'paragraph' }] });
export const blankMetadata = ():ObjectMetadata=>({summary:'',status:'',inspectorNote:'',tags:[]});
export const defaultAuthor = (quickNotesFolderId:string=crypto.randomUUID()):AuthorState=>({version:1,scenes:'available',metadata:{},customFields:{definitions:[],values:{}},notebook:{folders:[{id:quickNotesFolderId,parent:null,title:'QuickNotes',order:0,system:'quicknotes'}],notes:[]},references:[],corkboards:{},quickNotes:{text:''},worldBible:defaultWorldBible(),research:defaultResearch(),collections:defaultCollections()});
export const legacyQuickNotesId=(projectId:string)=>projectId.slice(0,24)+'515549434b4e';
export const plain = (doc: Doc): string => doc.type==='manuscriptImage'?String(doc.attrs?.caption||''):doc.text ?? (doc.content?.map(plain).join(['doc','bulletList','orderedList'].includes(doc.type) ? '\n' : '') ?? '');
export const words = (doc: Doc): number => analyze(doc).words;
export function validate(p: Project) {
  const m = p.manifest;
  if (m.version !== 1 || !/^[a-f0-9-]{36}$/.test(m.id) || !Number.isSafeInteger(m.revision) || m.revision < 0 || typeof m.title !== 'string' || !m.title.trim() || !Array.isArray(m.nodes) || !m.settings?.editor || !m.settings?.publication || !m.settings?.workspace) throw Error('Unsupported or damaged project manifest.');
  const ids = new Set(m.nodes.map(n => n.id));
  if(m.settings.backup && ((m.settings.backup.directory!==undefined && typeof m.settings.backup.directory!=='string') || (m.settings.backup.daily!==undefined && typeof m.settings.backup.daily!=='boolean')))throw Error('Invalid backup preferences.');
  if (ids.size !== m.nodes.length) throw Error('Duplicate document IDs.');
  for (const n of m.nodes) {
    if(n.trashed!==undefined && typeof n.trashed!=='boolean')throw Error('Invalid Trash metadata.');
    if (!/^[a-f0-9-]{36}$/.test(n.id) || typeof n.title !== 'string' || !['Part','Chapter','Scene','Folder'].includes(n.kind)) throw Error('Invalid document metadata.');
    const seen = new Set([n.id]); let parent = n.parent;
    while (parent !== null) { if (!ids.has(parent) || seen.has(parent)) throw Error('Invalid tree hierarchy.'); seen.add(parent); parent = m.nodes.find(x => x.id === parent)!.parent; }
    const doc = p.documents[n.id];
    if (!doc || doc.type !== 'doc') throw Error('A manuscript document is missing.');
    const allowed = new Set(['doc','paragraph','text','heading','blockquote','bulletList','orderedList','listItem','codeBlock','hardBreak','horizontalRule','manuscriptImage']);
    const imageIds=new Set<string>();
    const check = (d: Doc, depth: number) => { if(d.type==='manuscriptImage'){if(depth!==1||!validManuscriptImage(d.attrs)||d.attrs.projectId!==m.id||d.content?.length||d.marks?.length||d.text!==undefined||imageIds.has(d.attrs.id))throw Error('Invalid manuscript image.');imageIds.add(d.attrs.id);} if (depth > 100 || !allowed.has(d.type) || (d.text !== undefined && typeof d.text !== 'string')) throw Error('Unsupported rich-text content.'); if (d.marks?.some(m => !['bold','italic','strike','code','underline','link','entityReference','textStyle','fontSize','revisionPass'].includes(m.type) || (m.type==='revisionPass'&&(!validRevisionId(m.attrs?.slotId)||Object.keys(m.attrs||{}).length!==1)) || (m.type==='fontSize'&&(!validFontSize(m.attrs?.points)||Object.keys(m.attrs||{}).some(key=>key!=='points'))) || (m.type==='textStyle'&&(!validFontFamily(m.attrs?.fontFamily)||Object.keys(m.attrs||{}).some(key=>key!=='fontFamily'))) || (m.type==='entityReference' && (typeof m.attrs?.occurrenceId!=='string'||!/^[a-f0-9-]{36}$/.test(m.attrs.occurrenceId)||typeof m.attrs?.targetId!=='string'||!/^[a-f0-9-]{36}$/.test(m.attrs.targetId))))) throw Error('Unsupported rich-text mark.'); d.content?.forEach(c => check(c, depth + 1)); };
    check(doc, 0);
    const checkRevision=(n:Doc)=>{if((n.marks?.filter(m=>m.type==='revisionPass').length||0)>1||n.marks?.some(m=>m.type==='revisionPass')&&n.type!=='text')throw Error('Invalid Revision mark placement.');n.content?.forEach(checkRevision);};checkRevision(doc);
    const checkIndent=(d:Doc)=>{if(d.attrs?.specialRegionId!=null&&(d.type!=='paragraph'||!validSpecialText(d.attrs.specialText)||!validSpecialRegionId(d.attrs.specialRegionId)))throw Error('Invalid Special Text region identity.');if(d.attrs?.specialText!=null&&(d.type!=='paragraph'||!validSpecialText(d.attrs.specialText)))throw Error('Invalid Special Text role.');if(d.attrs?.textAlign!=null&&!validAlignment(d.attrs.textAlign))throw Error('Invalid text alignment.');if(d.attrs?.indent!==undefined && (!Number.isInteger(d.attrs.indent) || Number(d.attrs.indent)<0 || Number(d.attrs.indent)>8))throw Error('Invalid paragraph indentation.');d.content?.forEach(checkIndent);};checkIndent(doc);
  }
  projectReferenceRanges(p);
  validateAuthor(p.author,m.nodes);
}

function id(value:unknown){return typeof value==='string' && /^[a-f0-9-]{36}$/.test(value);}
function validateAuthor(a:AuthorState,nodes:TreeNode[]){
  if(!a || a.version!==1 || !['off','available'].includes(a.scenes) || !a.metadata || !a.notebook || !Array.isArray(a.notebook.folders) || !Array.isArray(a.notebook.notes) || !Array.isArray(a.references) || !a.corkboards || !a.quickNotes || typeof a.quickNotes.text!=='string')throw Error('Unsupported or damaged Author Workspace data.');
  const known=new Set(['version','scenes','metadata','customFields','notebook','references','corkboards','quickNotes','worldBible','research','collections','timeline','comments','revisionPasses','projectDictionary','publication']);if(Object.keys(a).some(k=>!known.has(k)))throw Error('Unsupported Author Workspace section.');
  validatePublication(a.publication);validateProjectDictionary(a.projectDictionary);validateComments(a.comments);validateRevisionPasses(a.revisionPasses);
  validateWorldBible(a.worldBible);
  validateResearch(a.research);
  const objectIds=new Set(nodes.map(n=>n.id));
  for(const [key,value] of Object.entries(a.metadata)){if(!objectIds.has(key) || typeof value.summary!=='string' || typeof value.status!=='string' || typeof value.inspectorNote!=='string' || !Array.isArray(value.tags) || value.tags.some(t=>typeof t!=='string') || (value.primaryLocationId!==undefined&&!id(value.primaryLocationId)))throw Error('Invalid canonical metadata.');}
  if(!a.customFields || !Array.isArray(a.customFields.definitions) || !a.customFields.values || Array.isArray(a.customFields.values))throw Error('Invalid custom fields.');
  const fieldIds=new Set<string>();
  for(const field of a.customFields.definitions){if(!id(field.id)||fieldIds.has(field.id)||typeof field.label!=='string'||!field.label.trim()||!Array.isArray(field.kinds)||!field.kinds.length||field.kinds.some(k=>!['Part','Chapter','Scene','Folder'].includes(k))||!Number.isFinite(field.order))throw Error('Invalid custom field definition.');fieldIds.add(field.id);}
  for(const [objectId,values] of Object.entries(a.customFields.values)){if(!objectIds.has(objectId)||!values||Array.isArray(values))throw Error('Invalid custom field values.');const kind=nodes.find(n=>n.id===objectId)!.kind;for(const [fieldId,value] of Object.entries(values)){const field=a.customFields.definitions.find(f=>f.id===fieldId);if(!field||!field.kinds.includes(kind)||typeof value!=='string')throw Error('Invalid custom field value.');}}
  const folderIds=new Set(a.notebook.folders.map(f=>f.id));const noteIds=new Set(a.notebook.notes.map(n=>n.id));if(folderIds.size!==a.notebook.folders.length || noteIds.size!==a.notebook.notes.length || [...folderIds].some(x=>noteIds.has(x)))throw Error('Duplicate Notebook IDs.');
  for(const f of a.notebook.folders){if(!id(f.id) || (f.parent!==null && !folderIds.has(f.parent)) || typeof f.title!=='string' || !Number.isFinite(f.order) || (f.system!==undefined && f.system!=='quicknotes'))throw Error('Invalid Notebook folder.');let at=f.parent;const seen=new Set([f.id]);while(at){if(seen.has(at))throw Error('Invalid Notebook folder hierarchy.');seen.add(at);at=a.notebook.folders.find(x=>x.id===at)!.parent;}}
  if(a.notebook.folders.filter(f=>f.system==='quicknotes').length!==1)throw Error('QuickNotes folder is missing or duplicated.');
  for(const n of a.notebook.notes){if(!id(n.id) || (n.folder!==null && !folderIds.has(n.folder)) || typeof n.title!=='string' || !Array.isArray(n.tags) || n.tags.some(t=>typeof t!=='string') || typeof n.favorite!=='boolean' || typeof n.created!=='string' || typeof n.modified!=='string' || !Number.isFinite(n.order))throw Error('Invalid Notebook Note.');checkDoc(n.body);}
  const cardIds=new Set<string>();
  for(const [contextId,board] of Object.entries(a.corkboards)){if(contextId!==board.contextId || !objectIds.has(contextId) || !Array.isArray(board.cards))throw Error('Invalid Corkboard context.');const ids=new Set<string>();for(const c of board.cards){if(!id(c.id) || ids.has(c.id) || !Number.isFinite(c.x) || !Number.isFinite(c.y) || (c.color!==undefined&&!['neutral','yellow','cyan','magenta'].includes(c.color)&&!/^#[0-9a-f]{6}$/i.test(c.color)))throw Error('Invalid Corkboard card.');ids.add(c.id);cardIds.add(c.id);if(c.kind==='planning'){if(typeof c.text!=='string')throw Error('Invalid Planning Card.');}else if(c.kind==='reference'){if(!id(c.targetId) || !['note','document'].includes(c.targetType) || (c.targetLabel!==undefined&&typeof c.targetLabel!=='string') || (c.parentId!==undefined&&c.parentId!==null&&!id(c.parentId)) || (c.parentLabel!==undefined&&typeof c.parentLabel!=='string'))throw Error('Invalid Corkboard reference.');}else throw Error('Unsupported Corkboard card.');}}
  // Target IDs may be unresolved so the UI can preserve and expose a missing link.
  // Creation/relink operations still require a live canonical target.
  const sources={note:noteIds,document:objectIds,card:cardIds};for(const r of a.references)if(!id(r.id) || !['note','document','card'].includes(r.sourceType) || !['note','document'].includes(r.targetType) || typeof r.label!=='string' || !sources[r.sourceType].has(r.sourceId) || !id(r.targetId))throw Error('Invalid explicit reference.');
  const reserved=new Set([...objectIds,...folderIds,...noteIds,...cardIds,...(a.worldBible?.entities||[]).map(value=>value.id),...(a.research?.items||[]).map(value=>value.id)]);validateCollections(a.collections,reserved);validateTimeline(a.timeline,new Set([...reserved,...(a.collections?.items||[]).map(item=>item.id)]));
}
function checkDoc(doc:Doc){const allowed=new Set(['doc','paragraph','text','heading','blockquote','bulletList','orderedList','listItem','taskList','taskItem','codeBlock','hardBreak','horizontalRule']);const walk=(d:Doc,depth:number)=>{if(depth>100 || !allowed.has(d.type) || (d.text!==undefined && typeof d.text!=='string') || (d.type==='taskItem' && d.attrs?.checked!==undefined && typeof d.attrs.checked!=='boolean'))throw Error('Unsupported rich-text content.');d.content?.forEach(c=>walk(c,depth+1));};walk(doc,0);}
