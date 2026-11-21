import {randomUUID} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import {blank,blankMetadata,defaultAuthor,validate,type Project} from '../src/shared/model';
import {
  BESTIARY_TEMPLATE_IDS,FACTION_TEMPLATE_IDS,LOCATION_TEMPLATE_IDS,
  addMedia,assignField,categoryView,createEntity,createField,createRelationship,deleteField,deleteRelationshipType,ensureWorldBible,entity,manuscriptOccurrences,moveEntityField,moveMedia,reorderEntityField,reorderMedia,setEntityLocks,setFieldValue,trashEntity,updateCategoryView,updateEntity,
} from '../src/shared/worldBible';
import {
  addSighting,addStoryLink,deleteEntitySafely,duplicateProfile,entitySearch,factionLocationValue,factionMemberCount,
  locationAncestors,locationChildren,moveLocation,primaryLocationUsage,relatedEntities,removeSighting,removeStoryLink,
  resetEntityProfile,restoreLocation,trashLocation,validLocationParents,
} from '../src/shared/worldBibleWave2B';

function fixture():Project{
  const chapter=randomUUID(),scene=randomUUID();
  return {manifest:{version:1,id:randomUUID(),title:'Wave 2B',revision:0,nodes:[{id:chapter,parent:null,title:'Chapter 1',kind:'Chapter'},{id:scene,parent:chapter,title:'Scene 1',kind:'Scene'}],settings:{editor:{},publication:{},workspace:{}}},documents:{[chapter]:blank(),[scene]:blank()},author:defaultAuthor(),recovery:[]};
}

