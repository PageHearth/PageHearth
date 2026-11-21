import {createProject} from './new-project';
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Store } from '../src/main/storage';

async function launch(profile:string){const executablePath=process.env.PAGEHEARTH_EXECUTABLE;return electron.launch({...(executablePath?{executablePath}:{}),args:[...(executablePath?[]:['.']),`--user-data-dir=${profile}`]});}
async function dialog(app:ElectronApplication,folder:string|null){await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async(...args:any[])=>{(globalThis as any).lastDialog=args[1]??args[0];return {canceled:folder===null,filePaths:folder?[folder]:[]};};},folder);}
async function menu(app:ElectronApplication,id:string){await app.evaluate(({Menu},id)=>{const m=Menu.getApplicationMenu()!.getMenuItemById(id)!;m.click();},id);}
async function quit(app:ElectronApplication){const closed=app.waitForEvent('close');await app.evaluate(({BrowserWindow})=>{setTimeout(()=>BrowserWindow.getAllWindows()[0].close(),20);});await closed;}
async function home(page:Page){await page.getByRole('button',{name:'PageHearth Home'}).click();await expect(page.getByRole('heading',{name:'Recent Projects'})).toBeVisible();}
async function make(root:string,title:string,long=false){await fs.mkdir(root);const s=new Store(root);await s.create(title);if(long){const p=structuredClone(s.project);p.documents[p.manifest.nodes[0].id]={type:'doc',content:Array.from({length:180},(_,i)=>({type:'paragraph',content:[{type:'text',text:`Paragraph ${i+1}. `+'A wandering storyteller followed the river through the old forest. '.repeat(8)}]}))};await s.commit(p);}await s.release();}
async function setup(){const base=await fs.mkdtemp(path.join(os.tmpdir(),'pagehearth-navigation-'));return {base,profile:path.join(base,'profile'),first:path.join(base,'My Novel'),second:path.join(base,'Second')};}

test('Home, recent projects and dialog locations survive restart; failed close retains project and lock',async()=>{
  const s=await setup();await make(s.second,'Second Novel');let app=await launch(s.profile);
  try{
    let page=await app.firstWindow();await dialog(app,s.base);await createProject(page,'My Novel');
    await page.locator('[aria-label="Manuscript editor"]').fill('Pending text must survive Home.');
    // Force a real backup destination failure; the close must not discard edits or release the lock.
    await fs.rename(path.join(s.first,'backups'),path.join(s.first,'held-backups'));await fs.writeFile(path.join(s.first,'backups'),'test obstruction');
    await page.getByRole('button',{name:'PageHearth Home'}).click();await expect(page.getByRole('alert')).toBeVisible();await expect(page.locator('[aria-label="Manuscript editor"]')).toContainText('Pending text');await expect(fs.stat(path.join(s.first,'.storyloom','lock.json'))).resolves.toBeTruthy();
    await fs.unlink(path.join(s.first,'backups'));await fs.rename(path.join(s.first,'held-backups'),path.join(s.first,'backups'));
    await menu(app,'close-project');await expect(page.getByRole('heading',{name:'Recent Projects'})).toBeVisible();await expect(fs.stat(path.join(s.first,'.storyloom','lock.json'))).rejects.toThrow();expect((await fs.readdir(path.join(s.first,'backups'))).length).toBeGreaterThan(0);
    await dialog(app,null);await page.getByRole('button',{name:'New Project…'}).click();await page.getByRole('button',{name:'Change Location…'}).click();expect(await app.evaluate(()=> (globalThis as any).lastDialog.defaultPath)).toBe(s.base);await page.getByRole('dialog',{name:'New Project',exact:true}).getByRole('button',{name:'Cancel',exact:true}).click();
    await dialog(app,s.second);await page.getByRole('button',{name:'Open Project…',exact:true}).click();await expect(page).toHaveTitle('PageHearth · Second Novel');
    await page.locator('[aria-label="Manuscript editor"]').click();await page.keyboard.press('Control+z');await expect(page.locator('[aria-label="Manuscript editor"]')).toHaveText('');
    // The menu routes through the renderer flush handshake before opening another recent project.
    await page.locator('[aria-label="Manuscript editor"]').fill('Second project pending edit.');await menu(app,'recent-1');await expect(page).toHaveTitle('PageHearth · My Novel');await expect(page.locator('[aria-label="Manuscript editor"]')).toContainText('Pending text must survive Home.');
    await home(page);await quit(app);app=await launch(s.profile);page=await app.firstWindow();
    await expect(page.getByRole('heading',{name:'Recent Projects'})).toBeVisible();await expect(page.locator('.recent-projects')).toContainText(s.first);await expect(page.locator('.recent-projects')).toContainText('Last opened');
    await dialog(app,null);await page.getByRole('button',{name:'Open Project…',exact:true}).click();expect(await app.evaluate(()=> (globalThis as any).lastDialog.defaultPath)).toBe(s.second);
    await page.locator('.recent-open').filter({hasText:'Second Novel'}).click();await expect(page.locator('[aria-label="Manuscript editor"]')).toContainText('Second project pending edit.');await home(page);
    const moved=path.join(s.base,'Moved');await fs.rename(s.second,moved);await page.locator('.recent-open').filter({hasText:'Second Novel'}).click();await expect(page.getByRole('alert')).toContainText('missing or unavailable');
    await page.getByRole('button',{name:'Remove Second Novel from recent projects'}).click();await expect(page.locator('.recent-open').filter({hasText:'Second Novel'})).toHaveCount(0);
    await dialog(app,null);await page.getByRole('button',{name:'Open Project…',exact:true}).click();const fallback=await app.evaluate(()=> (globalThis as any).lastDialog.defaultPath);expect(fallback).not.toBe(s.second);expect(fallback).toBeTruthy();
    await quit(app);
  }finally{await app.close().catch(()=>{});await fs.rm(s.base,{recursive:true,force:true});}
});

