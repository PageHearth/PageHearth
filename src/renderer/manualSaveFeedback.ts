/** Ephemeral presentation only. Autosave never calls success. Failures/edits invalidate pending acknowledgments. */
export class ManualSaveFeedback {
 private generation=0;
 private timer:ReturnType<typeof setTimeout>|undefined;
 constructor(private show:(visible:boolean)=>void){}
 clear(){this.generation++;if(this.timer)clearTimeout(this.timer);this.timer=undefined;this.show(false);}
 begin(){this.clear();return this.generation;}
 success(ticket:number){if(ticket!==this.generation)return;this.show(true);this.timer=setTimeout(()=>this.clear(),2500);}
}
