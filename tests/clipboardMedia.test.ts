import {describe,expect,it,vi} from 'vitest';
import {firstClipboardPng} from '../src/main/clipboardMedia';

describe('explicit clipboard image import',()=>{
  it('returns no data when the clipboard has no usable image',async()=>{
    const encode=vi.fn((bytes:Buffer)=>bytes);
    expect(await firstClipboardPng([{types:['text/plain'],getType:vi.fn()}],encode)).toBeUndefined();
    expect(encode).not.toHaveBeenCalled();
  });

  it('reads the first image item and returns its PNG encoding',async()=>{
    const source=Uint8Array.from([1,2,3,4]),png=Buffer.from([137,80,78,71]);
    const getType=vi.fn(async()=>new Blob([source],{type:'image/png'}));
    const encode=vi.fn((bytes:Buffer)=>{expect([...bytes]).toEqual([...source]);return png;});
    expect(await firstClipboardPng([{types:['text/plain','image/png'],getType}],encode)).toEqual(png);
    expect(getType).toHaveBeenCalledWith('image/png');
    expect(encode).toHaveBeenCalledOnce();
  });
});
