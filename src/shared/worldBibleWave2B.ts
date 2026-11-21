import type {Doc,Project} from './model.js';
import {
  BESTIARY_TEMPLATE_IDS,DEFAULT_TEMPLATE_BY_TYPE,FACTION_TEMPLATE_IDS,GLOSSARY_TEMPLATE_IDS,LOCATION_TEMPLATE_IDS,LORE_TEMPLATE_IDS,SYSTEM_TEMPLATE_IDS,
  categoryView,entity,ensureWorldBible,manuscriptOccurrences,plainDoc,relationshipViews,worldBibleOccurrences,
  type EntitySighting,type EntityStoryLink,type EntityTypeId,type KnowledgeEntity,
} from './worldBible.js';

const copy=(project:Project)=>ensureWorldBible(project);
const stamp=()=>new Date().toISOString();

export const WAVE2B_TYPES=['location','bestiary','faction'] as const;
export type Wave2BType=typeof WAVE2B_TYPES[number];
export const WORLD_BIBLE_ENTITY_TYPES=['location','bestiary','faction','lore','glossary','system'] as const;
export type BuiltInEntityType=typeof WORLD_BIBLE_ENTITY_TYPES[number];
export const ENTITY_LABELS:Record<BuiltInEntityType,{singular:string;plural:string;untitled:string;description:string}>={
  location:{singular:'Location',plural:'Locations',untitled:'Untitled Location',description:'Places, settings, regions, and the geography between them.'},
  bestiary:{singular:'Creature',plural:'Bestiary',untitled:'Untitled Creature',description:'Species, creature types, and unique beings.'},
  faction:{singular:'Faction',plural:'Factions',untitled:'Untitled Faction',description:'Groups, orders, houses, governments, and societies.'},
  lore:{singular:'Lore Entry',plural:'Lore',untitled:'Untitled Lore',description:'History, cultures, beliefs, events, and canonical world knowledge.'},
  glossary:{singular:'Glossary Term',plural:'Glossary',untitled:'Untitled Term',description:'Terms, names, phrases, titles, and in-world vocabulary.'},
  system:{singular:'System',plural:'Systems / Magic',untitled:'Untitled System',description:'Rules, powers, technologies, institutions, and other structured systems.'},
};
export const DEFAULT_TEMPLATES={location:LOCATION_TEMPLATE_IDS.settlement,bestiary:BESTIARY_TEMPLATE_IDS.basic,faction:FACTION_TEMPLATE_IDS.general,lore:LORE_TEMPLATE_IDS.general,glossary:GLOSSARY_TEMPLATE_IDS.general,system:SYSTEM_TEMPLATE_IDS.general} as const;
export const GLOSSARY_BUCKETS=[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ','0–9','#'] as const;
export function glossaryBucket(name:string){const raw=name.trim().normalize('NFKD').charAt(0).toLocaleUpperCase(),first=({'Æ':'A','Œ':'O','Ø':'O','Ł':'L','Ð':'D','Þ':'T'} as Record<string,string>)[raw]||raw;return /^[A-Z]$/u.test(first)?first:/^[0-9]$/u.test(first)?'0–9':'#';}
export function glossaryGroups(values:KnowledgeEntity[]){const collator=new Intl.Collator(undefined,{sensitivity:'base',numeric:true});const sorted=[...values].sort((a,b)=>collator.compare(a.name,b.name)||a.created.localeCompare(b.created));return GLOSSARY_BUCKETS.map(bucket=>({bucket,values:sorted.filter(item=>glossaryBucket(item.name)===bucket)}));}

export function entitySearch(project:Project,type:EntityTypeId,query:string,includeTrash=false){
  const q=query.trim().toLocaleLowerCase();
  return project.author.worldBible!.entities.filter(item=>item.type===type&&!!item.trashed===includeTrash).filter(item=>{
    if(!q)return true;
    const values=item.fieldIds.flatMap(id=>{const value=item.fieldValues[id];return Array.isArray(value)?value:[value];}).filter(value=>typeof value==='string');
    return [item.name,...item.aliases,...item.tags,plainDoc(item.summary),plainDoc(item.biography),item.body?plainDoc(item.body):'',...values].some(value=>String(value).toLocaleLowerCase().includes(q));
  });
}

export function locationChildren(project:Project,parentId?:string,includeTrash=false){
  return project.author.worldBible!.entities.filter(item=>item.type==='location'&&item.parentLocationId===parentId&&!!item.trashed===includeTrash);
}
export function locationDescendantIds(project:Project,id:string){
  const result=new Set<string>();let changed=true;
  while(changed){changed=false;for(const item of project.author.worldBible!.entities)if(item.type==='location'&&item.parentLocationId&&(item.parentLocationId===id||result.has(item.parentLocationId))&&!result.has(item.id)){result.add(item.id);changed=true;}}
  return result;
}
export function locationAncestors(project:Project,id:string){
  const values:KnowledgeEntity[]=[];let current=entity(project,id),guard=0;
  while(current?.parentLocationId&&guard++<project.author.worldBible!.entities.length){const parent=entity(project,current.parentLocationId);if(!parent||parent.type!=='location')break;values.unshift(parent);current=parent;}
  return values;
}
export function validLocationParents(project:Project,id:string){const excluded=locationDescendantIds(project,id);excluded.add(id);return project.author.worldBible!.entities.filter(item=>item.type==='location'&&!item.trashed&&!excluded.has(item.id));}
export function moveLocation(project:Project,id:string,parentLocationId?:string){
  const p=copy(project),item=entity(p,id);if(!item||item.type!=='location')throw Error('Location is missing.');if(item.layoutLocked)throw Error('Layout Lock is enabled for this Location.');
  if(parentLocationId){const parent=entity(p,parentLocationId);if(!parent||parent.type!=='location'||parent.trashed)throw Error('Choose an active parent Location.');if(parent.id===id||locationDescendantIds(p,id).has(parent.id))throw Error('A Location cannot be placed inside itself or one of its descendants.');}
  item.parentLocationId=parentLocationId||undefined;item.modified=stamp();return p;
}

export type LocationTrashMode='subtree'|'unassigned'|'reparent';
export function trashLocation(project:Project,id:string,mode:LocationTrashMode='subtree',destinationId?:string){
  const p=copy(project),item=entity(p,id);if(!item||item.type!=='location')throw Error('Location is missing.');const children=locationChildren(p,id);
  if(mode==='reparent'){if(!destinationId)throw Error('Choose a destination for child Locations.');if(locationDescendantIds(p,id).has(destinationId)||destinationId===id)throw Error('Children cannot be moved into this Location subtree.');const destination=entity(p,destinationId);if(!destination||destination.type!=='location'||destination.trashed)throw Error('Choose an active destination Location.');for(const child of children)child.parentLocationId=destinationId;}
  if(mode==='unassigned')for(const child of children)child.parentLocationId=undefined;
  const affected=mode==='subtree'?new Set([id,...locationDescendantIds(p,id)]):new Set([id]);for(const target of p.author.worldBible!.entities)if(affected.has(target.id)){target.trashed=true;target.modified=stamp();}
  return p;
}
export function restoreLocation(project:Project,id:string){
  const p=copy(project),item=entity(p,id);if(!item||item.type!=='location')throw Error('Location is missing.');const restored=new Set([id,...locationDescendantIds(p,id)]);
  if(item.parentLocationId){const parent=entity(p,item.parentLocationId);if(!parent||parent.trashed&&!restored.has(parent.id))item.parentLocationId=undefined;}
  for(const target of p.author.worldBible!.entities)if(restored.has(target.id)){target.trashed=undefined;target.modified=stamp();}return p;
}
export function deleteEntitySafely(project:Project,id:string){const p=copy(project);const world=p.author.worldBible!,at=world.entities.findIndex(item=>item.id===id);if(at<0)throw Error('Entity is missing.');world.entities.splice(at,1);for(const item of world.entities)if(item.parentLocationId===id)item.parentLocationId=undefined;world.relationships=world.relationships.filter(value=>value.sourceId!==id&&!(value.target.kind==='entity'&&value.target.id===id));world.recentEntityIds=world.recentEntityIds.filter(value=>value!==id);return p;}

export function duplicateProfile(project:Project,id:string){
  const p=copy(project),source=entity(p,id);if(!source)throw Error('Entity is missing.');const next=structuredClone(source),created=stamp(),newId=crypto.randomUUID();
  const media=source.media.map(value=>({...value,id:crypto.randomUUID()})),primaryIndex=source.media.findIndex(value=>value.id===source.primaryMediaId);
  Object.assign(next,{id:newId,name:`${source.name} Copy`,created,modified:created,trashed:undefined,storyTreeShortcut:undefined,sightings:[],storyLinks:[],media,primaryMediaId:primaryIndex>=0?media[primaryIndex].id:undefined});
  p.author.worldBible!.entities.push(next);p.author.worldBible!.recentEntityIds=[newId,...p.author.worldBible!.recentEntityIds.filter(value=>value!==newId)].slice(0,12);return {project:p,id:newId};
}
export function resetEntityProfile(project:Project,id:string,templateId=DEFAULT_TEMPLATE_BY_TYPE[entity(project,id)?.type||'']||''){
  const p=copy(project),item=entity(p,id),template=p.author.worldBible!.templates.find(value=>value.id===templateId&&value.entityType===item?.type);if(!item||!template||item.type==='character')throw Error('Entity or template is missing.');
  const preserve={id:item.id,type:item.type,name:item.name,created:item.created,favorite:item.favorite,trashed:item.trashed,parentLocationId:item.parentLocationId,recordType:item.recordType,sightings:item.sightings||[],storyLinks:item.storyLinks||[]};
  Object.assign(item,{...preserve,templateId:template.id,aliases:[],summary:{type:'doc',content:[{type:'paragraph'}]},biography:{type:'doc',content:[{type:'paragraph'}]},body:['lore','glossary','system'].includes(item.type)?{type:'doc',content:[{type:'paragraph'}]}:undefined,research:item.type==='bestiary'?{type:'doc',content:[{type:'paragraph'}]}:undefined,tags:[],modified:stamp(),fieldIds:[...template.fieldIds],fieldValues:{},hiddenFieldIds:[],notes:[],media:[],primaryMediaId:undefined,layoutLocked:false,contentProtected:false});return p;
}

export function addSighting(project:Project,entityId:string,values:Pick<EntitySighting,'locationId'|'documentId'|'note'>){
  const p=copy(project),item=entity(p,entityId);if(!item||item.type!=='bestiary')throw Error('Creature is missing.');if(item.contentProtected)throw Error('Content Protection is enabled for this Creature.');
  const note=values.note?.trim()||undefined;if(!values.locationId&&!values.documentId&&!note)throw Error('Add a Location, manuscript item, or note to record a Sighting.');if(values.locationId){const location=entity(p,values.locationId);if(!location||location.type!=='location'||location.trashed)throw Error('Choose an active Location.');}if(values.documentId&&!p.manifest.nodes.some(node=>node.id===values.documentId&&!node.trashed))throw Error('Choose an active Chapter or Scene.');
  const created=stamp(),id=crypto.randomUUID();(item.sightings||=[]).push({id,locationId:values.locationId||undefined,documentId:values.documentId||undefined,note,created,modified:created});item.modified=created;return {project:p,id};
}
export function removeSighting(project:Project,entityId:string,id:string){const p=copy(project),item=entity(p,entityId);if(!item||item.type!=='bestiary')throw Error('Creature is missing.');item.sightings=(item.sightings||[]).filter(value=>value.id!==id);item.modified=stamp();return p;}
export function addStoryLink(project:Project,entityId:string,documentId:string,label=''){
  const p=copy(project),item=entity(p,entityId),node=p.manifest.nodes.find(value=>value.id===documentId&&!value.trashed);if(!item||!node)throw Error('Entity or manuscript item is missing.');if(item.contentProtected)throw Error('Content Protection is enabled for this entity.');const created=stamp(),id=crypto.randomUUID();(item.storyLinks||=[]).push({id,documentId,label:label.trim()||node.title,created});item.modified=created;return {project:p,id};
}
export function removeStoryLink(project:Project,entityId:string,id:string){const p=copy(project),item=entity(p,entityId);if(!item)throw Error('Entity is missing.');item.storyLinks=(item.storyLinks||[]).filter(value=>value.id!==id);item.modified=stamp();return p;}

export function primaryLocationUsage(project:Project,locationId:string){return project.manifest.nodes.filter(node=>!node.trashed&&project.author.metadata[node.id]?.primaryLocationId===locationId);}
export function relatedEntities(project:Project,id:string,type?:EntityTypeId){const seen=new Set<string>();return relationshipViews(project,id).map(view=>view.target.kind==='entity'?entity(project,view.target.id):undefined).filter((value):value is KnowledgeEntity=>!!value&&!value.trashed&&(!type||value.type===type)&&!seen.has(value.id)&&!!seen.add(value.id));}
export function factionMemberViews(project:Project,id:string){return relationshipViews(project,id).filter(view=>{const target=view.target.kind==='entity'?entity(project,view.target.id):undefined;return target?.type==='character'&&(/member|leader|commander|founder|agent|council|apprentice/i.test(view.label)||/member|leadership/i.test(view.record.group));});}
export function factionMemberCount(project:Project,id:string){return new Set(factionMemberViews(project,id).map(view=>view.target.kind==='entity'?view.target.id:'')).size;}
export function factionLocationValue(project:Project,item:KnowledgeEntity){const fields=project.author.worldBible!.fields;for(const label of ['Territory','Headquarters','Seat','Base']){const field=fields.find(value=>value.entityType==='faction'&&value.label===label),raw=field&&item.fieldValues[field.id];if(typeof raw==='string'&&raw){const linked=entity(project,raw);return linked?.name||raw;}}const linked=relatedEntities(project,item.id,'location')[0];return linked?.name||'';}
export function categorySecondary(project:Project,item:KnowledgeEntity){const view=categoryView(project,item.type);if(view.secondaryField==='summary')return plainDoc(item.summary);if(view.secondaryField==='body')return excerpt(item.body);if(view.secondaryField==='memberCount')return `${factionMemberCount(project,item.id)} members`;const field=project.author.worldBible!.fields.find(value=>value.id===view.secondaryField),raw=item.fieldValues[view.secondaryField];const text=Array.isArray(raw)?raw.join(', '):typeof raw==='string'&&field?.kind==='entityReference'?(entity(project,raw)?.name||'Missing entity'):String(raw??'');return item.type==='bestiary'&&!text?plainDoc(item.summary):text;}
export function excerpt(value:Doc|undefined,limit=180){const text=value?plainDoc(value).replace(/\s+/gu,' ').trim():'';return text.length>limit?`${text.slice(0,Math.max(0,limit-1)).trimEnd()}…`:text;}
export function hasExplicitManuscriptReferences(project:Project,id:string){return manuscriptOccurrences(project,id).length>0||worldBibleOccurrences(project,id).length>0;}
