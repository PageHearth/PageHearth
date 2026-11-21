import {focusMenu} from '../dist-main/main/focusMenu.js';
import {createServer} from 'vite';
import {chromium,expect} from '@playwright/test';
import {mkdir,mkdtemp,writeFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from '../dist-main/main/storage.js';
import {scopeDocuments,compositeBody} from '../dist-main/shared/continuous.js';
import {restoreBackup} from '../dist-main/main/archive.js';
await mkdir('.acceptance/focus-repair',{recursive:true});const root=await mkdtemp(path.resolve('.acceptance/focus-repair/browser-'));let store=new Store(root);await store.create('Continuous acceptance');
const body=text=>({type:'doc',content:[{type:'paragraph',content:[{type:'text',text}]}]});
const p=structuredClone(store.project),a=p.manifest.nodes[0].id,b=randomUUID(),c=randomUUID();p.documents[a]=body('Chapter body lantern');p.documents[a].content.push(...Array.from({length:70},()=>({type:'paragraph',content:[{type:'text',text:'independent viewport prose '.repeat(10)}]})));for(const [id,title] of [[b,'First scene'],[c,'Last scene']]){p.manifest.nodes.push({id,parent:a,title,kind:'Scene'});p.documents[id]=body(title+' lantern');}p.author.corkboards[a]={contextId:a,cards:[{id:randomUUID(),kind:'planning',text:'planning needle',x:0,y:0}]};p.author.scenes='available';await store.commit(p);
const calls=[];const server=await createServer({optimizeDeps:{entries:['e2e/fixtures/continuous.html']},server:{watch:null,host:'127.0.0.1',port:5220,strictPort:true},plugins:[{name:'continuous-acceptance',configureServer(server){server.middlewares.use('/history-api',async(req,res)=>{try{let raw='';for await(const part of req)raw+=part;const {key,args}=JSON.parse(raw);calls.push({key,id:args[1]});let value;const [pid,id,...rest]=args;if(key==='choose')value=store.project;else if(key==='save')value={project:await store.commit(args[0]),reconciled:false};else if(key==='protectDocument')value=await store.stageDocument(id,...rest);else if(key==='historyList')value=await store.history.list(id);else if(key==='historyRead')value=await store.history.read(id,...rest);else if(key==='historyCapture')value=await store.history.capture(id,rest[0],'manual',rest[1],rest[2],Date.now(),rest[3]);else if(key==='historyRestore')value=await store.history.prepareRestore(id,...rest);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({value}));}catch(e){res.end(JSON.stringify({error:String(e)}));}})}}]});await server.listen();let browser;const evidence={environment:'actual App + real Store; headless Edge, not native Electron',root,checks:[]};

