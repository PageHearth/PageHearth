import type {ListPointerDragState} from './ListPointerDrag';

/** Timeline-local presentation only. Never writes project state or rerenders the list. */
export class TimelineDragVisual {
 private source:HTMLElement|null=null;
 private list:HTMLElement|null=null;
 private preview:HTMLElement|null=null;
 private marker:HTMLElement|null=null;
 private offset={x:0,y:0};
 private scale=1;
 begin(source:HTMLElement,list:HTMLElement,x:number,y:number){
  this.clear();this.source=source;this.list=list;
  const rect=source.getBoundingClientRect();this.offset={x:x-rect.left,y:y-rect.top};
 }
 update(value:ListPointerDragState,valid:boolean){
  if(!this.source||!this.list)return;
  if(!this.preview){
   const doc=this.source.ownerDocument,preview=doc.createElement('div');
   preview.className='timeline-drag-preview';preview.setAttribute('aria-hidden','true');
   // Copy only reading content, never controls/IDs or the Details editor.
   for(const selector of ['.timeline-select strong','.timeline-select>span:not(.timeline-chips)','.timeline-chips']){
    const content=this.source.querySelector(selector);if(content)preview.append(content.cloneNode(true));
   }
   const hint=doc.createElement('small');hint.className='timeline-drag-invalid';hint.textContent='Equal timing only';preview.append(hint);
   doc.body.append(preview);this.preview=preview;
   preview.style.width='100px';this.scale=preview.getBoundingClientRect().width/100||1;
   preview.style.width=`${Math.min(this.source.getBoundingClientRect().width,360*this.scale,doc.documentElement.clientWidth-16)/this.scale}px`;
   this.source.dataset.dragOrigin='true';
  }
  this.preview.style.transform=`translate3d(${(value.x-this.offset.x)/this.scale}px,${(value.y-this.offset.y)/this.scale}px,0)`;
  this.preview.dataset.invalid=String(!valid);
  if(this.marker)delete this.marker.dataset.drop;
  this.marker=null;
  if(valid&&value.drop){
   this.marker=Array.from(this.list.querySelectorAll<HTMLElement>('[data-event]')).find(el=>el.dataset.event===value.drop!.key)||null;
   if(this.marker)this.marker.dataset.drop=value.drop.placement;
  }
 }
 clear(){
  this.preview?.remove();if(this.source)delete this.source.dataset.dragOrigin;if(this.marker)delete this.marker.dataset.drop;
  this.preview=null;this.source=null;this.marker=null;this.list=null;
 }
}