test('zoom keys, buttons and menus agree inside and outside editor and persist',async()=>{
  const s=await setup();await make(s.first,'Zoom Novel');let app=await launch(s.profile);
  try{
    let page=await app.firstWindow();await dialog(app,s.first);await page.getByRole('button',{name:'Open Project…',exact:true}).click();const prose=page.locator('[aria-label="Manuscript editor"]');await prose.click();await page.keyboard.type('Zoom never changes this prose.');
    const indicator=page.getByLabel('Application zoom');await expect(indicator).toHaveValue('100');for(const value of ['50','75','100','125','150','175','200']){await indicator.selectOption(value);await expect(indicator).toHaveValue(value);}await page.keyboard.press('Control+0');await expect(indicator).toHaveValue('100');
    await page.keyboard.press('Control+=');await expect(indicator).toHaveValue('105');await page.keyboard.press('Control+Shift+=');await expect(indicator).toHaveValue('110');await page.keyboard.press('Control+-');await expect(indicator).toHaveValue('105');await page.keyboard.press('Control+0');await expect(indicator).toHaveValue('100');
    await app.evaluate(({BrowserWindow})=>{const contents=BrowserWindow.getAllWindows()[0].webContents;contents.sendInputEvent({type:'keyDown',keyCode:'=',modifiers:['control']});contents.sendInputEvent({type:'keyUp',keyCode:'=',modifiers:['control']});});await expect(indicator).toHaveValue('105');await page.keyboard.press('Control+0');await expect(indicator).toHaveValue('100');
    await page.getByLabel('New document title').focus();await page.keyboard.press('Control+=');await expect(indicator).toHaveValue('105');
    await menu(app,'zoom-in');await expect(indicator).toHaveValue('110');await menu(app,'zoom-out');await expect(indicator).toHaveValue('105');await menu(app,'zoom-reset');await expect(indicator).toHaveValue('100');
    await menu(app,'zoom-in');await expect(indicator).toHaveValue('105');expect(await app.evaluate(({BrowserWindow})=>Math.round(BrowserWindow.getAllWindows()[0].webContents.getZoomFactor()*100))).toBe(105);await expect(prose).toHaveText('Zoom never changes this prose.');await quit(app);
    app=await launch(s.profile);page=await app.firstWindow();await expect(page.getByLabel('Application zoom')).toHaveValue('105');await page.keyboard.press('Control+0');await expect(page.getByLabel('Application zoom')).toHaveValue('100');await quit(app);
  }finally{await app.close().catch(()=>{});await fs.rm(s.base,{recursive:true,force:true});}
});