try{
 browser=await chromium.launch({channel:'msedge',headless:true,ignoreDefaultArgs:['--hide-scrollbars'],args:['--disable-gpu'],timeout:15000});const page=await browser.newPage({viewport:{width:1900,height:1000}});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>{errors.push(String(e));console.log('Page error',String(e));});await page.goto('http://127.0.0.1:5220/e2e/fixtures/continuous.html',{waitUntil:'domcontentloaded',timeout:30000});await page.getByRole('button',{name:'Open Project…'}).click({timeout:30000});const command=kind=>page.evaluate(async kind=>{window.historyFixture.emit({kind});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));},kind);
 const editor=()=>page.locator('.editor-pane.active .tiptap');await expect(editor()).toBeVisible();
 const choose=async(kind)=>{await command(kind);await expect.poll(()=>page.evaluate(()=>window.historyFixture.focusView?.value)).toBeTruthy();};
 const native=async kind=>{const state=await page.evaluate(()=>window.historyFixture.focusView);const menu=focusMenu(state.value,state.enabled,c=>windowCommand=c.kind);let windowCommand;const items=[...menu[0].submenu,menu[1]];items.find(x=>x.id===kind).click();await choose(windowCommand);};
 const reflected=()=>page.evaluate(()=>window.historyFixture.focusView.value);
 const counts=()=>page.evaluate(()=>Object.fromEntries(['protectDocument','protectAuthor','historyCapture','projectEdited'].map(k=>[k,window.historyFixture.calls[k]||0])));
 const bodies=JSON.stringify(store.project.documents),author=JSON.stringify(store.project.author),writes=await counts();
 for(const text of ['sentence','paragraph','off','paragraph']){await native('text-focus-'+text);await expect(editor()).toHaveAttribute('data-text-focus',text);expect((await reflected()).text).toBe(text);}
 await editor().hover();await page.mouse.wheel(0,400);await expect(editor()).toHaveAttribute('data-text-focus','off');await native('text-focus-paragraph');await expect(editor()).toHaveAttribute('data-text-focus','paragraph');
 await native('typewriter-toggle');expect((await reflected()).typewriter).toBe(true);await native('typewriter-toggle');expect((await reflected()).typewriter).toBe(false);
 await command('focus-mode');await page.keyboard.press('F6');await page.getByLabel('Text Focus',{exact:true}).selectOption('sentence');await expect.poll(async()=>(await reflected()).text).toBe('sentence');await page.getByRole('button',{name:'Typewriter: Off',exact:true}).click();await expect.poll(async()=>(await reflected()).typewriter).toBe(true);await page.keyboard.press('Escape');await native('text-focus-paragraph');await native('text-focus-sentence');await native('text-focus-off');await native('typewriter-toggle');evidence.checks.push('native menu builder commands and reflection are symmetric outside Focus, strip uses same state; selecting suspended current mode resumes');
 const geometries=[];
 for(const layout of ['single','side-by-side','stacked']){
  await command('editor-'+layout);await expect(page.locator('.editor-panes')).toHaveClass(new RegExp(layout));
  if(layout!=='single'){const splitter=page.getByRole('separator',{name:'Resize editor panes'});await splitter.focus();await splitter.press('Home');}
  for(const view of ['pages','continuous']){await page.evaluate(view=>window.historyFixture.emit({kind:'editor-view',view}),view);
   await page.getByLabel('Draft navigator',{exact:true}).selectOption(view==='pages'?'pages':'none');
   for(const [width,zoom] of [[2400,1],[850,1],[1200,2]]){
    await page.setViewportSize({width,height:900});await page.evaluate(zoom=>document.body.style.zoom=String(zoom),zoom);await command('focus-mode');await page.waitForTimeout(180);
    const sample=()=>page.evaluate(()=>{const g=document.querySelector('.editor-panes').getBoundingClientRect(),w=document.querySelector('.workspace').getBoundingClientRect();return {left:g.left,width:g.width,available:w.width,error:Math.abs(g.left+g.width/2-w.left-w.width/2)};});const g=await sample();expect(g.error).toBeLessThan(2);expect(g.width).toBeLessThanOrEqual(g.available+1);await page.waitForTimeout(180);expect(await sample()).toEqual(g);geometries.push({layout,view,width,zoom,...g});await page.keyboard.press('Escape');
   }
   await page.evaluate(()=>document.body.style.zoom='1');await page.setViewportSize({width:1900,height:1000});
  }
 }
 evidence.geometries=geometries;evidence.checks.push('18 wide/narrow/200% centered group cases: Single, both splits at 25/75, both presentations, rail on/off, settled geometry');
 await command('save');expect(JSON.stringify(store.project.documents)).toBe(bodies);expect(JSON.stringify(store.project.author)).toBe(author);expect(await counts()).toEqual(writes);evidence.checks.push('layout/preferences/menu reflection: zero manuscript/protection/Author/reference/History changes');
 for(const theme of ['Light','Dark','System']){await page.evaluate(theme=>window.historyFixture.emit({kind:'set-theme',theme}),theme);for(const mode of ['sentence','paragraph']){await native('text-focus-'+mode);await editor().evaluate(el=>el.editor.commands.setTextSelection(5));await expect(editor().locator('.focus-current-block')).toHaveCSS('opacity','1');await expect(editor().locator('p:not(.focus-current-block)').first()).toHaveCSS('opacity','0.55');}}
 evidence.checks.push('55% dim treatment vs full-prominence block in Light/Dark/System; prior scroll/resume behavior preserved');
 await native('typewriter-toggle');
 const resumes=[];
 for(const layout of ['single','side-by-side','stacked']){await command('editor-'+layout);
  for(const scope of ['single-document','continuous-all']){await command(scope);
   for(const view of ['pages','continuous']){await page.evaluate(view=>window.historyFixture.emit({kind:'editor-view',view}),view);await command('focus-mode');
    for(const delta of [-2200,2200]){
     await editor().evaluate(el=>{const ed=el.editor;let target;ed.state.doc.descendants((n,p)=>{if(target===undefined&&n.isText&&p>2000)target=p+12;});ed.commands.setTextSelection(target);el.focus();});await page.waitForTimeout(600);
     await editor().hover();await page.mouse.wheel(0,delta);await page.waitForTimeout(120);const before=await editor().evaluate(el=>({json:el.editor.getJSON(),prefix:el.editor.state.doc.textBetween(0,el.editor.state.selection.from,'',''),suffix:el.editor.state.doc.textBetween(el.editor.state.selection.to,el.editor.state.doc.content.size,'','')}));
     const other=await page.locator('.editor-pane:not(.active) .draft-scroll').evaluateAll(els=>els.map(e=>e.scrollTop));
     await page.keyboard.insertText('Q');await page.waitForTimeout(300);
     const result=await editor().evaluate(el=>{const ed=el.editor,r=ed.view.coordsAtPos(ed.state.selection.head),s=el.closest('.draft-scroll').getBoundingClientRect();return {text:ed.state.doc.textContent,error:Math.abs((r.top+r.bottom)/2-s.top-s.height/2)};});expect(result.text).toBe(before.prefix+'Q'+before.suffix);expect(result.error).toBeLessThan(3);expect(await page.locator('.editor-pane:not(.active) .draft-scroll').evaluateAll(els=>els.map(e=>e.scrollTop))).toEqual(other);await page.keyboard.press('Control+z');expect(await editor().evaluate(el=>el.editor.getJSON())).toEqual(before.json);resumes.push({layout,scope,view,delta,error:result.error});
    }
    await page.keyboard.press('Escape');
   }
  }
 }
 evidence.resumes=resumes;evidence.checks.push('24 scroll-away/resume cases across both directions, all layouts, scopes and presentations: exact one-character edit, Undo, inactive scroll preserved');
 // Deterministic reproduction of a late browser nearest-edge reveal, after the old two-frame center.
 for(const edge of ['top','bottom']){await editor().evaluate((el,edge)=>{el.addEventListener('input',()=>{requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const ed=el.editor,s=el.closest('.draft-scroll'),r=ed.view.coordsAtPos(ed.state.selection.head),b=s.getBoundingClientRect();s.scrollTop+=edge==='top'?r.top-b.top-8:r.bottom-b.bottom+8;})));},{once:true});},edge);await page.keyboard.insertText('R');await page.waitForTimeout(350);expect(await editor().evaluate(el=>{const r=el.editor.view.coordsAtPos(el.editor.state.selection.head),b=el.closest('.draft-scroll').getBoundingClientRect();return Math.abs((r.top+r.bottom)/2-b.top-b.height/2);})).toBeLessThan(3);}
 const top=await editor().evaluate(el=>el.closest('.draft-scroll').scrollTop);await page.waitForTimeout(600);expect(await editor().evaluate(el=>el.closest('.draft-scroll').scrollTop)).toBe(top);await editor().hover();await page.mouse.wheel(0,500);await page.waitForTimeout(80);const review=await editor().evaluate(el=>el.closest('.draft-scroll').scrollTop);await page.waitForTimeout(400);expect(await editor().evaluate(el=>el.closest('.draft-scroll').scrollTop)).toBe(review);evidence.checks.push('late top/bottom caret reveal is corrected, bounded settling stops, manual review is not recentered');
 expect(errors).toEqual([]);await page.screenshot({path:'.acceptance/focus-repair/browser.png'});await writeFile('.acceptance/focus-repair/browser.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
}finally{await browser?.close();await server.close();await store.release();}
