import type {AnchorSide} from '../shared/comments';
import type {Doc} from '../shared/model';
import type {Contribution} from './authoredActivity';
export type ProseBookmark={anchor:number;head:number;marks:NonNullable<Doc['marks']>|null};
export type ProseEvent={anchorsBefore?:AnchorSide;anchorsAfter?:AnchorSide;kind:'prose';id:string;documentId:string;before:Doc;after:Doc;from:number;to:number;selectionBefore?:ProseBookmark;selectionAfter?:ProseBookmark;contributions:Contribution[];time:number;group:string};
export type StructureEvent={kind:'structure';id:string};
export type ManuscriptEvent=ProseEvent|StructureEvent|{kind:'revision-clear';id:string};
/** Session-only chronology survives editor recreation/navigation. Never stores a project. */
export class ManuscriptHistory{
 undo:ManuscriptEvent[]=[];redo:ManuscriptEvent[]=[];boundary=0;
 clear(){this.undo=[];this.redo=[];this.boundary++;}
 closeGroup(){this.boundary++;}
 push(event:ManuscriptEvent){this.redo=[];this.undo.push(event);this.trim();}
 prose(event:Omit<ProseEvent,'id'|'group'>,join:boolean){
  const last=this.undo.at(-1),group=String(this.boundary);
  if(join&&last?.kind==='prose'&&last.group===group&&last.documentId===event.documentId&&event.time-last.time<500&&JSON.stringify(last.after)===JSON.stringify(event.before)&&last.to===event.from){last.after=event.after;last.to=event.to;last.selectionAfter=event.selectionAfter;last.anchorsAfter=event.anchorsAfter;last.time=event.time;last.contributions.push(...event.contributions);this.redo=[];this.trim();}
  else this.push({...event,id:crypto.randomUUID(),group});
 }
 peek(direction:'undo'|'redo'){return this[direction].at(-1);}
 complete(direction:'undo'|'redo',event:ManuscriptEvent){if(this.peek(direction)!==event)throw Error('Manuscript history changed.');this[direction].pop();this[direction==='undo'?'redo':'undo'].push(event);this.closeGroup();}
 private trim(){while(this.undo.length>100||JSON.stringify([this.undo,this.redo]).length*2>32*1024*1024){if(!this.undo.length)break;this.undo.shift();}}
}
