import {promises as fs} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {defaultWriting,validateWriting,localDay,emptyDay,WorkClock,type WritingState,type WritingAction} from '../shared/writing.js';
/** Separate low-priority atomic file; never enters the manuscript mutation/protection queue. */
export class WritingStore{
 private state?:WritingState;private loading?:Promise<void>;private pending=Promise.resolve();private dirty=false;private closed=false;private clock:WorkClock;private timer?:ReturnType<typeof setInterval>;private backedUp='';
 private contributions=new Map<string,{day:string;added:number;removed:number;applied:boolean}>();
 warning='';private disk:string|undefined;
 constructor(private root:string,private identity:()=>string,private held:()=>boolean,private now=()=>Date.now()){
  this.clock=new WorkClock(now(),(from,to)=>{if(!this.state)return;while(from<to){const d=new Date(from);d.setHours(24,0,0,0);const end=Math.min(to,d.getTime());const day=this.state.days[localDay(from)]??=emptyDay();day.activeMs+=Math.max(0,Math.round(end-from));from=end;}this.dirty=true;});
 }
 async load(){if(this.loading)return this.loading;this.loading=(async()=>{let s;try{const file=path.join(this.root,'writing.json');const stat=await fs.lstat(file);if(stat.isSymbolicLink()||stat.size>32*1024*1024)throw Error('Unsafe or oversized writing ledger.');this.disk=await fs.readFile(file,'utf8');s=JSON.parse(this.disk);}catch(e:any){if(e.code!=='ENOENT')throw e;s=defaultWriting(this.identity());}validateWriting(s,this.identity());this.state=s;})();return this.loading;}
 async start(){await this.load();if(!this.timer&&!this.closed){this.timer=setInterval(()=>{this.clock.tick(this.now(),this.state!.tracking);void this.flush().catch(e=>{this.warning=String(e);});},30000);this.timer.unref();}}
 async read(){await this.load();this.clock.tick(this.now(),this.state!.tracking);return {...structuredClone(this.state!),active:this.state!.tracking&&this.clock.isActive(this.now())};}
 focus(value:boolean){if(this.state)this.clock.focus(value,this.now(),this.state.tracking);if(!value)void this.flush().catch(e=>{this.warning=String(e);});}
 touch(){if(this.state&&!this.closed)this.clock.touch(this.now(),this.state.tracking);}
 async add(added:number,removed:number){await this.load();if(this.closed||!this.held())throw Error('Writing session closed.');if(![added,removed].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1e7))throw Error('Invalid writing activity.');if(!this.state!.tracking||!(added||removed))return;const row=this.state!.days[localDay(this.now())]??=emptyDay();row.added+=added;row.removed+=removed;this.dirty=true;}
 async contribution(value:{id:string;added:number;removed:number;apply:boolean;initial?:boolean}){
  await this.load();if(this.closed||!this.held())throw Error('Writing session closed.');
  if(!value||!/^[a-f0-9-]{36}$/.test(value.id)||typeof value.apply!=='boolean'||![value.added,value.removed].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1e7))throw Error('Invalid activity contribution.');
  if(!this.state!.tracking)return;
  let c=this.contributions.get(value.id);
  if(!c){if(!value.apply||!value.initial)return;c={day:localDay(this.now()),added:value.added,removed:value.removed,applied:false};this.contributions.set(value.id,c);if(this.contributions.size>100000)this.contributions.delete(this.contributions.keys().next().value!);}
  if(c.added!==value.added||c.removed!==value.removed)throw Error('Activity provenance mismatch.');
  if(c.applied===value.apply)return;const row=this.state!.days[c.day]??=emptyDay(),sign=value.apply?1:-1;
  row.added=Math.max(0,row.added+sign*c.added);row.removed=Math.max(0,row.removed+sign*c.removed);c.applied=value.apply;this.dirty=true;
 }
 async change(action:WritingAction){await this.load();if(this.closed||!this.held())throw Error('Writing session closed.');this.clock.tick(this.now(),this.state!.tracking);const s=structuredClone(this.state!);
  if(action.kind==='configure'){if(action.expected!==s.revision)throw Error('Writing goals changed elsewhere. Reopen the dialog before saving.');Object.assign(s,{tracking:action.tracking,alwaysOnTop:action.alwaysOnTop,showTimer:action.showTimer,weekStart:action.weekStart,writingDays:action.writingDays,daysOff:action.daysOff,goals:action.goals});for(const id of Object.keys(s.notified))if(JSON.stringify(s.goals.find(g=>g.id===id))!==JSON.stringify(this.state!.goals.find(g=>g.id===id)))delete s.notified[id];if(s.tracking!==this.state!.tracking)this.clock.reset(this.now());}
  else if(action.kind==='clear'){if(action.period==='all')s.days={};else if(action.period==='today')delete s.days[localDay(this.now())];else throw Error('Invalid activity clear period.');this.clock.reset(this.now());for(const [id,c] of this.contributions)if(action.period==='all'||c.day===localDay(this.now()))this.contributions.delete(id);}
  else if(action.kind==='acknowledge'){for(const [id,period] of Object.entries(action.keys))if(s.goals.some(g=>g.id===id)&&!s.notified[id]?.includes(period))(s.notified[id]??=[]).push(period);}
  else throw Error('Invalid writing action.');
  if(action.kind==='configure')s.revision++;validateWriting(s,this.identity());this.state=s;this.dirty=true;await this.flush();return this.read();
 }
 async snapshot(){await this.load();return Buffer.from(JSON.stringify((await this.read(),this.state),null,2)+'\n');}
 get backupDirty(){return !!this.state&&JSON.stringify(this.state)!==this.backedUp;}
 markBackedUp(bytes:Uint8Array){this.backedUp=JSON.stringify(JSON.parse(Buffer.from(bytes).toString()));}
 async flush(){if(!this.state||!this.dirty)return this.pending;const bytes=JSON.stringify(this.state,null,2)+'\n';this.dirty=false;
  const task=this.pending.then(async()=>{if(!this.held())throw Error('Project lock no longer held for writing activity.');const file=path.join(this.root,'writing.json'),temp=file+'.'+randomUUID()+'.tmp';let existing:string|undefined;try{existing=await fs.readFile(file,'utf8');}catch(e:any){if(e.code!=='ENOENT')throw e;}if(existing!==this.disk)throw Error('Writing ledger changed outside this session. Original file preserved.');const h=await fs.open(temp,'wx');try{await h.writeFile(bytes);await h.sync();}finally{await h.close();}await fs.rename(temp,file);this.disk=bytes;this.warning='';});this.pending=task.catch(e=>{this.dirty=true;this.warning=String(e);});return task;
 }
 async close(){if(this.timer)clearInterval(this.timer);this.clock.focus(false,this.now(),this.state?.tracking);this.closed=true;await this.flush();await this.pending;}
}
