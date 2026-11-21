import {test,expect,_electron as electron,type ElectronApplication} from '@playwright/test';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {Store} from '../src/main/storage';
async function setup(){const base=await fs.mkdtemp(path.join(os.tmpdir(),'pagehearth-safety-'));const root=path.join(base,'Novel');await fs.mkdir(root);const s=new Store(root);await s.create('Safety Novel');const id=s.project.manifest.nodes[0].id;await s.release();const executablePath=process.env.PAGEHEARTH_EXECUTABLE;const app=await electron.launch({...(executablePath?{executablePath}:{}),args:[...(executablePath?[]:['.']),`--user-data-dir=${path.join(base,'profile')}`,path.join(root,'project.pagehearth')]});const page=await app.firstWindow();await expect(page).toHaveTitle('PageHearth · Safety Novel');return {base,root,id,app,page};}
async function settings(app:ElectronApplication){await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.send('app-command',{kind:'settings'}));}
async function quit(app:ElectronApplication){const closed=app.waitForEvent('close');await app.evaluate(({BrowserWindow})=>{setTimeout(()=>BrowserWindow.getAllWindows()[0].close(),20);});await closed;}
test('renderer crash recovers acknowledged protected typing before debounce',async()=>{
  const s=await setup();try{
    await s.app.evaluate(({dialog})=>{dialog.showMessageBox=async(_win,options:any)=>({response:options.title==='Writing window interrupted'?0:1,checkboxChecked:false});});
    await s.page.getByRole('textbox',{name:'Manuscript editor'}).fill('Typing protected before autosave.');
    const draft=path.join(s.root,'.storyloom','drafts',s.id+'.json');await expect.poll(()=>fs.readFile(draft,'utf8').catch(()=>''),{intervals:[10,20,30]}).toContain('Typing protected before autosave.');
    expect(await fs.readFile(path.join(s.root,'manuscript',s.id+'.json'),'utf8')).not.toContain('Typing protected');
    await s.app.evaluate(({BrowserWindow})=>{setTimeout(()=>BrowserWindow.getAllWindows()[0].webContents.forcefullyCrashRenderer(),20);});
    // Playwright's old Page is marked crashed. Inspect the reloaded native webContents instead.
    await expect.poll(()=>s.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.executeJavaScript('document.body.innerText').catch(()=>'')),{timeout:15000}).toContain('Protected editor changes recovered');
    expect(await s.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.executeJavaScript(`document.querySelector('[aria-label="Manuscript editor"]').textContent`))).toContain('Typing protected before autosave.');await quit(s.app);
    const reopened=new Store(s.root);await reopened.open();expect(JSON.stringify(reopened.project.documents[s.id])).toContain('Typing protected before autosave.');await reopened.release();
  }finally{await s.app.close().catch(()=>{});await fs.rm(s.base,{recursive:true,force:true});}
});
test('tree changes, Trash, confirmed deletion and panel widths survive project reopen',async()=>{
  const s=await setup();try{
    const {page}=s;await page.getByRole('textbox',{name:'Manuscript editor'}).fill('Original chapter prose.');
    await page.getByRole('button',{name:'Rename',exact:true}).click();await page.getByLabel('Document name',{exact:true}).fill('Renamed chapter');await page.getByRole('button',{name:'Save name'}).click();await expect(page.locator('.page h1')).toHaveText('Renamed chapter');
    await page.getByLabel('New document title').fill('Second chapter');await page.getByRole('button',{name:'Add',exact:true}).click();await expect(page.locator('.page h1')).toHaveText('Second chapter');await expect(page.getByRole('textbox',{name:'Manuscript editor'})).toHaveAttribute('contenteditable','true');await page.getByRole('textbox',{name:'Manuscript editor'}).fill('Second prose.');
    await page.getByRole('button',{name:'Second chapter',exact:true}).focus();await page.keyboard.press('Alt+ArrowUp');await expect(page.locator('.tree-row').first()).toHaveText('Second chapter');
    await page.locator('.tree-row').filter({hasText:'Second chapter'}).press('Control+Space');await page.locator('.tree-row').filter({hasText:'Renamed chapter'}).press('Control+Space');await page.getByRole('button',{name:'Move to Trash',exact:true}).click();await expect(page.locator('.tree-row')).toHaveCount(0);
    await page.getByRole('button',{name:'View Trash',exact:true}).click();await expect(page.locator('.tree-row')).toHaveCount(2);await page.locator('.tree-row').filter({hasText:'Renamed chapter'}).press('Control+Space');await page.getByRole('button',{name:'Restore',exact:true}).click();
    await page.locator('.tree-row').filter({hasText:'Second chapter'}).press('Control+Space');await s.app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:0,checkboxChecked:false});});await page.getByRole('button',{name:'Delete permanently…'}).click();await expect(page.locator('.tree-row')).toHaveCount(1);
    await s.app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1,checkboxChecked:false});});await page.getByRole('button',{name:'Delete permanently…'}).click();await expect(page.locator('.tree-row')).toHaveCount(0);
    await page.getByRole('button',{name:'Show manuscript'}).click();await page.getByRole('button',{name:'Renamed chapter',exact:true}).click();await expect(page.getByRole('textbox',{name:'Manuscript editor'})).toHaveText('Original chapter prose.');
    const resize=page.getByRole('separator',{name:'Resize Story Tree'});await resize.focus();await page.keyboard.press('End');await expect(resize).toHaveAttribute('aria-valuenow','400');await page.keyboard.press('ArrowLeft');await expect(resize).toHaveAttribute('aria-valuenow','390');
    await page.getByRole('button',{name:'PageHearth Home'}).click();await page.locator('.recent-open').click();await expect(page.getByRole('separator',{name:'Resize Story Tree'})).toHaveAttribute('aria-valuenow','390');await expect(page.getByRole('textbox',{name:'Manuscript editor'})).toHaveText('Original chapter prose.');
    await quit(s.app);const manifest=JSON.parse(await fs.readFile(path.join(s.root,'project.pagehearth'),'utf8'));expect(manifest.nodes).toHaveLength(1);expect(manifest.nodes[0].id).toBe(s.id);expect((await fs.readdir(path.join(s.root,'manuscript'))).filter(n=>n.endsWith('.json'))).toHaveLength(1);
  }finally{await s.app.close().catch(()=>{});await fs.rm(s.base,{recursive:true,force:true});}
});
test('guided backup restore validates before destination selection and never changes the open project',async()=>{
  const s=await setup();try{
    await s.page.getByRole('textbox',{name:'Manuscript editor'}).fill('Restore source prose.');await settings(s.app);await s.page.getByRole('button',{name:'Back up now',exact:true}).click();await expect(s.page.locator('.notice')).toContainText('Verified backup saved');
    const zip=path.join(s.root,'backups',(await fs.readdir(path.join(s.root,'backups'))).find(n=>n.endsWith('.zip'))!);
    await s.app.evaluate(({dialog},args)=>{let count=0;dialog.showOpenDialog=async()=>({canceled:false,filePaths:[count++===0?args.zip:args.parent]});dialog.showMessageBox=async()=>({response:1,checkboxChecked:false});},{zip,parent:s.base});
    await s.page.getByRole('button',{name:'Restore backup…',exact:true}).click();await expect(s.page.locator('.notice')).toContainText('Verified project restored');await expect(s.page.getByRole('textbox',{name:'Manuscript editor'})).toHaveText('Restore source prose.');
    const restored=(await fs.readdir(s.base)).find(n=>n.startsWith('PageHearth Restored'))!;const store=new Store(path.join(s.base,restored));await store.open();expect(JSON.stringify(store.project.documents[s.id])).toContain('Restore source prose.');await store.release();await quit(s.app);
  }finally{await s.app.close().catch(()=>{});await fs.rm(s.base,{recursive:true,force:true});}
});
test('native editor context menu and native text-field history use the focused editing surface',async()=>{
  const s=await setup();try{
    await s.app.evaluate(({Menu})=>{Menu.prototype.popup=function(){(globalThis as any).contextLabels=this.items.map(item=>item.label);};});
    await s.page.getByRole('textbox',{name:'Manuscript editor'}).fill('Context menu manuscript.');await s.page.getByRole('textbox',{name:'Manuscript editor'}).press('Control+A');await s.page.getByRole('textbox',{name:'Manuscript editor'}).click({button:'right'});
    const labels=await s.app.evaluate(()=>(globalThis as any).contextLabels);expect(labels).toEqual(expect.arrayContaining(['Add Reference…','Cut','Copy','Paste','Select All']));
    const field=s.page.getByLabel('New document title');await field.focus();await s.page.keyboard.type('Native field');await s.app.evaluate(({Menu})=>Menu.getApplicationMenu()!.getMenuItemById('edit-undo')!.click());await expect(field).toHaveValue('');await s.app.evaluate(({Menu})=>Menu.getApplicationMenu()!.getMenuItemById('edit-redo')!.click());await expect(field).toHaveValue('Native field');await expect(s.page.getByRole('textbox',{name:'Manuscript editor'})).toHaveText('Context menu manuscript.');await quit(s.app);
  }finally{await s.app.close().catch(()=>{});await fs.rm(s.base,{recursive:true,force:true});}
});
test('large manuscript keeps one editor DOM and remains responsive during repeated saving',async()=>{
  const s=await setup();try{
    await s.page.getByRole('button',{name:'PageHearth Home'}).click();await expect(s.page.getByRole('heading',{name:'Recent Projects'})).toBeVisible();const store=new Store(s.root);await store.open();const p=structuredClone(store.project);
    for(let i=0;i<350;i++){const id=i===0?s.id:randomUUID();if(i)p.manifest.nodes.push({id,parent:null,title:`Scene ${i}`,kind:'Scene'});p.documents[id]={type:'doc',content:Array.from({length:5},()=>({type:'paragraph',content:[{type:'text',text:'word '.repeat(90)}]}))};}await store.commit(p);await store.release();
    await s.page.locator('.recent-open').click();const prose=s.page.getByRole('textbox',{name:'Manuscript editor'});await expect(prose.locator('p')).toHaveCount(5);await expect(s.page.locator('.tree-row')).toHaveCount(350);
    await s.page.evaluate(()=>{const times:number[]=[];let last=performance.now();(window as any).scaleHeartbeat=setInterval(()=>{const now=performance.now();times.push(now-last);last=now;},16);(window as any).scaleTimes=times;});
    await prose.click();for(let i=0;i<5;i++){await s.page.keyboard.type('A sustained editing sample. ',{delay:10});await expect(s.page.locator('footer')).toContainText('Saved');}
    const max=await s.page.evaluate(()=>{clearInterval((window as any).scaleHeartbeat);return Math.max(...(window as any).scaleTimes);});console.log('Large-project renderer heartbeat maximum ms:',Math.round(max));expect(max).toBeLessThan(1000);
    await s.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(850,600));await s.page.getByRole('toolbar',{name:'Editor commands'}).scrollIntoViewIfNeeded();await s.page.getByRole('button',{name:'PageHearth Home'}).click();await s.page.locator('.recent-open').click();await expect(prose).toContainText('A sustained editing sample.');await quit(s.app);
  }finally{await s.app.close().catch(()=>{});await fs.rm(s.base,{recursive:true,force:true});}
});

