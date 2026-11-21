import type {TreeOrderSnapshot} from '../shared/tree';

export type OutlinerHistoryEntry={before:TreeOrderSnapshot;after:TreeOrderSnapshot};
const fingerprint=(snapshot:TreeOrderSnapshot)=>JSON.stringify(snapshot);
const copy=(snapshot:TreeOrderSnapshot)=>structuredClone(snapshot);

/** Bounded, surface-local history. It never applies a snapshot unless the
 * current canonical structure exactly matches the side of the entry being
 * traversed. Any other structural change invalidates the history. */
export class OutlinerStructureHistory{
  private undos:OutlinerHistoryEntry[]=[];
  private redos:OutlinerHistoryEntry[]=[];
  private known:string;
  private expected:string|null=null;
  constructor(initial:TreeOrderSnapshot,private readonly limit=32){this.known=fingerprint(initial);}
  get canUndo(){return this.undos.length>0;}
  get canRedo(){return this.redos.length>0;}
  get sizes(){return {undo:this.undos.length,redo:this.redos.length};}
  record(before:TreeOrderSnapshot,after:TreeOrderSnapshot){
    const current=fingerprint(before);if(current!==this.known){this.clear();this.known=current;}
    this.undos.push({before:copy(before),after:copy(after)});if(this.undos.length>this.limit)this.undos.splice(0,this.undos.length-this.limit);
    this.redos=[];this.expected=fingerprint(after);
  }
  observe(current:TreeOrderSnapshot){
    const value=fingerprint(current);
    if(value===this.expected){this.known=value;this.expected=null;return false;}
    if(value===this.known)return false;
    this.clear();this.known=value;return true;
  }
  undo(current:TreeOrderSnapshot){
    if(!this.matches(current,this.undos.at(-1)?.after))return null;
    const entry=this.undos.pop()!;this.redos.push(entry);this.expected=fingerprint(entry.before);return copy(entry.before);
  }
  redo(current:TreeOrderSnapshot){
    if(!this.matches(current,this.redos.at(-1)?.before))return null;
    const entry=this.redos.pop()!;this.undos.push(entry);this.expected=fingerprint(entry.after);return copy(entry.after);
  }
  private matches(current:TreeOrderSnapshot,expected:TreeOrderSnapshot|undefined){
    if(expected&&fingerprint(current)===this.known&&fingerprint(current)===fingerprint(expected))return true;
    this.clear();this.known=fingerprint(current);return false;
  }
  private clear(){this.undos=[];this.redos=[];this.expected=null;}
}
