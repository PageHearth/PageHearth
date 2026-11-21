import {test,expect,_electron as electron} from '@playwright/test';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {Store} from '../src/main/storage';
for(const surface of ['Research','Collections','World Bible'])test(`${surface} creation contains keyboard focus and restores it on Escape`,async()=>{
 await fs.mkdir('.acceptance/phase2-hardening',{recursive:true});
 const base=await fs.mkdtemp(path.resolve('.acceptance/phase2-hardening/modal-')),root=path.join(base,'Novel');
 await fs.mkdir(root);const store=new Store(root);await store.create('Keyboard acceptance');await store.release();
 const exe=process.env.PAGEHEARTH_EXECUTABLE,app=await electron.launch({...(exe?{executablePath:exe}:{}),args:[...(exe?[]:['.']),`--user-data-dir=${path.join(base,'profile')}`,path.join(root,'project.pagehearth')]});
 try{
  const page=await app.firstWindow();await expect(page).toHaveTitle('PageHearth · Keyboard acceptance');
  await app.evaluate(({BrowserWindow},kind)=>BrowserWindow.getAllWindows()[0].webContents.send('app-command',{kind}),`open-${surface.toLowerCase().replace(' ','-')}`);
  if(surface==='World Bible')await page.getByRole('button',{name:/Characters People/}).click();
  const trigger=page.getByRole('button',{name:surface==='Research'?'New Text Research':surface==='Collections'?'+ Create':'+ New Character',exact:true});
  await trigger.click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  for(const key of ['Tab','Shift+Tab'])for(let i=0;i<12;i++){await page.keyboard.press(key);expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);}
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
  await page.evaluate(()=>window.pagehearth.zoom(200));await trigger.click();await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return r.width<=innerWidth&&r.height<=innerHeight;})).toBe(true);
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 }finally{await app.close();}
});
