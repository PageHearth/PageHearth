import type {PDFDocumentProxy,RenderTask} from 'pdfjs-dist';

/** Render off-DOM, then publish the entire page/spread in one layout change.
 * Keeping the previous children mounted prevents scroll clamping while PDF.js
 * loads an uncached page. No scroll restoration or extra canvas cache is needed.
 */
export function renderProofPages(host:HTMLElement,pdf:Pick<PDFDocumentProxy,'getPage'>,pages:number[],zoom:number,spread:boolean,isCurrent:()=>boolean){
 let alive=true;const jobs:RenderTask[]=[];
 const done=(async()=>{
  const next:HTMLElement[]=[];
  for(const n of pages){
   const page=await pdf.getPage(n);if(!alive||!isCurrent())return false;
   const viewport=page.getViewport({scale:zoom/100}),canvas=host.ownerDocument.createElement('canvas');
   canvas.width=viewport.width;canvas.height=viewport.height;
   canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
   canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`Proof physical page ${n}`);
   if(spread&&n===1){const blank=host.ownerDocument.createElement('div');blank.className='proof-empty-side';blank.style.width=viewport.width+'px';blank.style.height=viewport.height+'px';blank.setAttribute('aria-hidden','true');next.push(blank);}
   next.push(canvas);const job=page.render({canvas,viewport});jobs.push(job);await job.promise;
   if(!alive||!isCurrent())return false;
  }
  if(!alive||!isCurrent())return false;
  host.replaceChildren(...next);return true;
 })().catch(error=>{if(!alive||!isCurrent())return false;throw error;});
 return {done,cancel(){alive=false;for(const job of jobs)job.cancel();}};
}
