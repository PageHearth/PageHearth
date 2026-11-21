import {blank,plain,type Doc,type Project} from './model.js';
import {customCategory} from './worldBible.js';

export type CollectionTargetType='document'|'entity'|'note'|'research';
export type CollectionMember={type:CollectionTargetType;id:string;fallbackLabel:string};
export type CollectionSort='manual'|'az'|'za'|'type'|'modified';
export type Collection={id:string;kind:'manual';title:string;note:Doc;favorite:boolean;members:CollectionMember[];presentation:{groupByType:boolean;sort:CollectionSort};created:string;modified:string;trashed?:boolean};
export type CollectionsState={version:1;items:Collection[]};
export type ResolvedCollectionMember=CollectionMember&{label:string;typeLabel:string;group:'Manuscript'|'World Bible'|'Notebook'|'Research';state:'active'|'trash'|'missing';modified?:string;preview:string};

export const defaultCollections=():CollectionsState=>({version:1,items:[]});
const copy=(project:Project)=>structuredClone(project);
const stamp=()=>new Date().toISOString();
const key=(value:Pick<CollectionMember,'type'|'id'>)=>`${value.type}:${value.id}`;
const uuid=(value:unknown)=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);
const typeLabels:Record<string,string>={character:'Character',location:'Location',bestiary:'Bestiary',faction:'Faction',lore:'Lore',glossary:'Glossary',system:'Systems / Magic'};

export function ensureCollections(project:Project):Project{if(project.author.collections)return project;const p=copy(project);p.author.collections=defaultCollections();return p;}
export function collection(project:Project,id:string){return project.author.collections?.items.find(value=>value.id===id);}
export function collectionMemberKey(member:Pick<CollectionMember,'type'|'id'>){return key(member);}

export function resolveCollectionTarget(project:Project,member:Pick<CollectionMember,'type'|'id'|'fallbackLabel'>):ResolvedCollectionMember{
  const fallback=member.fallbackLabel||'Missing item';
  if(member.type==='document'){
    const item=project.manifest.nodes.find(value=>value.id===member.id);
    if(!item)return {...member,fallbackLabel:fallback,label:fallback,typeLabel:'Manuscript',group:'Manuscript',state:'missing',preview:''};
    return {...member,fallbackLabel:fallback,label:item.title,typeLabel:item.kind,group:'Manuscript',state:item.trashed?'trash':'active',preview:plain(project.documents[item.id]||blank()).slice(0,240)};
  }
  if(member.type==='entity'){
    const item=project.author.worldBible?.entities.find(value=>value.id===member.id);
    if(!item)return {...member,fallbackLabel:fallback,label:fallback,typeLabel:'World Bible',group:'World Bible',state:'missing',preview:''};
    const category=customCategory(project,item.type),typeLabel=typeLabels[item.type]||category?.singular||'World Bible Entity';
    return {...member,fallbackLabel:fallback,label:item.name,typeLabel,group:'World Bible',state:item.trashed?'trash':'active',modified:item.modified,preview:plain(item.summary).slice(0,240)};
  }
  if(member.type==='note'){
    const item=project.author.notebook.notes.find(value=>value.id===member.id);
    if(!item)return {...member,fallbackLabel:fallback,label:fallback,typeLabel:'Notebook Note',group:'Notebook',state:'missing',preview:''};
    return {...member,fallbackLabel:fallback,label:item.title,typeLabel:'Notebook Note',group:'Notebook',state:item.trashed?'trash':'active',modified:item.modified,preview:plain(item.body).slice(0,240)};
  }
  const item=project.author.research?.items.find(value=>value.id===member.id);
  if(!item)return {...member,fallbackLabel:fallback,label:fallback,typeLabel:'Research',group:'Research',state:'missing',preview:''};
  const subtype=item.type==='web'?'Web':item.type==='image'?'Image':item.type==='text'?'Text':item.type==='pdf'?'PDF':'File';
  return {...member,fallbackLabel:fallback,label:item.title,typeLabel:`Research · ${subtype}`,group:'Research',state:item.trashed?'trash':'active',modified:item.modified,preview:plain(item.notes).slice(0,240)};
}

export function collectionCandidates(project:Project):ResolvedCollectionMember[]{
  const documents=project.manifest.nodes.filter(value=>!value.trashed&&['Chapter','Scene'].includes(value.kind)).map(value=>resolveCollectionTarget(project,{type:'document',id:value.id,fallbackLabel:value.title}));
  const entities=(project.author.worldBible?.entities||[]).filter(value=>!value.trashed).map(value=>resolveCollectionTarget(project,{type:'entity',id:value.id,fallbackLabel:value.name}));
  const notes=project.author.notebook.notes.filter(value=>!value.trashed).map(value=>resolveCollectionTarget(project,{type:'note',id:value.id,fallbackLabel:value.title}));
  const research=(project.author.research?.items||[]).filter(value=>!value.trashed).map(value=>resolveCollectionTarget(project,{type:'research',id:value.id,fallbackLabel:value.title}));
  return [...documents,...entities,...notes,...research];
}

