import {test,expect,_electron as electron} from '@playwright/test';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {Store} from '../src/main/storage';
import {createTreeNode} from '../src/shared/treeCreation';

test('print proof uncached/cached navigation, rapid switching and zoom retain mounted geometry',async()=>{
 const base=await fs.mkdtemp(path.resolve('.acceptance/proof-scroll-')),root=path.join(base,'Book');await fs.mkdir(root);const store=new Store(root);await store.create('Synthetic print scroll');let project=store.project;
 for(let i=0;i<14;i++){const id=crypto.randomUUID();project=createTreeNode(project,'Chapter','Chapter '+(i+2),null,id);project.documents[id]={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:('Synthetic page '+i+' preserves scroll. ').repeat(100)}]}]};}
 await store.commit(project);await store.release();const canonical=await fs.readFile(path.join(root,'manuscript',project.manifest.nodes[1].id+'.json'),'utf8');
 const executablePath=process.env.PAGEHEARTH_EXECUTABLE,app=await electron.launch({...(executablePath?{executablePath}:{}),args:[...(executablePath?[]:['.']),`--user-data-dir=${path.join(base,'profile')}`,path.join(root,'project.pagehearth')],timeout:20000});
 try{const page=await app.firstWindow();await page.getByRole('button',{name:'PUBLISH',exact:true}).click();await page.getByRole('button',{name:'Final Print Preview (Proof)',exact:true}).click();await page.getByRole('button',{name:'Generate Final Print Preview',exact:true}).click();const host=page.locator('.proof-canvas');await expect(host.locator('canvas')).toHaveCount(1,{timeout:30000});await expect(page.locator('.print-proof')).toContainText('Ready');
 const start=await page.getByLabel('Physical page',{exact:true}).inputValue();const first=Number(start);expect(Number(await page.getByLabel('Physical page',{exact:true}).getAttribute('max'))).toBeGreaterThan(12);
 // Sample every animation frame, including the load/render interval. Do not let
 // Playwright's action scrolling mask application scroll movement.
 await host.evaluate((h:any)=>{const targets:HTMLElement[]=[h];let p=h.parentElement;while(p){if(p.scrollHeight>p.clientHeight+150)targets.push(p);p=p.parentElement;}for(const t of targets)t.scrollTop=Math.min(60,t.scrollHeight-t.clientHeight);const state={targets,initial:targets.map(t=>t.scrollTop),minimum:targets.map(t=>t.scrollTop),empty:0,minHeight:h.clientHeight,running:true};(window as any).__proofScroll=state;const sample=()=>{if(!state.running)return;state.empty+=h.querySelectorAll('canvas').length?0:1;state.minHeight=Math.min(state.minHeight,h.clientHeight);targets.forEach((t,i)=>state.minimum[i]=Math.min(state.minimum[i],t.scrollTop));requestAnimationFrame(sample);};requestAnimationFrame(sample);});
 const next=()=>page.getByRole('button',{name:'Next page',exact:true}).evaluate((b:HTMLButtonElement)=>b.click());const prev=()=>page.getByRole('button',{name:'Previous page',exact:true}).evaluate((b:HTMLButtonElement)=>b.click());
 for(let i=1;i<=4;i++){await next();await expect(host.locator('canvas')).toHaveAttribute('aria-label',`Proof physical page ${first+i}`);}
 for(let i=3;i>=0;i--){await prev();await expect(host.locator('canvas')).toHaveAttribute('aria-label',`Proof physical page ${first+i}`);}
 await next();await expect(host.locator('canvas')).toHaveAttribute('aria-label',`Proof physical page ${first+1}`);
 await page.getByRole('button',{name:'Next page',exact:true}).evaluate((b:HTMLButtonElement)=>{b.click();b.click();b.click();});await expect(host.locator('canvas')).toHaveAttribute('aria-label',`Proof physical page ${first+4}`);
 const width=await host.locator('canvas').evaluate(c=>c.width);await page.getByLabel('Proof zoom',{exact:true}).selectOption('150');await expect.poll(()=>host.locator('canvas').evaluate(c=>c.width)).toBe(Math.floor(width*1.5));await page.getByLabel('Proof zoom',{exact:true}).selectOption('100');await expect.poll(()=>host.locator('canvas').evaluate(c=>c.width)).toBe(width);
 await page.getByLabel('Proof page view').selectOption('spread');await expect(host.locator('canvas')).toHaveCount(2);await page.getByLabel('Proof page view').selectOption('single');await expect(host.locator('canvas')).toHaveCount(1);await expect(page.getByRole('alert').filter({hasText:'PDF display failed'})).toHaveCount(0);
 const metrics=await page.evaluate(()=>{const s=(window as any).__proofScroll;s.running=false;return{initial:s.initial,minimum:s.minimum,empty:s.empty,minHeight:s.minHeight};});expect(metrics.empty).toBe(0);expect(metrics.minHeight).toBeGreaterThan(300);expect(metrics.minimum).toEqual(metrics.initial);expect(metrics.initial.some((n:number)=>n>0)).toBe(true);
 await page.screenshot({path:path.join(base,'proof.png')});await fs.writeFile(path.join(base,'scroll-metrics.json'),JSON.stringify(metrics,null,2));expect(await fs.readFile(path.join(root,'manuscript',project.manifest.nodes[1].id+'.json'),'utf8')).toBe(canonical);
 }finally{await app.close();}
});