test('backup preferences, pointer panel sizing and emergency JSON recovery survive transitions',async()=>{
 const s=await setup();try{
  await settings(s.app);const daily=s.page.getByRole('checkbox',{name:'Back up daily (24 hours after changes)'});await daily.click();await expect(daily).toBeChecked();
  const external=path.join(s.base,'Alternate backups');await fs.mkdir(external);await s.app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},external);
  await s.page.getByRole('button',{name:'Choose backup folder…'}).click();await expect(s.page.locator('.project-settings')).toContainText(external);
  await s.page.getByRole('button',{name:'Close',exact:true}).click();await s.page.getByRole('textbox',{name:'Manuscript editor'}).fill('Emergency copy preserves this prose.');await settings(s.app);await s.page.getByRole('button',{name:'Back up now',exact:true}).click();await expect(s.page.locator('.notice')).toContainText('Verified backup saved');
  const manifest=JSON.parse(await fs.readFile(path.join(s.root,'project.pagehearth'),'utf8'));expect(manifest.settings.backup).toEqual({directory:external,daily:true});expect((await fs.readdir(path.join(external,'PageHearth-Backups-'+manifest.id))).some(n=>n.endsWith('.zip'))).toBe(true);
  await s.page.getByRole('button',{name:'Close',exact:true}).click();const resize=s.page.getByRole('separator',{name:'Resize Inspector'});const box=(await resize.boundingBox())!;await s.page.mouse.move(box.x+box.width/2,box.y+box.height/2);await s.page.mouse.down();await s.page.mouse.move(box.x-40,box.y+box.height/2);await s.page.mouse.up();const width=await resize.getAttribute('aria-valuenow');expect(Number(width)).toBeGreaterThan(235);
  await s.page.getByRole('button',{name:'PageHearth Home'}).click();await s.page.locator('.recent-open').click();await expect(s.page.getByRole('textbox',{name:'Manuscript editor'})).toBeVisible();await expect(s.page.locator('.app-status')).toContainText('Saved');await settings(s.app);await expect(daily).toBeChecked();await expect(resize).toHaveAttribute('aria-valuenow',width!);
  await s.page.getByRole('button',{name:'Use project backup folder'}).click();await expect(s.page.locator('.project-settings')).toContainText('Inside this project');await expect(daily).toBeChecked();
  await s.page.getByRole('button',{name:'Close',exact:true}).click();await s.page.getByRole('button',{name:'PageHearth Home'}).click();await expect(s.page.getByRole('heading',{name:'Recent Projects'})).toBeVisible();const source=new Store(s.root);await source.open();const recovery=path.join(s.base,'emergency.json');await fs.writeFile(recovery,JSON.stringify(source.project));await source.release();
  await s.app.evaluate(({dialog},args)=>{let count=0;dialog.showOpenDialog=async()=>({canceled:false,filePaths:[count++===0?args.recovery:args.parent]});dialog.showMessageBox=async()=>({response:1,checkboxChecked:false});},{recovery,parent:s.base});
  await s.page.getByRole('button',{name:'Recover emergency JSON…'}).click();await expect(s.page.locator('.notice')).toContainText('Manuscript recovered to');await expect(s.page.locator('.notice')).toContainText('External assets must be restored separately');
  const folder=(await fs.readdir(s.base)).find(n=>n.startsWith('PageHearth Restored'))!;const recovered=new Store(path.join(s.base,folder));await recovered.open();expect(JSON.stringify(recovered.project.documents[s.id])).toContain('Emergency copy preserves this prose.');await recovered.release();await quit(s.app);
 }finally{await s.app.close().catch(()=>{});await fs.rm(s.base,{recursive:true,force:true});}
});

