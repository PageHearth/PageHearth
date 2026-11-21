import {it,expect,vi} from 'vitest';
import {renderProofPages} from '../src/renderer/proofPageRender';
function deferred(){let resolve!:()=>void,reject!:(e:Error)=>void;const promise=new Promise<void>((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function fixture(){
 const make=()=>({style:{},setAttribute:vi.fn()}),old=make();
 const host:any={children:[old],ownerDocument:{createElement:make},replaceChildren:vi.fn((...nodes:any[])=>{host.children=nodes;})};
 const renders:any[]=[];const pdf:any={getPage:vi.fn(async()=>({getViewport:({scale}:any)=>({width:400*scale,height:600*scale}),render:()=>{const wait=deferred(),job={promise:wait.promise,cancel:vi.fn(()=>wait.reject(Error('Canceled')))};renders.push({...wait,job});return job;}}))};
 return {host,old,pdf,renders};
}
const tick=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
it('uncached getPage and painting retain the old geometry until complete',async()=>{
 const f=fixture(),gate=deferred(),get=f.pdf.getPage;f.pdf.getPage=vi.fn(async(n:number)=>{await gate.promise;return get(n);});
 const task=renderProofPages(f.host,f.pdf,[2],100,false,()=>true);await tick();expect(f.host.children).toEqual([f.old]);gate.resolve();await tick();expect(f.host.replaceChildren).not.toHaveBeenCalled();f.renders[0].resolve();expect(await task.done).toBe(true);expect(f.host.replaceChildren).toHaveBeenCalledTimes(1);
});
it('cached pages still publish only finished canvases at the requested zoom',async()=>{
 const f=fixture(),task=renderProofPages(f.host,f.pdf,[1],150,false,()=>true);await tick();expect(f.host.children[0]).toBe(f.old);f.renders[0].resolve();await task.done;expect(f.host.children[0].style).toEqual({width:'600px',height:'900px'});
});
it('rapid switching cancels obsolete painting without blanking the current page',async()=>{
 const f=fixture(),first=renderProofPages(f.host,f.pdf,[2],100,false,()=>true);await tick();first.cancel();const last=renderProofPages(f.host,f.pdf,[4],100,false,()=>true);await tick();expect(await first.done).toBe(false);expect(f.renders[0].job.cancel).toHaveBeenCalled();expect(f.host.children).toEqual([f.old]);f.renders[1].resolve();expect(await last.done).toBe(true);expect(f.host.replaceChildren).toHaveBeenCalledTimes(1);
});
it('cancellation before page loading and a stale generation never publish',async()=>{
 const f=fixture(),task=renderProofPages(f.host,f.pdf,[2],100,false,()=>true);task.cancel();expect(await task.done).toBe(false);expect(f.renders).toHaveLength(0);
 let current=true;const next=renderProofPages(f.host,f.pdf,[3],100,false,()=>current);await tick();current=false;f.renders[0].resolve();expect(await next.done).toBe(false);expect(f.host.replaceChildren).not.toHaveBeenCalled();
});
it('spreads publish atomically and genuine errors preserve the previous page',async()=>{
 const f=fixture(),task=renderProofPages(f.host,f.pdf,[2,3],100,true,()=>true);await tick();f.renders[0].resolve();await tick();expect(f.host.replaceChildren).not.toHaveBeenCalled();f.renders[1].resolve();await task.done;expect(f.host.children).toHaveLength(2);
 const before=f.host.children,next=renderProofPages(f.host,f.pdf,[4],100,false,()=>true);await tick();f.renders[2].reject(Error('Bad page'));await expect(next.done).rejects.toThrow('Bad page');expect(f.host.children).toBe(before);
});
it('first-page spread preserves blank facing-page geometry',async()=>{const f=fixture(),task=renderProofPages(f.host,f.pdf,[1],100,true,()=>true);await tick();f.renders[0].resolve();await task.done;expect(f.host.children[0].className).toBe('proof-empty-side');expect(f.host.children[0].style.height).toBe('600px');expect(f.host.children).toHaveLength(2);});