describe('World Bible Wave 2B domain',()=>{
  it('upgrades an accepted Wave 2A catalog in memory once without resurrecting deliberately deleted definitions',()=>{
    const old=fixture(),world=old.author.worldBible!,characterField=world.fields.find(value=>value.entityType==='character')!,characterRelationship=world.relationshipTypes.find(value=>value.name==='Friend')!;
    delete world.catalogVersion;
    world.enabledCategories=['character','location'];
    world.fields=world.fields.filter(value=>value.id!==characterField.id&&value.entityType==='character');
    world.templates=world.templates.filter(value=>value.entityType==='character');
    world.relationshipTypes=world.relationshipTypes.filter(value=>value.id!==characterRelationship.id&&!value.sourceTypes&&!value.targetTypes);
    world.categoryViews={character:world.categoryViews.character};
    const upgraded=ensureWorldBible(old),catalog=upgraded.author.worldBible!;
    expect(catalog.catalogVersion).toBe(4);
    expect(catalog.enabledCategories).toEqual(expect.arrayContaining(['location','bestiary','faction','lore','glossary','system']));
    expect(catalog.templates.some(value=>value.id===LOCATION_TEMPLATE_IDS.settlement)).toBe(true);
    expect(catalog.fields.some(value=>value.id===characterField.id)).toBe(false);
    expect(catalog.relationshipTypes.some(value=>value.id===characterRelationship.id)).toBe(false);
    const locationField=catalog.fields.find(value=>value.entityType==='location')!,wave2BRelationship=catalog.relationshipTypes.find(value=>value.sourceTypes||value.targetTypes)!;
    const customized=deleteRelationshipType(deleteField(upgraded,locationField.id),wave2BRelationship.id);
    const ensuredAgain=ensureWorldBible(customized).author.worldBible!;
    expect(ensuredAgain.fields.some(value=>value.id===locationField.id)).toBe(false);
    expect(ensuredAgain.relationshipTypes.some(value=>value.id===wave2BRelationship.id)).toBe(false);
  });

  it('creates all accepted built-in templates and valid records without touching Character defaults',()=>{
    let p=fixture();const location=createEntity(p,'location','Harbor',LOCATION_TEMPLATE_IDS.settlement);p=location.project;const beast=createEntity(p,'bestiary','Glass Wolf',BESTIARY_TEMPLATE_IDS.detailed);p=beast.project;const faction=createEntity(p,'faction','Lantern Guild',FACTION_TEMPLATE_IDS.guild);p=faction.project;
    expect(entity(p,location.id)).toMatchObject({name:'Harbor',type:'location'});expect(entity(p,beast.id)).toMatchObject({recordType:'Species',type:'bestiary'});expect(entity(p,faction.id)).toMatchObject({type:'faction'});validate(p);
  });

  it('moves Locations through a deep hierarchy and rejects self and descendant cycles',()=>{
    let p=fixture();const region=createEntity(p,'location','North');const town=createEntity(region.project,'location','Mere');const inn=createEntity(town.project,'location','The Bell');p=moveLocation(inn.project,town.id,region.id);p=moveLocation(p,inn.id,town.id);
    expect(locationAncestors(p,inn.id).map(value=>value.name)).toEqual(['North','Mere']);expect(locationChildren(p,town.id).map(value=>value.id)).toEqual([inn.id]);expect(validLocationParents(p,region.id).map(value=>value.id)).not.toContain(inn.id);expect(()=>moveLocation(p,region.id,inn.id)).toThrow('descendants');expect(()=>moveLocation(p,town.id,town.id)).toThrow('itself');validate(p);
  });

  it('allows Untitled and duplicate Location names while stable IDs and parent context disambiguate them',()=>{
    let p=fixture();const north=createEntity(p,'location','North'),south=createEntity(north.project,'location','South'),first=createEntity(south.project,'location','Riverside'),second=createEntity(first.project,'location','Riverside'),untitled=createEntity(second.project,'location','');p=moveLocation(untitled.project,first.id,north.id);p=moveLocation(p,second.id,south.id);expect(entity(p,untitled.id)?.name).toBe('Untitled Location');expect(first.id).not.toBe(second.id);expect(locationAncestors(p,first.id)[0].name).toBe('North');expect(locationAncestors(p,second.id)[0].name).toBe('South');validate(p);
  });

  it('moves a Location back to the Unassigned system view and persists hierarchy after JSON reopen',()=>{
    let p=fixture();const a=createEntity(p,'location','A'),b=createEntity(a.project,'location','B');p=moveLocation(b.project,b.id,a.id);p=moveLocation(p,b.id);const reopened=JSON.parse(JSON.stringify(p)) as Project;validate(reopened);expect(entity(reopened,b.id)?.parentLocationId).toBeUndefined();expect(locationChildren(reopened).map(value=>value.id)).toEqual([a.id,b.id]);
  });

  it('trashes a whole Location subtree and restores stable identities and hierarchy',()=>{
    let p=fixture();const a=createEntity(p,'location','A'),b=createEntity(a.project,'location','B'),c=createEntity(b.project,'location','C');p=moveLocation(c.project,b.id,a.id);p=moveLocation(p,c.id,b.id);p=trashLocation(p,a.id,'subtree');expect([a.id,b.id,c.id].every(id=>entity(p,id)?.trashed)).toBe(true);p=restoreLocation(p,a.id);expect([a.id,b.id,c.id].every(id=>!entity(p,id)?.trashed)).toBe(true);expect(entity(p,c.id)?.parentLocationId).toBe(b.id);validate(p);
  });

  it('supports explicit child handling when trashing a parent without accidental cascade',()=>{
    let p=fixture();const parent=createEntity(p,'location','Parent'),child=createEntity(parent.project,'location','Child'),other=createEntity(child.project,'location','Other');p=moveLocation(other.project,child.id,parent.id);p=trashLocation(p,parent.id,'unassigned');expect(entity(p,parent.id)?.trashed).toBe(true);expect(entity(p,child.id)?.trashed).toBeFalsy();expect(entity(p,child.id)?.parentLocationId).toBeUndefined();p=restoreLocation(p,parent.id);p=moveLocation(p,child.id,parent.id);p=trashLocation(p,parent.id,'reparent',other.id);expect(entity(p,child.id)?.parentLocationId).toBe(other.id);validate(p);
  });

  it('permanently deletes an entity conservatively while preserving visible manuscript prose',()=>{
    let p=fixture();const place=createEntity(p,'location','Old City'),child=createEntity(place.project,'location','Gate');p=moveLocation(child.project,child.id,place.id);const chapter=p.manifest.nodes[0].id,occurrenceId=randomUUID();p.documents[chapter]={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'the old city',marks:[{type:'entityReference',attrs:{targetId:place.id,occurrenceId}}]}]}]};p=deleteEntitySafely(p,place.id);expect(entity(p,place.id)).toBeUndefined();expect(entity(p,child.id)?.parentLocationId).toBeUndefined();expect(manuscriptOccurrences(p,place.id)[0].visibleText).toBe('the old city');validate(p);
  });

  it('records Sightings only through an explicit action and never derives them from prose or relationships',()=>{
    let p=fixture();const beast=createEntity(p,'bestiary','Moth'),place=createEntity(beast.project,'location','Fen');p=place.project;const relation=p.author.worldBible!.relationshipTypes.find(value=>value.name==='Known at')!;p=createRelationship(p,beast.id,{kind:'entity',id:place.id},relation.id).project;expect(entity(p,beast.id)?.sightings).toEqual([]);const made=addSighting(p,beast.id,{locationId:place.id,documentId:p.manifest.nodes[1].id,note:'Seen at dusk'});p=made.project;expect(entity(p,beast.id)?.sightings).toHaveLength(1);p=removeSighting(p,beast.id,made.id);expect(entity(p,beast.id)?.sightings).toEqual([]);expect(()=>addSighting(p,beast.id,{})).toThrow('record a Sighting');validate(p);
  });

  it('keeps broad Story Links separate from exact manuscript References',()=>{
    let p=fixture();const beast=createEntity(p,'bestiary','Moth');p=beast.project;const chapter=p.manifest.nodes[0].id,made=addStoryLink(p,beast.id,chapter,'Rumored here');p=made.project;expect(entity(p,beast.id)?.storyLinks?.[0]).toMatchObject({documentId:chapter,label:'Rumored here'});expect(manuscriptOccurrences(p,beast.id)).toEqual([]);p=removeStoryLink(p,beast.id,made.id);expect(entity(p,beast.id)?.storyLinks).toEqual([]);validate(p);
  });

  it('derives faction membership and leadership exclusively from explicit relationships',()=>{
    let p=fixture();const faction=createEntity(p,'faction','Guild'),member=createEntity(faction.project,'character','Mina');p=member.project;expect(factionMemberCount(p,faction.id)).toBe(0);const memberType=p.author.worldBible!.relationshipTypes.find(value=>value.name==='Member of')!;p=createRelationship(p,member.id,{kind:'entity',id:faction.id},memberType.id).project;expect(factionMemberCount(p,faction.id)).toBe(1);const leader=createEntity(p,'character','Ivo');p=leader.project;const leaderType=p.author.worldBible!.relationshipTypes.find(value=>value.name==='Leader of')!;p=createRelationship(p,leader.id,{kind:'entity',id:faction.id},leaderType.id).project;expect(factionMemberCount(p,faction.id)).toBe(2);validate(p);
  });

  it('derives cross-type related previews only from explicit relationships',()=>{
    let p=fixture();const location=createEntity(p,'location','Keep'),faction=createEntity(location.project,'faction','Guard');p=faction.project;expect(relatedEntities(p,location.id,'faction')).toEqual([]);const type=p.author.worldBible!.relationshipTypes.find(value=>value.name==='Based in')!;p=createRelationship(p,faction.id,{kind:'entity',id:location.id},type.id).project;expect(relatedEntities(p,location.id,'faction').map(value=>value.id)).toEqual([faction.id]);expect(factionLocationValue(p,entity(p,faction.id)!)).toBe('Keep');
  });

  it('keeps spatial relationships separate from canonical Location parentage',()=>{
    let p=fixture();const region=createEntity(p,'location','Region'),east=createEntity(region.project,'location','East Gate'),west=createEntity(east.project,'location','West Gate');p=moveLocation(west.project,east.id,region.id);const near=p.author.worldBible!.relationshipTypes.find(value=>value.name==='Near')!;p=createRelationship(p,east.id,{kind:'entity',id:west.id},near.id).project;expect(entity(p,east.id)?.parentLocationId).toBe(region.id);expect(entity(p,west.id)?.parentLocationId).toBeUndefined();expect(relatedEntities(p,east.id,'location').map(value=>value.id)).toEqual([west.id]);
  });

  it('stores explicit Primary Location metadata without altering prose or creating references',()=>{
    const p=fixture(),made=createEntity(p,'location','Keep');p.author.metadata[p.manifest.nodes[0].id]={...blankMetadata(),primaryLocationId:made.id};expect(primaryLocationUsage(p,made.id).map(value=>value.id)).toEqual([p.manifest.nodes[0].id]);expect(manuscriptOccurrences(p,made.id)).toEqual([]);validate(p);
  });

  it('duplicates a profile under a new ID without copying relationships, Sightings, or Story Links',()=>{
    let p=fixture();const beast=createEntity(p,'bestiary','Wolf');p=updateEntity(beast.project,beast.id,{aliases:['Grey'],tags:['wild']});p=addSighting(p,beast.id,{note:'Tracks'}).project;p=addStoryLink(p,beast.id,p.manifest.nodes[0].id).project;const copy=duplicateProfile(p,beast.id),item=entity(copy.project,copy.id)!;expect(copy.id).not.toBe(beast.id);expect(item).toMatchObject({name:'Wolf Copy',aliases:['Grey'],tags:['wild'],sightings:[],storyLinks:[]});validate(copy.project);
  });

  it('duplicates a Location as a sibling without copying children, usage, References, or relationships',()=>{
    let p=fixture();const parent=createEntity(p,'location','Region'),place=createEntity(parent.project,'location','Riverside'),child=createEntity(place.project,'location','Inn');p=moveLocation(child.project,place.id,parent.id);p=moveLocation(p,child.id,place.id);p.author.metadata[p.manifest.nodes[0].id]={...blankMetadata(),primaryLocationId:place.id};const copy=duplicateProfile(p,place.id),item=entity(copy.project,copy.id)!;expect(item.parentLocationId).toBe(parent.id);expect(locationChildren(copy.project,copy.id)).toEqual([]);expect(primaryLocationUsage(copy.project,copy.id)).toEqual([]);expect(manuscriptOccurrences(copy.project,copy.id)).toEqual([]);expect(copy.project.author.worldBible!.relationships.some(value=>value.sourceId===copy.id||(value.target.kind==='entity'&&value.target.id===copy.id))).toBe(false);
  });

  it('resets profile content while preserving identity, hierarchy, manual links, relationships and external metadata',()=>{
    let p=fixture();const parent=createEntity(p,'location','World'),place=createEntity(parent.project,'location','City');p=moveLocation(place.project,place.id,parent.id);p=updateEntity(p,place.id,{aliases:['Capital'],tags:['urban']});const chapter=p.manifest.nodes[0].id;p.author.metadata[chapter]={...blankMetadata(),primaryLocationId:place.id};p=resetEntityProfile(p,place.id);expect(entity(p,place.id)).toMatchObject({id:place.id,name:'City',parentLocationId:parent.id,aliases:[],tags:[]});expect(primaryLocationUsage(p,place.id)).toHaveLength(1);validate(p);
  });

  it('resets a Creature profile without erasing manual Sightings or Story Links',()=>{
    let p=fixture();const beast=createEntity(p,'bestiary','Drake');p=updateEntity(beast.project,beast.id,{tags:['profile'],summary:{type:'doc',text:'Reset me'}});p=addSighting(p,beast.id,{note:'Observed'}).project;p=addStoryLink(p,beast.id,p.manifest.nodes[0].id,'Appears').project;p=resetEntityProfile(p,beast.id);expect(entity(p,beast.id)).toMatchObject({name:'Drake',tags:[]});expect(entity(p,beast.id)?.sightings?.map(value=>value.note)).toEqual(['Observed']);expect(entity(p,beast.id)?.storyLinks?.map(value=>value.label)).toEqual(['Appears']);
  });

  it('enforces Content Protection for ordinary profile edits and Layout Lock for hierarchy moves',()=>{
    let p=fixture();const a=createEntity(p,'location','A'),b=createEntity(a.project,'location','B');p=setEntityLocks(b.project,b.id,{layoutLocked:true,contentProtected:false});expect(()=>moveLocation(p,b.id,a.id)).toThrow('Layout Lock');p=setEntityLocks(p,b.id,{layoutLocked:false,contentProtected:true});expect(()=>updateEntity(p,b.id,{name:'No'})).toThrow('Content Protection');
  });

  it('persists Bestiary location filters and deterministic Faction Location/Territory sorting preferences',()=>{
    let p=fixture();const location=createEntity(p,'location','Delta');p=location.project;p=updateCategoryView(p,'bestiary',{recordType:'Species',locationId:location.id,fieldFilter:undefined});p=updateCategoryView(p,'faction',{sort:'location',secondaryField:'memberCount'});expect(categoryView(p,'bestiary')).toMatchObject({recordType:'Species',locationId:location.id});expect(categoryView(p,'faction')).toMatchObject({sort:'location',secondaryField:'memberCount'});validate(JSON.parse(JSON.stringify(p)) as Project);
  });

  it('searches category-specific identity, text and custom field values without creating links',()=>{
    let p=fixture();const beast=createEntity(p,'bestiary','Glass Wolf');p=updateEntity(beast.project,beast.id,{aliases:['Sharder'],tags:['high threat'],summary:{type:'doc',text:'Moonlit predator'}});const classification=p.author.worldBible!.fields.find(value=>value.entityType==='bestiary'&&value.label==='Classification')!;p=setFieldValue(p,beast.id,classification.id,'Construct');for(const query of ['Glass','Sharder','high threat','Moonlit','Construct'])expect(entitySearch(p,'bestiary',query).map(value=>value.id)).toEqual([beast.id]);expect(manuscriptOccurrences(p,beast.id)).toEqual([]);
  });

  it('keeps all Wave 2B records and configuration in the single author.json model across reopen',()=>{
    let p=fixture();const location=createEntity(p,'location','Cove'),beast=createEntity(location.project,'bestiary','Drake'),faction=createEntity(beast.project,'faction','Watch');p=faction.project;p=addSighting(p,beast.id,{locationId:location.id,note:'Nested above the cove'}).project;p=trashEntity(p,faction.id);const reopened=JSON.parse(JSON.stringify(p)) as Project;validate(reopened);expect(reopened.author.worldBible!.entities.map(value=>value.id)).toEqual([location.id,beast.id,faction.id]);expect(entity(reopened,beast.id)?.sightings).toHaveLength(1);expect(entity(reopened,faction.id)?.trashed).toBe(true);
  });

  it('reorders Wave 2B fields and media through first, middle and final slots with lock and reopen safety',()=>{
    let p=fixture();const made=createEntity(p,'faction','Order',FACTION_TEMPLATE_IDS.guild);p=made.project;
    for(const label of ['Alpha','Beta','Gamma']){const field=createField(p,'faction',label,'text');p=assignField(field.project,made.id,field.id);}
    const fieldIds=entity(p,made.id)!.fieldIds.slice(-3),[first,middle,last]=fieldIds;
    p=moveEntityField(p,made.id,first,last,'after');expect(entity(p,made.id)!.fieldIds.slice(-3)).toEqual([middle,last,first]);
    p=moveEntityField(p,made.id,last,middle,'before');expect(entity(p,made.id)!.fieldIds.slice(-3)).toEqual([last,middle,first]);
    p=moveEntityField(p,made.id,first,middle,'before');expect(entity(p,made.id)!.fieldIds.slice(-3)).toEqual([last,first,middle]);
    const a=addMedia(p,made.id,'assets/world-bible/a.png','A'),b=addMedia(a.project,made.id,'assets/world-bible/b.png','B'),c=addMedia(b.project,made.id,'assets/world-bible/c.png','C');p=c.project;
    p=moveMedia(p,made.id,a.id,c.id,'after');expect(entity(p,made.id)!.media.map(value=>value.id)).toEqual([b.id,c.id,a.id]);
    p=moveMedia(p,made.id,c.id,b.id,'before');expect(entity(p,made.id)!.media.map(value=>value.id)).toEqual([c.id,b.id,a.id]);
    p=moveMedia(p,made.id,a.id,b.id,'before');expect(entity(p,made.id)!.media.map(value=>value.id)).toEqual([c.id,a.id,b.id]);
    p=reorderEntityField(p,made.id,middle,-1);p=reorderMedia(p,made.id,b.id,-1);
    const reopened=JSON.parse(JSON.stringify(p)) as Project;validate(reopened);expect(entity(reopened,made.id)!.fieldIds).toEqual(entity(p,made.id)!.fieldIds);expect(entity(reopened,made.id)!.media).toEqual(entity(p,made.id)!.media);
    p=setEntityLocks(p,made.id,{layoutLocked:true,contentProtected:false});expect(()=>moveEntityField(p,made.id,first,middle,'after')).toThrow('Layout Lock');expect(()=>moveMedia(p,made.id,a.id,b.id,'after')).toThrow('Layout Lock');
  });
});
