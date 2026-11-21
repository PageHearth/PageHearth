/** One deadline from the first change, never a sliding inactivity timer. */
export class BackupSchedule {
  private generation=0;
  private backedUp=0;
  private timer:ReturnType<typeof setTimeout>|undefined;
  private running=false;
  private stopped=false;
  constructor(private backup:()=>Promise<void>,private warn:(error:unknown)=>void,private delay=5*60*1000){}
  get dirty(){return this.generation!==this.backedUp;}
  changed(){this.generation++;this.arm();}
  private arm(){if(this.stopped || this.running || this.timer || !this.dirty)return;this.timer=setTimeout(()=>{this.timer=undefined;void this.run();},this.delay);}
  private async run(){
    if(this.stopped || !this.dirty)return;
    const captured=this.generation;this.running=true;
    try{await this.backup();this.backedUp=Math.max(this.backedUp,captured);}catch(e){this.warn(e);}
    finally{this.running=false;this.arm();}
  }
  /** Manual backup uses the same generation rule; later changes remain pending. */
  checkpoint(){return this.generation;}
  verified(generation:number){this.backedUp=Math.max(this.backedUp,generation);if(!this.dirty && this.timer){clearTimeout(this.timer);this.timer=undefined;}this.arm();}
  stop(){this.stopped=true;if(this.timer)clearTimeout(this.timer);this.timer=undefined;}
}
