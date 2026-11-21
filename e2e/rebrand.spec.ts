import {test,expect,_electron as electron} from '@playwright/test';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {Store} from '../src/main/storage';

test('PageHearth hero, manifest picker, file launch and second-instance migration preserve work',async()=>{
  const base=await fs.mkdtemp(path.join(os.tmpdir(),'pagehearth-brand-'));const profile=path.join(base,'profile');const root=path.join(base,'Current');const legacy=path.join(base,'Legacy');await fs.mkdir(root);const store=new Store(root);await store.create('Current project');await store.release();
  await fs.cp('tests/fixtures/legacy-storyloom',legacy,{recursive:true});await fs.mkdir(path.join(legacy,'.storyloom'));await fs.mkdir(path.join(legacy,'backups'));
  const executablePath=process.env.PAGEHEARTH_EXECUTABLE;const args=[...(executablePath?[]:['.']),`--user-data-dir=${profile}`];
  const app=await electron.launch({...(executablePath?{executablePath}:{}),args:[...args,path.join(root,'project.pagehearth')]});
  try{
    if(executablePath){
      const icon=path.join(path.dirname(path.resolve(executablePath)),'resources','branding','PageHearth_App_Icon.ico');
      expect(await fs.readFile(icon)).toEqual(await fs.readFile('assets/branding/pagehearth/PageHearth_App_Icon.ico'));
      const runtime=await app.evaluate(({app,nativeImage},icon)=>{
        const image=nativeImage.createFromPath(icon);
        return {packaged:app.isPackaged,empty:image.isEmpty(),size:image.getSize()};
      },icon);
      expect(runtime.packaged).toBe(true);expect(runtime.empty).toBe(false);expect(runtime.size.width).toBeGreaterThan(0);
    }
    const page=await app.firstWindow();await expect(page).toHaveTitle('PageHearth · Current project');
    await page.getByRole('textbox',{name:'Manuscript editor'}).fill('Flush before shell switch.');
    const exe=await app.evaluate(()=>process.execPath);
    const child=spawn(exe,[...args,path.join(legacy,'storyloom.project.json')],{stdio:'ignore'});await new Promise<void>((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Second instance exited '+code)));});
    await expect(page).toHaveTitle('PageHearth · Legacy 世界 Novel');expect(await fs.readFile(path.join(legacy,'project.pagehearth'),'utf8')).toContain('Legacy 世界 Novel');
    const manifest=JSON.parse(await fs.readFile(path.join(root,'project.pagehearth'),'utf8'));expect(await fs.readFile(path.join(root,'manuscript',manifest.nodes[0].id+'.json'),'utf8')).toContain('Flush before shell switch.');
    await page.getByRole('button',{name:'PageHearth Home'}).click();await expect(page.locator('.recent-projects')).toContainText('Legacy 世界 Novel');
    const hero=page.locator('.welcome-hero');await expect(hero).toBeVisible();expect(await hero.evaluate((img:HTMLImageElement)=>img.complete && img.naturalWidth>img.naturalHeight)).toBe(true);
    expect(await page.locator('.shell-home img').getAttribute('src')).toContain('PageHearth_Wordmark_Nav');expect(await hero.getAttribute('src')).toContain('PageHearth_Hero_Wordmark');
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(850,600));
    for(const factor of [0.5,1,2]){await app.evaluate(({BrowserWindow},factor)=>BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(factor),factor);await page.getByRole('button',{name:'Open Project…',exact:true}).scrollIntoViewIfNeeded();await expect(page.getByRole('button',{name:'Open Project…',exact:true})).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);const sizes=await hero.evaluate((img:HTMLImageElement)=>({w:img.clientWidth,h:img.clientHeight,nw:img.naturalWidth,nh:img.naturalHeight,fit:getComputedStyle(img).objectFit}));expect(sizes.fit).toBe('contain');}
    await app.evaluate(({BrowserWindow})=>{BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1);BrowserWindow.getAllWindows()[0].setSize(1320,880);});await hero.scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/pagehearth-home.png'});
    await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async(...args:any[])=>{(globalThis as any).picker=args[1];return {canceled:false,filePaths:[file]};};},path.join(root,'project.pagehearth'));
    await page.getByRole('button',{name:'Open Project…',exact:true}).click();await expect(page).toHaveTitle('PageHearth · Current project');expect(await app.evaluate(()=>(globalThis as any).picker.filters[0].extensions)).toEqual(['pagehearth']);
    await page.getByRole('button',{name:'PageHearth Home'}).click();const closed=app.waitForEvent('close');await app.evaluate(({BrowserWindow})=>{setTimeout(()=>BrowserWindow.getAllWindows()[0].close(),20);});await closed;
  }finally{await app.close().catch(()=>{});await fs.rm(base,{recursive:true,force:true});}
});
