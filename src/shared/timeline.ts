import type {Project} from './model.js';
export type TimelineBasis='unset'|'relative'|'gregorian';
export type EventTiming={kind:'undated'}|{kind:'relative';day:number;time?:string}|{kind:'gregorian';year:number;month?:number;day?:number;time?:string};
export type TimelineEvent={id:string;title:string;timing:EventTiming;characterIds:string[];primaryLocationId:string|null;linkedStoryNodeIds:string[];trackIds:string[];notes:string;created:string;modified:string;order:number;beforeId:string|null;trashed?:boolean};
export type TimelineTrack={id:string;name:string;color?:string;order:number};
export type TimelineState={version:1;basis:TimelineBasis;events:TimelineEvent[];tracks:TimelineTrack[]};
export const emptyTimeline=():TimelineState=>({version:1,basis:'unset',events:[],tracks:[]});
export const timeline=(p:Project)=>p.author.timeline??emptyTimeline();
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v);
const now=()=>new Date().toISOString();
const integer=(v:unknown,min:number,max:number)=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
export function validateTiming(t:EventTiming){
 if(!t||!['undated','relative','gregorian'].includes(t.kind))throw Error('Invalid Timeline timing.');
 const allowed=t.kind==='undated'?['kind']:t.kind==='relative'?['kind','day','time']:['kind','year','month','day','time'];
 if(Object.keys(t).some(k=>!allowed.includes(k)))throw Error('Unsupported Timeline timing.');
 if(t.kind==='undated')return;
 if(t.time!==undefined&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(t.time))throw Error('Use a valid 24-hour time.');
 if(t.kind==='relative'){if(!integer(t.day,1,100000000))throw Error('Day must be a positive whole number.');return;}
 if(!integer(t.year,1,9999)||(t.month!==undefined&&!integer(t.month,1,12))||(t.day!==undefined&&(t.month===undefined||!integer(t.day,1,31)))||(t.time!==undefined&&t.day===undefined))throw Error('Use a valid Gregorian year, month, date or date/time.');
 if(t.day!==undefined){const leap=t.year%4===0&&(t.year%100!==0||t.year%400===0);if(t.day>[31,leap?29:28,31,30,31,30,31,31,30,31,30,31][t.month!-1])throw Error('That calendar date does not exist.');}
}
// Missing components sort before specified components; no fake precision is stored.
export function timingKey(t:EventTiming){if(t.kind==='undated')return '';const pad=(n:number,len=2)=>String(n).padStart(len,'0');return t.kind==='relative'?`r:${pad(t.day,9)}:${t.time??''}`:`g:${pad(t.year,4)}:${t.month===undefined?'00':pad(t.month)}:${t.day===undefined?'00':pad(t.day)}:${t.time??''}`;}
export function timingLabel(t:EventTiming){if(t.kind==='undated')return 'Undated';if(t.kind==='relative')return `Day ${t.day}${t.time?' · '+t.time:''}`;return String(t.year).padStart(4,'0')+(t.month!==undefined?'-'+String(t.month).padStart(2,'0'):'')+(t.day!==undefined?'-'+String(t.day).padStart(2,'0'):'')+(t.time?' · '+t.time:'');}
export function validateTimeline(s:TimelineState|undefined,reserved=new Set<string>()){
 if(s===undefined)return;
 if(!s||s.version!==1||!['unset','relative','gregorian'].includes(s.basis)||!Array.isArray(s.events)||!Array.isArray(s.tracks)||Object.keys(s).some(k=>!['version','basis','events','tracks'].includes(k)))throw Error('Unsupported or damaged Timeline.');
 const ids=new Set(reserved),check=(id:string)=>{if(!uuid(id)||ids.has(id))throw Error('Invalid or duplicate Timeline ID.');ids.add(id);};
 for(const t of s.tracks){check(t.id);if(typeof t.name!=='string'||!t.name.trim()||!Number.isFinite(t.order)||(t.color!==undefined&&!/^#[a-f0-9]{6}$/i.test(t.color)))throw Error('Invalid Timeline Track.');}
 const tracks=new Set(s.tracks.map(t=>t.id));
 for(const e of s.events){check(e.id);validateTiming(e.timing);if(e.timing.kind!=='undated'&&e.timing.kind!==s.basis)throw Error('Timeline timing conflicts with project basis.');if(typeof e.title!=='string'||!e.title.trim()||typeof e.notes!=='string'||!Number.isFinite(e.order)||!Number.isFinite(Date.parse(e.created))||!Number.isFinite(Date.parse(e.modified))||(e.beforeId!==null&&!uuid(e.beforeId))||(e.trashed!==undefined&&typeof e.trashed!=='boolean')||(e.primaryLocationId!==null&&!uuid(e.primaryLocationId)))throw Error('Invalid Timeline Event.');for(const list of [e.characterIds,e.linkedStoryNodeIds,e.trackIds])if(!Array.isArray(list)||list.some(id=>!uuid(id))||new Set(list).size!==list.length)throw Error('Invalid Timeline links.');if(e.trackIds.some(id=>!tracks.has(id)))throw Error('Missing Timeline Track.');if(e.timing.kind!=='undated'&&e.beforeId!==null)throw Error('Timed Event cannot have an undated anchor.');}
 const events=new Map(s.events.map(e=>[e.id,e]));for(const e of s.events)if(e.beforeId){const anchor=events.get(e.beforeId);if(anchor?.timing.kind==='undated'||e.beforeId===e.id)throw Error('Invalid Timeline anchor.');}
}
const lexical=(a:string,b:string)=>a<b?-1:a>b?1:0;
const compare=(a:TimelineEvent,b:TimelineEvent)=>a.order-b.order||lexical(a.id,b.id);
export function orderedEvents(s:TimelineState,trash=false){
 const events=s.events.filter(e=>!!e.trashed===trash),timed=events.filter(e=>e.timing.kind!=='undated').sort((a,b)=>lexical(timingKey(a.timing),timingKey(b.timing))||compare(a,b));
 const anchors=new Set(timed.map(e=>e.id)),buckets=new Map<string|null,TimelineEvent[]>();
 for(const e of events)if(e.timing.kind==='undated'){const key=e.beforeId&&anchors.has(e.beforeId)?e.beforeId:null;buckets.set(key,[...(buckets.get(key)||[]),e]);}
 for(const group of buckets.values())group.sort(compare);
 return timed.flatMap(e=>[...(buckets.get(e.id)||[]),e]).concat(buckets.get(null)||[]);
}
function edit(p:Project,fn:(s:TimelineState)=>void){const s=structuredClone(timeline(p));fn(s);validateTimeline(s);if(JSON.stringify(s)===JSON.stringify(timeline(p)))return p;return {...p,author:{...p.author,timeline:s}};}
export function createEvent(p:Project,title:string){const id=crypto.randomUUID();return {id,project:edit(p,s=>{if(!title.trim())throw Error('Enter an Event title.');s.events.push({id,title:title.trim(),timing:{kind:'undated'},characterIds:[],primaryLocationId:null,linkedStoryNodeIds:[],trackIds:[],notes:'',created:now(),modified:now(),order:Math.max(-1,...s.events.map(e=>e.order))+1,beforeId:null});})};}
export function setTimelineBasis(p:Project,basis:TimelineBasis){return edit(p,s=>{if(s.events.some(e=>e.timing.kind!=='undated')&&basis!==s.basis)throw Error('Remove timing from all Events, including Trash, before changing basis.');s.basis=basis;});}
function rehome(s:TimelineState,id:string){const before=orderedEvents(s),at=before.findIndex(e=>e.id===id),next=before.slice(at+1).find(e=>e.timing.kind!=='undated'&&e.id!==id)?.id??null;const group=before.filter(e=>e.timing.kind==='undated'&&(e.beforeId===id||e.beforeId===next));group.forEach((e,index)=>{e.beforeId=next;e.order=index;});for(const e of s.events)if(e.beforeId===id)e.beforeId=next;}
export function updateEvent(p:Project,id:string,patch:Partial<Pick<TimelineEvent,'title'|'timing'|'notes'|'characterIds'|'primaryLocationId'|'linkedStoryNodeIds'|'trackIds'>>){return edit(p,s=>{const e=s.events.find(e=>e.id===id);if(!e||e.trashed)throw Error('Choose an active Event.');if(patch.title!==undefined&&!patch.title.trim())throw Error('Enter an Event title.');
 for(const [list,type] of [[patch.characterIds,'character'],[patch.primaryLocationId?[patch.primaryLocationId]:undefined,'location']] as const)for(const target of list||[]){const old=type==='character'?e.characterIds:e.primaryLocationId?[e.primaryLocationId]:[];if(!old.includes(target)&&!p.author.worldBible?.entities.some(v=>v.id===target&&v.type===type&&!v.trashed))throw Error('Choose an active canonical '+type+'.');}
 for(const target of patch.linkedStoryNodeIds||[])if(!e.linkedStoryNodeIds.includes(target)&&!p.manifest.nodes.some(n=>n.id===target&&!n.trashed&&['Chapter','Scene'].includes(n.kind)))throw Error('Choose an active Chapter or Scene.');
 if(patch.timing){validateTiming(patch.timing);if(patch.timing.kind!=='undated'){if(s.basis!==patch.timing.kind&&s.events.some(v=>v.timing.kind!=='undated'))throw Error('Timeline already uses another time basis.');s.basis=patch.timing.kind;e.beforeId=null;}else if(e.timing.kind!=='undated')rehome(s,id);}
 const next={...e,...patch};if(JSON.stringify({...next,modified:e.modified})===JSON.stringify(e))return;Object.assign(e,next,{modified:now()});});}
export function trashEvent(p:Project,id:string,trash=true){return edit(p,s=>{const e=s.events.find(e=>e.id===id);if(!e)throw Error('Event is missing.');if(trash&&!e.trashed&&e.timing.kind!=='undated')rehome(s,id);if(trash)e.trashed=true;else delete e.trashed;e.modified=now();});}
export function deleteEvent(p:Project,id:string){return edit(p,s=>{const e=s.events.find(e=>e.id===id);if(!e?.trashed)throw Error('Move Event to Trash before deleting permanently.');rehome(s,id);s.events=s.events.filter(e=>e.id!==id);});}
export function placeEvent(p:Project,id:string,targetId:string,placement:'before'|'after'){
 return edit(p,s=>{const rows=orderedEvents(s),moving=rows.find(e=>e.id===id),target=rows.find(e=>e.id===targetId);if(!moving||!target)throw Error('Event is no longer available.');if(id===targetId)return;
 if(moving.timing.kind!=='undated'){if(target.timing.kind==='undated'||timingKey(target.timing)!==timingKey(moving.timing))throw Error('Timed Events sort by When. Only equal timing can be reordered.');const ties=rows.filter(e=>timingKey(e.timing)===timingKey(moving.timing)&&e.id!==id),at=ties.findIndex(e=>e.id===targetId)+(placement==='after'?1:0);ties.splice(at,0,moving);ties.forEach((e,i)=>e.order=i);return;}
 const others=rows.filter(e=>e.id!==id),at=others.findIndex(e=>e.id===targetId)+(placement==='after'?1:0);others.splice(at,0,moving);const anchor=others.slice(at+1).find(e=>e.timing.kind!=='undated')?.id??null;moving.beforeId=anchor;others.filter(e=>e.timing.kind==='undated'&&e.beforeId===anchor).forEach((e,i)=>e.order=i);
 });
}
export function moveEvent(p:Project,id:string,direction:-1|1){const rows=orderedEvents(timeline(p)),at=rows.findIndex(e=>e.id===id),target=rows[at+direction];return target?placeEvent(p,id,target.id,direction<0?'before':'after'):p;}
export function createTrack(p:Project,name:string){const id=crypto.randomUUID();return {id,project:edit(p,s=>{s.tracks.push({id,name:name.trim(),order:s.tracks.length});})};}
export function updateTrack(p:Project,id:string,patch:Partial<Pick<TimelineTrack,'name'|'color'>>){return edit(p,s=>{const t=s.tracks.find(t=>t.id===id);if(!t)throw Error('Track missing.');Object.assign(t,patch);if(!t.color)delete t.color;});}
export function moveTrack(p:Project,id:string,direction:-1|1){return edit(p,s=>{const values=[...s.tracks].sort((a,b)=>a.order-b.order||lexical(a.id,b.id)),at=values.findIndex(t=>t.id===id);if(at<0||!values[at+direction])return;[values[at],values[at+direction]]=[values[at+direction],values[at]];values.forEach((t,i)=>t.order=i);});}
export function removeTrack(p:Project,id:string){return edit(p,s=>{s.tracks=s.tracks.filter(t=>t.id!==id);for(const e of s.events)e.trackIds=e.trackIds.filter(t=>t!==id);});}
export type TimelineFilter={query?:string;character?:string;location?:string;track?:string;timing?:'all'|'timed'|'undated'};
export function filterEvents(events:TimelineEvent[],f:TimelineFilter){const q=f.query?.trim().toLocaleLowerCase();return events.filter(e=>(!q||(e.title+' '+e.notes).toLocaleLowerCase().includes(q))&&(!f.character||e.characterIds.includes(f.character))&&(!f.location||e.primaryLocationId===f.location)&&(!f.track||e.trackIds.includes(f.track))&&(!f.timing||f.timing==='all'||(f.timing==='undated')===(e.timing.kind==='undated')));}
export function timelineBacklinks(p:Project,type:'entity'|'document',id:string){return timeline(p).events.filter(e=>type==='document'?e.linkedStoryNodeIds.includes(id):e.characterIds.includes(id)||e.primaryLocationId===id);}
export function timelineTarget(p:Project,type:'entity'|'document',id:string){const value=type==='entity'?p.author.worldBible?.entities.find(e=>e.id===id):p.manifest.nodes.find(n=>n.id===id);return {label:value?('name' in value?value.name:value.title):'Missing',state:!value?'missing':value.trashed?'trash':'active'} as const;}