test('Draft Pages navigate one continuous document and restore scroll and cursor after switching and restart',async()=>{
  const s=await setup();await make(s.first,'Long Novel',true);let app=await launch(s.profile);
  try{
    let page=await app.firstWindow();await dialog(app,s.first);await page.getByRole('button',{name:'Open Project…',exact:true}).click();
    await page.getByLabel('Draft navigator').selectOption('pages');const rail=page.getByRole('region',{name:'Draft Pages'});await expect(rail).toBeVisible();await expect(page.getByRole('button',{name:'Draft Page 17',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Draft Page 17',exact:true}).click();await expect(page.getByRole('button',{name:'Draft Page 17',exact:true})).toHaveAttribute('aria-current','page');
    const pages=await page.locator('.draft-page-list button').count();await page.keyboard.press('Control+=');await expect.poll(()=>page.locator('.draft-page-list button').count()).toBeGreaterThan(pages);await page.keyboard.press('Control+0');await expect.poll(()=>page.locator('.draft-page-list button').count()).toBe(pages);
    await page.locator('.draft-page-list button').last().click();await expect(page.locator('.draft-page-list button').last()).toHaveAttribute('aria-current','page');
    await page.locator('.draft-scroll').evaluate(el=>el.scrollTo(0,0));await expect(page.getByRole('button',{name:'Draft Page 1',exact:true})).toHaveAttribute('aria-current','page');
    const paragraph=page.locator('[aria-label="Manuscript editor"] p').nth(50);await paragraph.click();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');
    let before=await page.locator('.draft-scroll').evaluate(el=>el.scrollTop);expect(before).toBeGreaterThan(1000);
    const visibleParagraph=()=>page.locator('.draft-scroll').evaluate(el=>{const top=el.getBoundingClientRect().top;return Array.from(el.querySelectorAll('.tiptap p')).findIndex(p=>p.getBoundingClientRect().bottom>top+15);});
    const visible=await visibleParagraph();await page.getByLabel('Draft navigator').selectOption('none');await expect.poll(visibleParagraph).toBe(visible);await page.getByLabel('Draft navigator').selectOption('pages');await expect.poll(visibleParagraph).toBe(visible);before=await page.locator('.draft-scroll').evaluate(el=>el.scrollTop);
    await page.getByLabel('New document title').fill('Short chapter');await page.getByRole('button',{name:'Add',exact:true}).click();await expect(page.locator('.page h1')).toHaveText('Short chapter');
    await page.getByRole('button',{name:/Chapter 1/}).click();await expect.poll(()=>page.locator('.draft-scroll').evaluate(el=>el.scrollTop)).toBeCloseTo(before,0);
    await page.getByRole('button',{name:'PUBLISH',exact:true}).click();await page.getByRole('button',{name:'Chapter 1 Chapter · Manuscript',exact:true}).click();await expect(page.getByRole('region',{name:'Draft Pages'})).toHaveCount(0);await expect(page.locator('.publication-draft-page')).toContainText('Paragraph 51.');await page.getByRole('button',{name:'WRITE',exact:true}).click();await expect.poll(()=>page.locator('.draft-scroll').evaluate(el=>el.scrollTop)).toBeCloseTo(before,0);
    await page.screenshot({path:'test-results/draft-pages.png'});await home(page);
    const manifest=JSON.parse(await fs.readFile(path.join(s.first,'project.pagehearth'),'utf8'));const id=manifest.nodes[0].id;const position=manifest.settings.workspace.positions[id];expect(position.scrollTop).toBeCloseTo(before,0);expect(position.anchor).toBeGreaterThan(1);
    const doc=JSON.parse(await fs.readFile(path.join(s.first,'manuscript',id+'.json'),'utf8'));expect(doc.content).toHaveLength(180);expect(JSON.stringify(doc)).not.toContain('Draft Page');expect((await fs.readdir(path.join(s.first,'manuscript'))).filter(n=>n.endsWith('.json'))).toHaveLength(2);
    await quit(app);app=await launch(s.profile);page=await app.firstWindow();await page.locator('.recent-open').filter({hasText:'Long Novel'}).click();await expect(page.getByLabel('Draft navigator')).toHaveValue('pages');await expect.poll(()=>page.locator('.draft-scroll').evaluate(el=>el.scrollTop)).toBeCloseTo(before,0);
    // Explicit entry restores selection without automatic focus theft.
    await page.keyboard.press('F6');
    expect(await page.evaluate(()=>document.querySelector('[aria-label="Manuscript editor"]')?.contains(window.getSelection()?.anchorNode ?? null))).toBe(true);
    await page.getByLabel('Draft navigator').selectOption('none');await expect(page.getByRole('region',{name:'Draft Pages'})).toHaveCount(0);await expect(page.locator('[aria-label="Manuscript editor"] p')).toHaveCount(180);await quit(app);
  }finally{await app.close().catch(()=>{});await fs.rm(s.base,{recursive:true,force:true});}
});

test('semantic indentation, ordinary Tab navigation, Ctrl-wheel and confirmed maintenance',async()=>{
  const s=await setup();await make(s.first,'Indent Novel');let app=await launch(s.profile);
  try{
    let page=await app.firstWindow();await dialog(app,s.first);await page.getByRole('button',{name:'Open Project…',exact:true}).click();const prose=page.getByRole('textbox',{name:'Manuscript editor'});
    const wrapped='A paragraph with semantic indentation. '+ 'Wrapped continuation lines stay at the normal left edge. '.repeat(12);
    await prose.fill(wrapped);await page.keyboard.press('Tab');await expect(prose.locator('p')).toHaveAttribute('data-indent','1');await expect(prose).toBeFocused();await page.keyboard.press('Tab');await expect(prose.locator('p')).toHaveAttribute('data-indent','2');await page.keyboard.press('Shift+Tab');await expect(prose.locator('p')).toHaveAttribute('data-indent','1');
    await prose.press('Shift+Tab');await expect(prose.locator('p')).not.toHaveAttribute('data-indent');await prose.press('Tab');await expect(prose.locator('p')).toHaveAttribute('data-indent','1');await expect(prose).toHaveText(wrapped);
    const geometry=await prose.locator('p').evaluate(p=>{const r=document.createRange();r.selectNodeContents(p);const rects=[...r.getClientRects()];const lines=rects.filter((r,i)=>i===0 || r.top>rects[i-1].top+1);const css=getComputedStyle(p);return {first:lines[0].left,second:lines[1].left,edge:p.getBoundingClientRect().left,indent:parseFloat(css.textIndent),margin:parseFloat(css.marginLeft),padding:parseFloat(css.paddingLeft)};});
    expect(geometry.first-geometry.second).toBeCloseTo(geometry.indent,0);expect(geometry.second).toBeCloseTo(geometry.edge,0);expect(geometry.margin).toBe(0);expect(geometry.padding).toBe(0);
    await page.keyboard.press('Escape');await expect(page.getByRole('toolbar',{name:'Editor commands'})).toBeFocused();await page.keyboard.press('F6');await expect(prose).toBeFocused();
    await page.keyboard.press('End');await page.keyboard.type(' History probe.');await menu(app,'edit-undo');await expect(prose).not.toContainText('History probe');await menu(app,'edit-redo');await expect(prose).toContainText('History probe');
    await page.keyboard.press('Escape');await page.getByRole('button',{name:'Redo',exact:true}).focus();await page.keyboard.press('Tab');await expect(prose).not.toBeFocused();
    await page.getByLabel('New document title').focus();await page.keyboard.press('Tab');await expect(page.getByLabel('Document type')).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(page.getByLabel('New document title')).toBeFocused();
    await prose.hover();await page.keyboard.down('Control');await page.mouse.wheel(0,-100);await page.keyboard.up('Control');await expect(page.getByLabel('Application zoom')).toHaveValue('105');await page.keyboard.down('Control');await page.mouse.wheel(0,100);await page.keyboard.up('Control');await expect(page.getByLabel('Application zoom')).toHaveValue('100');
    await page.getByRole('button',{name:'PUBLISH',exact:true}).click();await page.getByRole('button',{name:'Chapter 1 Chapter · Manuscript',exact:true}).click();await expect(page.locator('.publication-draft-page p')).not.toHaveAttribute('data-indent');await page.getByRole('button',{name:'WRITE',exact:true}).click();await expect(page.locator('.inspector')).not.toContainText('Rebuild Project Index');
    await app.evaluate(({dialog})=>{dialog.showMessageBox=async(...args:any[])=>{(globalThis as any).maintenanceDialog=args[1];return {response:0,checkboxChecked:false};};});await menu(app,'rebuild-index');await expect(page.getByRole('status').filter({hasText:'Index rebuild canceled.'})).toBeVisible();expect(await app.evaluate(()=> (globalThis as any).maintenanceDialog.detail)).toContain('does not delete or rewrite manuscript');await expect(fs.stat(path.join(s.first,'.storyloom','index.sqlite'))).rejects.toThrow();
    const manifest=JSON.parse(await fs.readFile(path.join(s.first,'project.pagehearth'),'utf8'));const file=path.join(s.first,'manuscript',manifest.nodes[0].id+'.json');const before=await fs.readFile(file,'utf8');expect(JSON.parse(before).content[0].attrs.indent).toBe(1);expect(before).not.toContain('\\t');
    await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1,checkboxChecked:false});});await menu(app,'rebuild-index');await expect(page.getByRole('status').filter({hasText:'Project index rebuilt'})).toBeVisible();expect(await fs.readFile(file,'utf8')).toBe(before);
    await quit(app);app=await launch(s.profile);page=await app.firstWindow();await page.locator('.recent-open').click();await expect(page.getByRole('textbox',{name:'Manuscript editor'}).locator('p')).toHaveAttribute('data-indent','1');await quit(app);
  }finally{await app.close().catch(()=>{});await fs.rm(s.base,{recursive:true,force:true});}
});

