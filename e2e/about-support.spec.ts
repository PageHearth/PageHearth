import {test,expect,_electron as electron} from '@playwright/test';
import {mkdtemp,mkdir} from 'node:fs/promises';
import path from 'node:path';

test('About support opens externally only on activation, with keyboard access and retry feedback',async()=>{
 await mkdir('.acceptance/about-support',{recursive:true});
 const base=await mkdtemp(path.resolve('.acceptance/about-support/gui-'));
 const executablePath=process.env.PAGEHEARTH_EXECUTABLE;
 const app=await electron.launch({...(executablePath?{executablePath}:{}),args:[...(executablePath?[]:['.']),`--user-data-dir=${path.join(base,'profile')}`],timeout:20000});
 try{
  const page=await app.firstWindow();await expect(page.getByRole('button',{name:'Restore Backup from ZIP…',exact:true})).toBeVisible();
  await app.evaluate(({shell,Menu,BrowserWindow})=>{
   const g=globalThis as any;g.supportCalls=[];g.supportFail=false;
   shell.openExternal=async(url:string)=>{g.supportCalls.push(url);if(g.supportFail)throw Error('Synthetic browser failure');};
   Menu.getApplicationMenu()!.getMenuItemById('about')!.click(undefined as any,BrowserWindow.getAllWindows()[0],{} as any);
  });
  const dialog=page.getByRole('dialog',{name:'About PageHearth',exact:true});await expect(dialog).toBeVisible();
  const link=dialog.getByRole('link',{name:'Support PageHearth on Ko-fi'});await expect(link).toHaveAttribute('href','https://ko-fi.com/pagehearth');
  const icon=link.locator('img');await expect(icon).toHaveAttribute('alt','');
  await expect.poll(()=>icon.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
  expect(await icon.evaluate((img:HTMLImageElement)=>new URL(img.currentSrc).protocol)).toMatch(/^(file:|data:)$/);
  expect(await icon.evaluate(img=>img.getBoundingClientRect().width)).toBe(20);
  expect(await app.evaluate(()=>(globalThis as any).supportCalls)).toEqual([]);
  const before=page.url();await link.focus();await page.keyboard.press('Enter');
  await expect.poll(()=>app.evaluate(()=>(globalThis as any).supportCalls)).toEqual(['https://ko-fi.com/pagehearth']);expect(page.url()).toBe(before);await expect(dialog).toBeVisible();
  await app.evaluate(()=>{(globalThis as any).supportFail=true;});await link.click();await expect(dialog.getByRole('alert')).toContainText('Your browser could not be opened');
  await app.evaluate(()=>{(globalThis as any).supportFail=false;});await icon.click();await expect(dialog.getByRole('alert')).toHaveCount(0);
  await page.screenshot({path:path.join(base,'about-support.png')});
 }finally{await app.close();}
});