test('trashing the final chapter clears the shared preview and restoring preserves prose',async()=>{const s=await setup();try{await s.page.getByRole('textbox',{name:'Manuscript editor'}).fill('Last chapter retained in Trash.');await s.page.getByRole('button',{name:'Move to Trash',exact:true}).click();await expect(s.page.getByRole('textbox',{name:'Manuscript editor'})).toHaveText('');await s.page.getByRole('button',{name:'PUBLISH',exact:true}).click();await expect(s.page.getByText('Publication body has no included prose.')).toBeVisible();await expect(s.page.locator('.publication-content-item').filter({hasText:'Chapter 1'})).toHaveCount(0);await s.page.getByRole('button',{name:'WRITE',exact:true}).click();await s.page.getByRole('button',{name:'View Trash',exact:true}).click();await s.page.locator('.tree-row').filter({hasText:'Chapter 1'}).press('Control+Space');await s.page.getByRole('button',{name:'Restore',exact:true}).click();await s.page.getByRole('button',{name:'Show manuscript'}).click();await s.page.getByRole('button',{name:'Chapter 1',exact:true}).click();await expect(s.page.getByRole('textbox',{name:'Manuscript editor'})).toHaveText('Last chapter retained in Trash.');await quit(s.app);}finally{await s.app.close().catch(()=>{});await fs.rm(s.base,{recursive:true,force:true});}});