test('WRITE page stays centered within remaining workspace across panels, navigator, resize and zoom',async()=>{
  const s=await setup();await make(s.first,'Layout Novel',true);const app=await launch(s.profile);
  try{
    const page=await app.firstWindow();await dialog(app,s.first);await page.getByRole('button',{name:'Open Project…',exact:true}).click();
    const centered=async()=>{await expect.poll(()=>page.locator('.draft-scroll').evaluate(el=>{const a=el.getBoundingClientRect();const b=el.querySelector('.page')!.getBoundingClientRect();return Math.abs((a.left+el.clientWidth/2)-(b.left+b.width/2));})).toBeLessThan(2);expect(await page.locator('.draft-scroll .page').evaluate(el=>el.getBoundingClientRect().width)).toBeLessThanOrEqual(720);await expect.poll(()=>page.locator('.workspace').evaluate(el=>{const r=el.getBoundingClientRect();const main=el.querySelector('.writing')!.getBoundingClientRect();const panels=Array.from(el.children).filter(x=>x.tagName==='ASIDE').map(x=>x.getBoundingClientRect().width);return Math.abs(r.width-main.width-panels.reduce((a,b)=>a+b,0));})).toBeLessThan(2);const available=await page.locator('.draft-scroll').evaluate(el=>el.clientWidth);expect(await page.locator('.draft-scroll .page').evaluate(el=>el.getBoundingClientRect().width)).toBeCloseTo(Math.min(720,available-28),0);};
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(2400,1000));await centered();
    await page.getByRole('button',{name:'Toggle Inspector'}).click();await centered();await page.getByLabel('Draft navigator').selectOption('pages');await centered();const treeToggle=page.getByRole('button',{name:'Hide Story Tree',exact:true});if(await treeToggle.isVisible())await treeToggle.click();else{await page.getByRole('button',{name:'More editor actions',exact:true}).click();await page.getByRole('menuitem',{name:'Hide Story Tree',exact:true}).click();}await centered();await page.getByLabel('Draft navigator').selectOption('none');await centered();
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,850));await centered();await page.keyboard.press('Control+=');await expect(page.getByLabel('Application zoom')).toHaveValue('105');await centered();await page.keyboard.press('Control+0');await centered();await page.screenshot({path:'test-results/centered-write.png'});await quit(app);
  }finally{await app.close().catch(()=>{});await fs.rm(s.base,{recursive:true,force:true});}
});

