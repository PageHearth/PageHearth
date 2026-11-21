type Placement='before'|'after'|'inside';
type Options={source:HTMLElement;grip:HTMLButtonElement;grid:HTMLElement;ids:string[];pointerId:number;x:number;y:number;snapshot:string;currentSnapshot:()=>string;valid:(id:string)=>boolean;commit:(id:string,placement:Placement)=>void;refuse:()=>void};

/** Outliner-only controlled gesture. No canonical writes until a completed drop. */
export class OutlinerPointerDrag {
 private options:Options|null=null;
 private active=false;
 private point={x:0,y:0,shift:false};
 private preview:HTMLElement|null=null;
 private marker:HTMLElement|null=null;
 private origins:HTMLElement[]=[];
 private frame:number|null=null;
 private scale=1;
 private offset={x:0,y:0};
 private target:{id:string;placement:Placement}|null=null;
 begin(options:Options){
  this.cancel();this.options=options;this.point={x:options.x,y:options.y,shift:false};
  const rect=options.source.getBoundingClientRect();this.offset={x:options.x-rect.left,y:options.y-rect.top};
  options.grip.setPointerCapture(options.pointerId);
 }
 move(id:number,x:number,y:number,shift:boolean){
  const o=this.options;if(!o||id!==o.pointerId)return;
  this.point={x,y,shift};
  if(!this.active&&Math.hypot(x-o.x,y-o.y)>=4){this.active=true;this.lift();}
  if(this.active)this.schedule();
 }
 private lift(){
  const o=this.options!,doc=o.source.ownerDocument,preview=doc.createElement('div');
  preview.className='outliner-drag-preview';preview.setAttribute('aria-hidden','true');
  const label=o.source.querySelector('.structure-label');if(label)preview.append(label.cloneNode(true));
  const status=o.source.querySelector<HTMLInputElement>('input[aria-label^="Status for"]');
  if(status?.value){const text=doc.createElement('small');text.textContent=status.value;preview.append(text);}
  if(o.ids.length>1){const count=doc.createElement('small');count.textContent=`${o.ids.length} selected items`;preview.append(count);}
  const hint=doc.createElement('small');hint.className='outliner-drag-invalid';hint.textContent='Cannot move into this selection';preview.append(hint);
  doc.body.append(preview);this.preview=preview;preview.style.width='100px';this.scale=preview.getBoundingClientRect().width/100||1;
  preview.style.width=`${Math.min(420*this.scale,doc.documentElement.clientWidth-16)/this.scale}px`;
  this.origins=Array.from(o.grid.querySelectorAll<HTMLElement>('[data-outline-id]')).filter(el=>o.ids.includes(el.dataset.outlineId!));
  for(const el of this.origins)el.dataset.outlinerOrigin='true';
 }
 private schedule(){if(this.frame===null)this.frame=requestAnimationFrame(()=>{this.frame=null;this.paint(true);});}
 private paint(scroll:boolean){
  const o=this.options;if(!o||!this.active||!this.preview)return;
  const {x,y,shift}=this.point,r=o.grid.getBoundingClientRect(),edge=Math.min(54,r.height/4);
  if(scroll){const speed=y<r.top+edge?-Math.ceil((r.top+edge-y)/5):y>r.bottom-edge?Math.ceil((y-r.bottom+edge)/5):0;
   const before=o.grid.scrollTop;o.grid.scrollTop+=Math.max(-18,Math.min(18,speed));if(o.grid.scrollTop!==before)this.schedule();}
  this.preview.style.transform=`translate3d(${(x-this.offset.x)/this.scale}px,${(y-this.offset.y)/this.scale}px,0)`;
  const rows=Array.from(o.grid.querySelectorAll<HTMLElement>('[data-outline-id]'));
  const target=rows.find(el=>y<=el.getBoundingClientRect().bottom)||rows.at(-1);
  if(this.marker)delete this.marker.dataset.drop;this.marker=null;this.target=null;
  if(target&&o.valid(target.dataset.outlineId!)){
   const rect=target.getBoundingClientRect(),placement=shift?'inside':y<rect.top+rect.height/2?'before':'after';
   this.marker=target;target.dataset.drop=placement;this.target={id:target.dataset.outlineId!,placement};
  }
  this.preview.dataset.invalid=String(!this.target);
 }
 finish(id:number,x:number,y:number,shift:boolean){
  const o=this.options;if(!o||o.pointerId!==id)return;
  this.move(id,x,y,shift);this.paint(false);const target=this.target,active=this.active;
  const stale=o.snapshot!==o.currentSnapshot();this.cancel();
  if(active&&stale)o.refuse();else if(active&&target)o.commit(target.id,target.placement);
 }
 cancel(){
  const o=this.options;this.options=null;this.active=false;this.target=null;
  if(this.frame!==null)cancelAnimationFrame(this.frame);this.frame=null;
  this.preview?.remove();this.preview=null;
  if(this.marker)delete this.marker.dataset.drop;this.marker=null;
  for(const el of this.origins)delete el.dataset.outlinerOrigin;this.origins=[];
  if(o?.grip.hasPointerCapture(o.pointerId))o.grip.releasePointerCapture(o.pointerId);
 }
}