test('urgent draft IPC stays responsive during a 256 MiB backup and recovers its latest record',async()=>{
 const s=await setup();try{
  const {randomBytes}=await import('node:crypto');for(let i=0;i<32;i++)await fs.writeFile(path.join(s.root,'assets','contention-'+i+'.bin'),randomBytes(8*1048576));
  await s.app.evaluate(async()=>{const io=process.getBuiltinModule('node:fs').promises;const read=io.readFile.bind(io);io.readFile=(async(...args:any[])=>{if(String(args[0]).includes('contention-')){(globalThis as any).contentionStarted=true;io.readFile=read as any;}return (read as any)(...args);}) as any;});
  await s.page.evaluate(()=>{(window as any).contentionDone=false;(window as any).contentionBackup=window.pagehearth.backup().then(result=>{(window as any).contentionDone=true;return result;});});
  await expect.poll(()=>s.app.evaluate(()=>(globalThis as any).contentionStarted)).toBe(true);
  const projectId=JSON.parse(await fs.readFile(path.join(s.root,'project.pagehearth'),'utf8')).id;
  const result=await s.page.evaluate(async({projectId,id})=>{const samples:number[]=[];let during=0;for(let i=0;i<20;i++){const start=performance.now();await window.pagehearth.protectDocument(projectId,id,{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Contended protected edit '+i}]}]});samples.push(performance.now()-start);if(!(window as any).contentionDone)during++;await new Promise(r=>setTimeout(r,50));}return {samples,during};},{projectId,id:s.id});
  console.log('Active-backup protected IPC latency ms:',JSON.stringify(result));expect(result.during).toBe(20);expect(Math.max(...result.samples)).toBeLessThan(1000);
  await s.page.evaluate(()=>(window as any).contentionBackup);expect(await fs.readFile(path.join(s.root,'.storyloom','drafts',s.id+'.json'),'utf8')).toContain('Contended protected edit 19');
  // Crash before normal close can submit the deliberately untouched renderer model.
  await s.app.evaluate(({dialog,BrowserWindow})=>{dialog.showMessageBox=async(_win,options:any)=>({response:options.title==='Writing window interrupted'?0:1,checkboxChecked:false});setTimeout(()=>BrowserWindow.getAllWindows()[0].webContents.forcefullyCrashRenderer(),20);});
  await expect.poll(()=>fs.readFile(path.join(s.root,'manuscript',s.id+'.json'),'utf8'),{timeout:15000}).toContain('Contended protected edit 19');
  await expect.poll(()=>s.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.executeJavaScript('document.body.innerText').catch(()=>'')),{timeout:15000}).toContain('Protected editor changes recovered');await quit(s.app);const next=new Store(s.root);await next.open(async()=>true);expect(JSON.stringify(next.project.documents[s.id])).toContain('Contended protected edit 19');await next.release();
  await fs.mkdir('.acceptance',{recursive:true});await fs.writeFile(path.join('.acceptance',process.env.PAGEHEARTH_EXECUTABLE?'contention-packaged.json':'contention-source.json'),JSON.stringify(result,null,2));
 }finally{await s.app.close().catch(()=>{});await fs.rm(s.base,{recursive:true,force:true});}
});
