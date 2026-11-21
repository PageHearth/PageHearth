import {createServer} from 'vite';
import {chromium,expect} from '@playwright/test';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {Store} from '../dist-main/main/storage.js';

// Count real context deliveries without replacing React or the pane coordinator.
// Replayed canonical updates must not echo unchanged context into React effects.
const evidenceRoot='.acceptance/react-warning';
await mkdir(evidenceRoot,{recursive:true});
const root=await mkdtemp(path.resolve(evidenceRoot,'sync-')),store=new Store(root);
await store.create('Renderer synchronization');
const fallback=crypto.randomUUID();
await store.commit({...store.project,manifest:{...store.project.manifest,nodes:[...store.project.manifest.nodes,{id:fallback,title:'Fallback',kind:'Chapter',parent:null}]},documents:{...store.project.documents,[fallback]:{type:'doc',content:[{type:'paragraph'}]}}});
const server=await createServer({optimizeDeps:{entries:['e2e/fixtures/continuous.html']},server:{watch:null,host:'127.0.0.1',port:5222,strictPort:true},plugins:[{
 name:'context-observer',enforce:'pre',transform(code,id){
  if(id.endsWith('/src/renderer/FontPicker.tsx')){
   const needle='setCurrent(activeFont(editor.state))';if(!code.includes(needle))throw Error('Font state observation seam changed');
   return code.replaceAll(needle,'((window as any).__fontDeliveries=((window as any).__fontDeliveries||0)+1,setCurrent(activeFont(editor.state)))');
  }
  if(!id.endsWith('/src/renderer/main.tsx'))return;
  const needle='context:pane=>{';if(!code.includes(needle))throw Error('Pane context observation seam changed');
  return code.replace(needle,needle+'(window as any).__contextDeliveries=((window as any).__contextDeliveries||0)+1;');
 }
},{name:'sync-api',configureServer(server){server.middlewares.use('/history-api',async(req,res)=>{
 try{let raw='';for await(const part of req)raw+=part;const {key,args}=JSON.parse(raw);let value;
 if(key==='choose')value=store.project;
 else if(key==='save')value={project:await store.commit(args[0]),reconciled:false};
 else if(key==='protectDocument')value=await store.stageDocument(args[1],args[2]);
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify({value}));
 }catch(error){res.end(JSON.stringify({error:String(error)}));}
});}}]});
let browser;
try{
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-gpu']});
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404 (Not Found)'))errors.push(m.text());});
 await page.goto('http://127.0.0.1:5222/e2e/fixtures/continuous.html',{waitUntil:'domcontentloaded',timeout:45000});
 await page.getByRole('button',{name:'Open Project…'}).click();await expect(page.locator('.tiptap[role=textbox]')).toBeVisible();
 await page.waitForTimeout(300);
 const before=await page.evaluate(()=>({contexts:window.__contextDeliveries,fonts:window.__fontDeliveries,saves:window.historyFixture.calls.save||0}));
 const canonical=JSON.stringify(store.project);
 await page.evaluate(async project=>{
  for(let i=0;i<120;i++){window.historyFixture.update(structuredClone(project));await new Promise(requestAnimationFrame);}
 },store.project);
 const after=await page.evaluate(()=>({contexts:window.__contextDeliveries,fonts:window.__fontDeliveries,saves:window.historyFixture.calls.save||0}));
 expect(after).toEqual(before);expect(JSON.stringify(store.project)).toBe(canonical);
 // Synchronization must still choose a fallback when the active document is trashed.
 const next=structuredClone(store.project),removed=next.manifest.nodes[0].id;
 next.manifest.nodes.find(n=>n.id===removed).trashed=true;
 const accepted=await store.commit(next);
 await page.evaluate(project=>window.historyFixture.update(project),accepted);
 await expect(page.locator('.draft-scroll h1')).toHaveText('Fallback');
 await page.locator('.tiptap[role=textbox]').click();await page.keyboard.type('Fallback is editable.');
 await expect.poll(()=>store.project.documents[fallback]?.content?.[0]?.content?.[0]?.text).toBe('Fallback is editable.');
 expect(errors).toEqual([]);
 const evidence={updates:120,before,after,fallback:'PASS',errors};
 await writeFile(path.join(evidenceRoot,'renderer-sync.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
}finally{await browser?.close();await server.close();await store.release();}
