import {describe,expect,it} from 'vitest';
import {rememberForward,takeForward} from '../src/renderer/worldBibleNavigation';

describe('World Bible hierarchy Forward history',()=>{
  it('records each child while Back climbs a deep Location hierarchy',()=>{
    let forward:string[]=[];
    forward=rememberForward('inn',forward);
    forward=rememberForward('town',forward);
    expect(forward).toEqual(['town','inn']);
    const first=takeForward(forward);
    expect(first).toEqual({next:'town',remaining:['inn']});
    expect(takeForward(first.remaining)).toEqual({next:'inn',remaining:[]});
  });

  it('represents branch invalidation by clearing the saved forward path',()=>{
    const history=rememberForward('old-child',[]);
    expect(history).toEqual(['old-child']);
    const afterManualAlternateBranch:string[]=[];
    expect(takeForward(afterManualAlternateBranch)).toEqual({next:undefined,remaining:[]});
  });
});
