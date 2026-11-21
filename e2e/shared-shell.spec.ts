import {test,expect,_electron as electron,type ElectronApplication} from '@playwright/test';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {Store} from '../src/main/storage';
import {createEntity} from '../src/shared/worldBible';

async function start(){
  const base=await fs.mkdtemp(path.join(os.tmpdir(),'pagehearth-shell-')),root=path.join(base,'Novel'),profile=path.join(base,'profile');await fs.mkdir(root);
  const store=new Store(root);await store.create('Shell Acceptance');const made=createEntity(store.project,'character','Mina'),id=made.project.manifest.nodes[0].id;
  made.project.documents[id]={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Mina',marks:[{type:'entityReference',attrs:{targetId:made.id,occurrenceId:crypto.randomUUID()}}]},{type:'text',text:' walked home.'}]}]};await store.commit(made.project);await store.release();
  const launch=()=>electron.launch({...(process.env.PAGEHEARTH_EXECUTABLE?{executablePath:process.env.PAGEHEARTH_EXECUTABLE}:{}),args:[...(process.env.PAGEHEARTH_EXECUTABLE?[]:['.']),`--user-data-dir=${profile}`,path.join(root,'project.pagehearth')]});
  const app=await launch(),page=await app.firstWindow();await expect(page.getByRole('textbox',{name:'Manuscript editor'})).toBeVisible();return {base,root,profile,id,launch,app,page};
}
async function menu(app:ElectronApplication,id:string){await app.evaluate(({Menu},id)=>Menu.getApplicationMenu()!.getMenuItemById(id)!.click(),id);}
async function quit(app:ElectronApplication){const closed=app.waitForEvent('close');await app.evaluate(({BrowserWindow})=>{setTimeout(()=>BrowserWindow.getAllWindows()[0].close(),10);});await closed;}

test('compact shell and Inspector retain controls at supported widths and zooms',async()=>{
  const s=await start();try{
    await expect(s.page.locator('.app>header')).toHaveCount(0);await expect(s.page.getByRole('button',{name:'Reference',exact:true})).toHaveCount(0);
    for(const width of [1600,1100])for(const zoom of [100,125,140,150,175,200]){
      await s.app.evaluate(({BrowserWindow},width)=>BrowserWindow.getAllWindows()[0].setSize(width,900),width);await s.page.evaluate(value=>window.pagehearth.zoom(value),zoom);
      const shell=s.page.locator('.shell-navigation');await expect(shell).toBeVisible();
      const geometry=await shell.evaluate(el=>({height:el.getBoundingClientRect().height,scroll:el.scrollWidth,width:el.clientWidth}));expect(geometry.height).toBeLessThanOrEqual(45);expect(geometry.scroll).toBeLessThanOrEqual(geometry.width+1);
      await expect(s.page.getByRole('button',{name:'PageHearth Home'})).toBeVisible();await expect(s.page.getByRole('button',{name:'PUBLISH',exact:true})).toBeVisible();
      const picker=s.page.getByLabel('Workspace',{exact:true});if(await picker.isVisible()){expect(await picker.locator('option').count()).toBe(8);await picker.selectOption('editor');}
      const inspector=s.page.locator('.workspace>.inspector');await expect(inspector.getByRole('button',{name:'Pin',exact:true})).toBeVisible();await expect(inspector.getByRole('button',{name:'Detach',exact:true})).toBeVisible();
      expect(await inspector.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    }
    await s.page.evaluate(()=>window.pagehearth.zoom(100));await s.page.getByRole('button',{name:'PUBLISH',exact:true}).click();await s.page.getByRole('button',{name:'Chapter 1 Chapter · Manuscript',exact:true}).click();await expect(s.page.locator('.publication-draft-page p')).toHaveText('Mina walked home.');await s.page.getByRole('button',{name:'PageHearth Home'}).click();await expect(s.page.getByRole('heading',{name:'Recent Projects'})).toBeVisible();
  }finally{await s.app.close().catch(()=>{});await fs.rm(s.base,{recursive:true,force:true});}
});

test('QuickNotes bindings stay live and Send preserves context until deliberate Open',async()=>{
  const s=await start();let app=s.app,page=s.page;try{
    await menu(app,'keyboard-shortcuts');const dialog=page.getByRole('dialog',{name:'Keyboard Shortcuts'});await dialog.locator('section').filter({has:page.getByText('QuickNotes',{exact:true})}).getByRole('button',{name:'Change',exact:true}).click();await dialog.getByLabel('New shortcut').press('Alt+Q');await dialog.getByRole('button',{name:'Save shortcut'}).click();await dialog.getByRole('button',{name:'Close',exact:true}).click();
    await expect(page.locator('.status-utilities button')).toContainText('Alt+Q');expect(await app.evaluate(({Menu})=>Menu.getApplicationMenu()!.getMenuItemById('quicknotes')!.accelerator)).toBe('Alt+Q');
    await page.keyboard.press('Control+Shift+M');await expect(page.getByLabel('QuickNotes text')).toHaveCount(0);await page.keyboard.press('Alt+Q');await page.getByLabel('QuickNotes text').fill('Captured without leaving WRITE');await page.getByRole('button',{name:'Send to Notebook'}).click();await expect(page.getByRole('textbox',{name:'Manuscript editor'})).toBeVisible();await expect(page.getByRole('button',{name:'Open',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Open',exact:true}).click();await expect(page.getByRole('textbox',{name:'Notebook Note editor'})).toContainText('Captured without leaving WRITE');await quit(app);
    app=await s.launch();page=await app.firstWindow();await expect(page.locator('.status-utilities button')).toContainText('Alt+Q');await menu(app,'keyboard-shortcuts');await page.getByRole('dialog',{name:'Keyboard Shortcuts'}).locator('section').filter({has:page.getByText('QuickNotes',{exact:true})}).getByRole('button',{name:'Reset to Default'}).click();await page.getByRole('button',{name:'Close',exact:true}).click();await expect(page.locator('.status-utilities button')).toContainText('Ctrl+Shift+M');
  }finally{await app.close().catch(()=>{});await fs.rm(s.base,{recursive:true,force:true});}
});

test('native right-click removes only the explicit occurrence without selecting its text',async()=>{
  const s=await start();try{
    await s.app.evaluate(({Menu})=>{const build=Menu.buildFromTemplate;Menu.buildFromTemplate=(template:any)=>{(globalThis as any).referenceMenu=template;const menu=build(template);menu.popup=()=>{};return menu;};});
    const editor=s.page.getByRole('textbox',{name:'Manuscript editor'});await editor.click();await s.page.keyboard.press('End');await editor.locator('[data-entity-reference]').click({button:'right'});
    await expect.poll(()=>s.app.evaluate(()=>(globalThis as any).referenceMenu?.some((x:any)=>x.label==='Remove Reference'))).toBe(true);await s.app.evaluate(()=>(globalThis as any).referenceMenu.find((x:any)=>x.label==='Remove Reference').click());await expect(editor).toHaveText('Mina walked home.');await expect(editor.locator('[data-entity-reference]')).toHaveCount(0);
    await editor.press('Control+Z');await expect(editor.locator('[data-entity-reference]')).toHaveCount(1);await editor.press('Control+Y');await expect(editor.locator('[data-entity-reference]')).toHaveCount(0);
    await expect.poll(async()=>JSON.parse(await fs.readFile(path.join(s.root,'manuscript',s.id+'.json'),'utf8')).content[0].content.some((n:any)=>n.marks?.some((m:any)=>m.type==='entityReference'))).toBe(false);
    await editor.press('Control+A');await editor.click({button:'right'});await expect.poll(()=>s.app.evaluate(()=>(globalThis as any).referenceMenu?.some((x:any)=>x.label==='Add Reference…'))).toBe(true);
  }finally{await s.app.close().catch(()=>{});await fs.rm(s.base,{recursive:true,force:true});}
});

test('shortcut dismissal cancels capture; Inspector boundary survives content scrolling',async()=>{
 const s=await start();try{
  const dialog=s.page.getByRole('dialog',{name:'Keyboard Shortcuts'});
  for(const close of ['button','escape','backdrop']){
   await menu(s.app,'keyboard-shortcuts');await dialog.getByLabel('Find shortcut').click();await expect(dialog).toBeVisible();
   await dialog.locator('section').filter({has:s.page.getByText('QuickNotes',{exact:true})}).getByRole('button',{name:'Change',exact:true}).click();
   await dialog.getByLabel('New shortcut').press('Alt+Q');
   await dialog.locator('.shortcut-body').evaluate(el=>{el.scrollTop=el.scrollHeight;});await expect(dialog.getByRole('button',{name:'Close',exact:true})).toBeInViewport();
   if(close==='button')await dialog.getByRole('button',{name:'Close',exact:true}).click();else if(close==='escape')await s.page.keyboard.press('Escape');else await s.page.mouse.click(2,2);
   await expect(dialog).toHaveCount(0);await s.page.keyboard.press('Control+Shift+M');await expect(s.page.getByLabel('QuickNotes text')).toBeVisible();await s.page.keyboard.press('Control+Shift+M');
  }
  const separator=s.page.getByRole('separator',{name:'Resize Inspector'}),viewport=s.page.locator('.inspector-scroll');
  for(const zoom of [100,140,175,200]){
   await s.page.evaluate(value=>window.pagehearth.zoom(value),zoom);
   const before=await separator.boundingBox();await viewport.evaluate(el=>{el.scrollTop=el.scrollHeight;});const after=await separator.boundingBox();expect(after).toEqual(before);
   const outer=await s.page.locator('.workspace>.inspector').boundingBox();expect(after!.height).toBeGreaterThanOrEqual(outer!.height-2);
   const old=Number(await separator.getAttribute('aria-valuenow'));await separator.press('ArrowLeft');await expect(separator).toHaveAttribute('aria-valuenow',String(Math.min(400,old+10)));
   const box=(await separator.boundingBox())!;await s.page.mouse.move(box.x+3,box.y+box.height*.8);await s.page.mouse.down();await s.page.mouse.move(box.x-15,box.y+box.height*.8);await s.page.mouse.up();
  }
  await s.page.evaluate(()=>window.pagehearth.zoom(100));const width=Number(await separator.getAttribute('aria-valuenow'));
  await expect.poll(async()=>JSON.parse(await fs.readFile(path.join(s.root,'project.pagehearth'),'utf8')).settings.workspace.inspectorWidth).toBe(width);
  const toolbar=s.page.getByRole('toolbar',{name:'Editor commands'});await expect(toolbar.locator('.active-reference')).toHaveCount(0);await s.page.locator('[data-entity-reference]').click();await expect(toolbar).not.toContainText('Reference:');
 }finally{await s.app.close().catch(()=>{});await fs.rm(s.base,{recursive:true,force:true});}
});

test('Page View, keyboard entry and contextual Collections retain the same manuscript',async()=>{
 const s=await start();try{
  const prose=s.page.getByRole('textbox',{name:'Manuscript editor'}),bar=s.page.getByRole('toolbar',{name:'Editor commands'});
  await expect(bar).toBeVisible();await expect(s.page.locator('.writing>.document-bar')).toHaveCount(0);await expect(bar.getByRole('button',{name:'Enter Editor'})).toHaveCount(0);
  await s.page.keyboard.press('F6');await expect(prose).toBeFocused();await s.page.keyboard.press('Tab');await expect(prose.locator('p')).toHaveAttribute('data-indent','1');await s.page.keyboard.press('Shift+Tab');await s.page.keyboard.press('Escape');await expect(bar).toBeFocused();
  const before=await prose.textContent();await menu(s.app,'editor-view-continuous');await expect(s.page.locator('.draft-page-view')).toHaveCount(0);await menu(s.app,'editor-view-pages');await expect(s.page.locator('.draft-page-view')).toBeVisible();expect(await prose.textContent()).toBe(before);
  await s.page.getByLabel('Draft navigator').selectOption('pages');await expect(s.page.getByRole('region',{name:'Draft Pages'})).toBeVisible();await menu(s.app,'editor-view-continuous');await expect(s.page.getByRole('region',{name:'Draft Pages'})).toBeVisible();
  await expect.poll(async()=>JSON.parse(await fs.readFile(path.join(s.root,'project.pagehearth'),'utf8')).settings.workspace.editorView).toBe('continuous');
  await s.page.locator('#tree-'+s.id).click({button:'right'});await expect(s.page.getByRole('menuitem',{name:'Add to Collection…'})).toBeVisible();await s.page.getByRole('menuitem',{name:'Add to Collection…'}).click();await expect(s.page.getByRole('dialog')).toBeVisible();
 }finally{await s.app.close().catch(()=>{});await fs.rm(s.base,{recursive:true,force:true});}
});
