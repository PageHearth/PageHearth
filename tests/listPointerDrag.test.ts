import {describe,expect,it} from 'vitest';
import {ListPointerDragController,listPointerDrop,type ListPointerRow} from '../src/renderer/ListPointerDrag';

const rows:ListPointerRow[]=[
  {key:'A',top:100,bottom:140},
  {key:'B',top:150,bottom:190},
  {key:'C',top:200,bottom:240},
];

describe('vertical pointer-list drag controller',()=>{
  it('requires a movement threshold, then exposes active before/between/after feedback',()=>{
    const drag=new ListPointerDragController(4);
    drag.begin(7,'B',20,170);
    expect(drag.move(7,22,171,rows)).toMatchObject({active:false,drop:null});
    expect(drag.move(7,20,95,rows)).toMatchObject({active:true,drop:{key:'A',placement:'before'}});
    expect(drag.move(7,20,145,rows)).toMatchObject({active:true,drop:{key:'B',placement:'before'}});
    expect(drag.move(7,20,250,rows)).toMatchObject({active:true,drop:{key:'C',placement:'after'}});
  });

  it('commits only the captured pointer and clears state on release or cancellation',()=>{
    const drag=new ListPointerDragController();
    drag.begin(3,'A',10,120);
    expect(drag.move(4,10,220,rows)).toBeNull();
    expect(drag.finish(3,10,220,rows)).toMatchObject({key:'A',active:true,drop:{key:'C',placement:'after'}});
    expect(drag.state).toBeNull();
    drag.begin(5,'C',10,220);drag.cancel(5);expect(drag.state).toBeNull();
  });

  it('resolves row halves and gaps without requiring an HTML drag data transfer',()=>{
    expect(listPointerDrop(rows,110)).toEqual({key:'A',placement:'before'});
    expect(listPointerDrop(rows,135)).toEqual({key:'A',placement:'after'});
    expect(listPointerDrop(rows,148)).toEqual({key:'B',placement:'before'});
    expect(listPointerDrop(rows,175)).toEqual({key:'B',placement:'after'});
  });
});
