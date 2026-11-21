export type ListPointerRow={key:string;top:number;bottom:number};
export type ListPointerDrop={key:string;placement:'before'|'after'};
export type ListPointerDragState={pointerId:number;key:string;startX:number;startY:number;x:number;y:number;active:boolean;drop:ListPointerDrop|null};

export function listPointerDrop(rows:ListPointerRow[],y:number):ListPointerDrop|null{
  if(!rows.length)return null;
  for(let index=0;index<rows.length;index++){
    const row=rows[index],middle=row.top+(row.bottom-row.top)/2;
    if(y<=row.bottom)return {key:row.key,placement:y<middle?'before':'after'};
    const next=rows[index+1];
    if(next&&y<next.top)return y<(row.bottom+next.top)/2?{key:row.key,placement:'after'}:{key:next.key,placement:'before'};
  }
  return {key:rows[rows.length-1].key,placement:'after'};
}

export class ListPointerDragController{
  private current:ListPointerDragState|null=null;
  constructor(private readonly threshold=4){}
  get state(){return this.current;}
  begin(pointerId:number,key:string,x:number,y:number){this.current={pointerId,key,startX:x,startY:y,x,y,active:false,drop:null};return this.current;}
  move(pointerId:number,x:number,y:number,rows:ListPointerRow[]){const state=this.current;if(!state||state.pointerId!==pointerId)return null;state.x=x;state.y=y;if(!state.active&&Math.hypot(x-state.startX,y-state.startY)>=this.threshold)state.active=true;if(state.active)state.drop=listPointerDrop(rows,y);return {...state,drop:state.drop&&{...state.drop}};}
  finish(pointerId:number,x:number,y:number,rows:ListPointerRow[]){const state=this.move(pointerId,x,y,rows);this.current=null;return state?.active?state:null;}
  cancel(pointerId?:number){if(pointerId===undefined||this.current?.pointerId===pointerId)this.current=null;}
}
