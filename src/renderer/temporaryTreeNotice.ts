/** Only transient Story Tree operation feedback; never save/recovery errors. */
export class TemporaryTreeNotice {
  private timer:ReturnType<typeof setTimeout>|undefined;
  constructor(private readonly display:(message:string)=>void){}
  show(message:string){
    this.dispose();
    this.display(message);
    if(message)this.timer=setTimeout(()=>{this.timer=undefined;this.display('');},5000);
  }
  dismiss(){this.dispose();this.display('');}
  dispose(){if(this.timer!==undefined)clearTimeout(this.timer);this.timer=undefined;}
}