export function createCollection(project:Project,title='Untitled Collection',note:Doc=blank(),members:CollectionMember[]=[]){
  const p=ensureCollections(copy(project)),id=crypto.randomUUID(),created=stamp(),unique=[...new Map(members.map(value=>[key(value),structuredClone(value)])).values()];for(const member of unique)if(resolveCollectionTarget(p,member).state!=='active')throw Error('Only active canonical items can be added to a Collection.');
  p.author.collections!.items.push({id,kind:'manual',title:title.trim()||'Untitled Collection',note:structuredClone(note),favorite:false,members:unique,presentation:{groupByType:false,sort:'manual'},created,modified:created});return {project:p,id};
}
export function updateCollection(project:Project,id:string,values:Partial<Pick<Collection,'title'|'note'|'favorite'|'presentation'>>){const p=ensureCollections(copy(project)),item=collection(p,id);if(!item)throw Error('Collection is missing.');if(values.title!==undefined)values.title=values.title.trim()||'Untitled Collection';Object.assign(item,structuredClone(values),{modified:stamp()});return p;}
export function addCollectionMembers(project:Project,id:string,members:Pick<CollectionMember,'type'|'id'>[]){const p=ensureCollections(copy(project)),item=collection(p,id);if(!item||item.trashed)throw Error('Choose an active Collection.');const existing=new Set(item.members.map(key));for(const candidate of members){const resolved=resolveCollectionTarget(p,{...candidate,fallbackLabel:''});if(resolved.state!=='active')throw Error('Only active canonical items can be added to a Collection.');const member={type:candidate.type,id:candidate.id,fallbackLabel:resolved.label};if(!existing.has(key(member))){item.members.push(member);existing.add(key(member));}}item.modified=stamp();return p;}
export function removeCollectionMembers(project:Project,id:string,keys:string[]){const p=ensureCollections(copy(project)),item=collection(p,id);if(!item)throw Error('Collection is missing.');const removed=new Set(keys);item.members=item.members.filter(value=>!removed.has(key(value)));item.modified=stamp();return p;}
export function reorderCollectionMember(project:Project,id:string,memberKey:string,direction:-1|1){const p=ensureCollections(copy(project)),item=collection(p,id);if(!item)throw Error('Collection is missing.');const at=item.members.findIndex(value=>key(value)===memberKey),to=at+direction;if(at<0||to<0||to>=item.members.length)return p;[item.members[at],item.members[to]]=[item.members[to],item.members[at]];item.modified=stamp();return p;}
export function placeCollectionMember(project:Project,id:string,memberKey:string,targetKey:string,placement:'before'|'after'){const source=collection(project,id);if(!source)throw Error('Collection is missing.');const from=source.members.findIndex(value=>key(value)===memberKey),targetBefore=source.members.findIndex(value=>key(value)===targetKey);if(from<0||targetBefore<0||memberKey===targetKey)return project;const insertionBefore=targetBefore+(placement==='after'?1:0),normalized=insertionBefore>from?insertionBefore-1:insertionBefore;if(normalized===from)return project;const p=ensureCollections(copy(project)),item=collection(p,id)!;const [moving]=item.members.splice(from,1);item.members.splice(normalized,0,moving);item.modified=stamp();return p;}
export function trashCollection(project:Project,id:string,trashed=true){const p=ensureCollections(copy(project)),item=collection(p,id);if(!item)throw Error('Collection is missing.');item.trashed=trashed||undefined;item.modified=stamp();return p;}
export function deleteCollection(project:Project,id:string){const p=ensureCollections(copy(project)),item=collection(p,id);if(!item?.trashed)throw Error('Only a Collection in Trash can be deleted permanently.');p.author.collections!.items=p.author.collections!.items.filter(value=>value.id!==id);return p;}
export function visibleCollectionMembers(project:Project,id:string,query='',type='all',state='all'){
  const item=collection(project,id);if(!item)return [];
  const needle=query.trim().toLocaleLowerCase();let values=item.members.map(member=>resolveCollectionTarget(project,member)).filter(value=>(type==='all'||value.group===type)&&(state==='all'||value.state===state)&&(!needle||`${value.label} ${value.typeLabel} ${value.preview}`.toLocaleLowerCase().includes(needle)));
  if(item.presentation.sort==='az')values.sort((a,b)=>a.label.localeCompare(b.label));else if(item.presentation.sort==='za')values.sort((a,b)=>b.label.localeCompare(a.label));else if(item.presentation.sort==='type')values.sort((a,b)=>a.typeLabel.localeCompare(b.typeLabel)||a.label.localeCompare(b.label));else if(item.presentation.sort==='modified')values.sort((a,b)=>(b.modified||'').localeCompare(a.modified||''));return values;
}

function checkDoc(doc:Doc){const allowed=new Set(['doc','paragraph','text','heading','blockquote','bulletList','orderedList','listItem','taskList','taskItem','codeBlock','hardBreak','horizontalRule']);const walk=(value:Doc,depth:number)=>{if(depth>100||!allowed.has(value.type)||(value.text!==undefined&&typeof value.text!=='string'))throw Error('Unsupported Collection Note content.');value.content?.forEach(child=>walk(child,depth+1));};walk(doc,0);}
export function validateCollections(state:CollectionsState|undefined,reservedIds:Set<string>){if(state===undefined)return;if(state.version!==1||!Array.isArray(state.items))throw Error('Unsupported or damaged Collections data.');const ids=new Set<string>();for(const item of state.items){if(!uuid(item.id)||ids.has(item.id)||reservedIds.has(item.id)||item.kind!=='manual'||typeof item.title!=='string'||!item.title.trim()||typeof item.favorite!=='boolean'||!Array.isArray(item.members)||!item.presentation||typeof item.presentation.groupByType!=='boolean'||!['manual','az','za','type','modified'].includes(item.presentation.sort)||typeof item.created!=='string'||typeof item.modified!=='string'||(item.trashed!==undefined&&typeof item.trashed!=='boolean'))throw Error('Invalid Collection.');ids.add(item.id);checkDoc(item.note);const members=new Set<string>();for(const member of item.members){if(!['document','entity','note','research'].includes(member.type)||!uuid(member.id)||typeof member.fallbackLabel!=='string'||members.has(key(member)))throw Error('Invalid Collection membership.');members.add(key(member));}}}
