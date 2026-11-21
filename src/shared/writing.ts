import type {Project} from './model.js';
import {manuscriptIds,sumStats} from './textAnalysis.js';
export type GoalKind='manuscript'|'chapter'|'scene'|'daily-words'|'weekly-words'|'daily-time'|'weekly-time';
export type Goal={id:string;kind:GoalKind;target:number;documentId?:string;deadline?:string};
export type ActivityDay={added:number;removed:number;activeMs:number};
export type WritingState={version:1;projectId:string;revision:number;tracking:boolean;alwaysOnTop?:boolean;showTimer?:boolean;active?:boolean;weekStart:0|1;writingDays:number[];daysOff:string[];goals:Goal[];days:Record<string,ActivityDay>;notified:Record<string,string[]>};
export type WritingAction={kind:'configure';expected:number;tracking:boolean;alwaysOnTop?:boolean;showTimer?:boolean;active?:boolean;weekStart:0|1;writingDays:number[];daysOff:string[];goals:Goal[]}|{kind:'clear';period:'today'|'all'}|{kind:'acknowledge';keys:Record<string,string>};
export function localDay(now=Date.now()){const d=new Date(now);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function dayDate(day:string){return new Date(day+'T12:00:00');}
export function validDay(day:unknown):day is string{return typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(dayDate(day).getTime())&&localDay(dayDate(day).getTime())===day;}
export function weekDay(now:number,start:0|1){const d=new Date(now);d.setDate(d.getDate()-(d.getDay()-start+7)%7);return localDay(d.getTime());}
export const emptyDay=():ActivityDay=>({added:0,removed:0,activeMs:0});
export function defaultWriting(projectId:string):WritingState{return {version:1,projectId,revision:0,tracking:true,weekStart:1,writingDays:[1,2,3,4,5],daysOff:[],goals:[],days:{},notified:{}};}
export function validateWriting(s:WritingState,projectId:string){
 if(!s||s.version!==1||s.projectId!==projectId||!Number.isSafeInteger(s.revision)||s.revision<0||typeof s.tracking!=='boolean'||(s.alwaysOnTop!==undefined&&typeof s.alwaysOnTop!=='boolean')||(s.showTimer!==undefined&&typeof s.showTimer!=='boolean')||![0,1].includes(s.weekStart)||!Array.isArray(s.writingDays)||s.writingDays.some(x=>!Number.isInteger(x)||x<0||x>6)||!Array.isArray(s.daysOff)||s.daysOff.some(x=>!validDay(x))||!Array.isArray(s.goals)||!s.days||Array.isArray(s.days)||!s.notified||Array.isArray(s.notified))throw Error('Unsupported or damaged writing activity/settings. Original file is preserved.');
 const ids=new Set(),scopes=new Set();for(const g of s.goals){const scope=g.kind+':'+(g.documentId||'');if(!g||!['manuscript','chapter','scene','daily-words','weekly-words','daily-time','weekly-time'].includes(g.kind)||typeof g.id!=='string'||!/^[a-f0-9-]{36}$/.test(g.id)||ids.has(g.id)||scopes.has(scope)||!Number.isSafeInteger(g.target)||g.target<=0||g.target>1e9||(['chapter','scene'].includes(g.kind)&&!g.documentId)||(g.documentId!==undefined&&!/^[a-f0-9-]{36}$/.test(g.documentId))||(g.deadline!==undefined&&(!validDay(g.deadline)||g.kind!=='manuscript')))throw Error('Invalid or duplicate writing goal.');ids.add(g.id);scopes.add(scope);}
 for(const [day,row] of Object.entries(s.days)){if(!validDay(day)||!row||[row.added,row.removed,row.activeMs].some(x=>!Number.isSafeInteger(x)||x<0))throw Error('Invalid activity day.');}
 for(const [id,value] of Object.entries(s.notified))if(!ids.has(id)||!Array.isArray(value)||value.some(p=>p!=='total'&&!validDay(p)))throw Error('Invalid goal notification record.');
}
export function periodActivity(s:WritingState,from:string,to=localDay()){const result=emptyDay();for(const [day,row] of Object.entries(s.days))if(day>=from&&day<=to){result.added+=row.added;result.removed+=row.removed;result.activeMs+=row.activeMs;}return result;}
export function goalProgress(s:WritingState,g:Goal,p:Project,now=Date.now()){
 const day=localDay(now),weekly=g.kind.startsWith('weekly'),period=g.kind.startsWith('daily')?day:weekly?weekDay(now,s.weekStart):'total';
 const activity=g.kind.includes('-'),row=periodActivity(s,weekly?weekDay(now,s.weekStart):day,day);
 const current=activity?(g.kind.endsWith('time')?row.activeMs/60000:row.added):sumStats(manuscriptIds(p,g.documentId).map(id=>p.documents[id])).words;
 return {current,period,paused:activity&&!s.tracking,complete:current>=g.target,percent:current/g.target*100};
}
export function deadlinePace(s:WritingState,g:Goal,current:number,now=Date.now()){
 if(!g.deadline)return null;let days=0;const d=dayDate(localDay(now)),end=dayDate(g.deadline);if(end.getTime()-d.getTime()>3660*86400000)return null;
 while(d<=end){if(s.writingDays.includes(d.getDay())&&!s.daysOff.includes(localDay(d.getTime())))days++;d.setDate(d.getDate()+1);}
 const remaining=Math.max(0,g.target-current);return {remaining,days,pace:days?Math.ceil(remaining/days):null};
}
export function completionKeys(s:WritingState,p:Project,now=Date.now()){const keys:Record<string,string>={};for(const g of s.goals){const progress=goalProgress(s,g,p,now);if(!progress.paused&&progress.complete&&!s.notified[g.id]?.includes(progress.period))keys[g.id]=progress.period;}return keys;}
/** One project clock, regardless of renderer count; no background-app grace time. */
export class WorkClock{
 private last:number;private interaction=-Infinity;private foreground=false;
 constructor(now:number,private add:(from:number,to:number)=>void){this.last=now;}
 isActive(now:number){return this.foreground&&now<this.interaction+120000;}
 tick(now:number,enabled=true){const end=Math.min(now,this.interaction+120000);if(enabled&&this.foreground&&end>this.last)this.add(this.last,end);this.last=now;}
 focus(value:boolean,now:number,enabled=true){this.tick(now,enabled);this.foreground=value;if(!value)this.interaction=-Infinity;}
 touch(now:number,enabled=true){this.tick(now,enabled);this.foreground=true;this.interaction=now;}
 reset(now:number){this.last=now;this.interaction=-Infinity;}
}
