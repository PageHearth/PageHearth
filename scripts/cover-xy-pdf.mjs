// Real production PDF raster check: asymmetric colors make X/Y mistakes observable.
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {renderCover} from '../dist-main/main/coverProduction.js';import {defaultPublication} from '../dist-main/shared/publication.js';import {readCovers,panelPlacement} from '../dist-main/shared/covers.js';
const base=path.resolve('.acceptance/cover-xy'),root=path.join(base,'pdf-fixture');await fs.mkdir(path.join(root,'assets'),{recursive:true});
const source=createCanvas(441,666),ctx=source.getContext('2d'),im=ctx.createImageData(441,666);
for(let y=0;y<666;y++)for(let x=0;x<441;x++){const i=(y*441+x)*4;im.data[i]=Math.round(x/440*255);im.data[i+1]=Math.round(y/665*255);im.data[i+2]=60;im.data[i+3]=255;}
ctx.putImageData(im,0,0);await fs.writeFile(path.join(root,'assets/gradient.png'),source.toBuffer('image/png'));
const plan=defaultPublication('XY test');plan.print.profile='kdp';plan.covers=readCovers(plan);plan.covers.spine.hideTitle=true;plan.covers.spine.hideAuthor=true;const results=[];
for(const n of [0,.5,1]){
 for(const slot of ['front','back'])Object.assign(plan.covers[slot],{asset:'assets/gradient.png',scale:1.3,x:slot==='front'?n:1-n,y:slot==='front'?1-n:n});
 const result=await renderCover({root,resources:path.resolve('assets/typst'),temporary:path.join(base,'pdf-jobs'),plan,pages:143,interior:'a'.repeat(64)},new AbortController().signal);
 assert.deepEqual(result.blocking,[]);await fs.writeFile(path.join(base,'xy-'+n+'.pdf'),result.pdf);
 const task=getDocument({data:result.pdf.slice()}),doc=await task.promise,page=await doc.getPage(1),v=page.getViewport({scale:1}),canvas=createCanvas(Math.ceil(v.width),Math.ceil(v.height));await page.render({canvasContext:canvas.getContext('2d'),viewport:v}).promise;
 const samples={};for(const slot of ['front','back']){const placement=panelPlacement(plan.covers[slot],{width:441,height:666},441,666),origin=slot==='front'?result.geometry.frontX:0,sx=Math.floor(origin+220),sy=333,actual=[...canvas.getContext('2d').getImageData(sx,sy,1,1).data].slice(0,2),expected=[((sx+.5-origin-placement.x)/placement.width)*255,((sy+.5-placement.y)/placement.height)*255];for(let i=0;i<2;i++)assert(Math.abs(actual[i]-expected[i])<4,JSON.stringify({slot,n,actual,expected}));samples[slot]={actual,expected,placement};}
 await fs.writeFile(path.join(base,'xy-'+n+'.png'),canvas.toBuffer('image/png'));results.push({n,samples,sha256:result.sha256});await task.destroy();
}
assert(results[0].samples.front.actual[0]<results[2].samples.front.actual[0]);assert(results[0].samples.front.actual[1]>results[2].samples.front.actual[1]);
await fs.writeFile(path.join(base,'pdf-placement.json'),JSON.stringify(results,null,2));console.log('Actual Cover PDF raster: opposite Front/Back X/Y, min/center/max, shared placement parity PASS');
