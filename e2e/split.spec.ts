import {test,expect,_electron as electron} from '@playwright/test';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Store} from '../src/main/storage';

test('Split views mirror one canonical body, route locked navigation and preserve layout on reopen',async()=>{
 const base=await fs.mkdtemp(path.join(os.tmpdir(),'pagehearth-split-native-')),root=path.join(base,'Project');await fs.mkdir(root);
 const store=new Store(root);await store.create('Split native');const project=structuredClone(store.project),a=project.manifest.nodes[0].id,b=crypto.randomUUID();project.manifest.nodes.push({id:b,parent:null,kind:'Chapter',title:'Second chapter'});project.documents[b]={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Second document'}]}]};await store.commit(project);await store.release();
 const launch=()=>electron.launch({...(process.env.PAGEHEARTH_EXECUTABLE?{executablePath:process.env.PAGEHEARTH_EXECUTABLE}:{}),args:[...(process.env.PAGEHEARTH_EXECUTABLE?[]:['.']),`--user-data-dir=${path.join(base,'profile')}`,path.join(root,'project.pagehearth')]});
 let app=await launch();
 try{
  const page=await app.firstWindow();await expect(page.locator('.editor-pane')).toHaveCount(1);
  await page.getByRole('button',{name:'Editor layout: Single Editor. Switch to Side by Side.'}).click();await expect.poll(()=>app.evaluate(({Menu})=>Menu.getApplicationMenu()!.items.find(x=>x.label==='View')!.submenu!.items.find(x=>x.label==='Editor Layout')!.submenu!.items.find(x=>x.label==='Split Side by Side')!.checked)).toBe(true);
  await expect(page.locator('.editor-pane')).toHaveCount(2);await page.locator('[data-pane="b"] .tiptap').click();await page.keyboard.type('Shared canonical words');await expect(page.locator('[data-pane="a"] .tiptap')).toContainText('Shared canonical words');
  await page.locator('[data-pane="b"]').getByRole('button',{name:'Lock editor pane',exact:true}).click();await page.locator('#tree-'+b).click();await expect(page.locator('[data-pane="a"] .tiptap')).toContainText('Second document');await expect(page.locator('[data-pane="b"] .tiptap')).toContainText('Shared canonical words');
  await page.keyboard.press('Control+s');await expect(page.locator('.app-status')).toContainText('Saved');await app.close();app=await launch();await expect((await app.firstWindow()).locator('.editor-pane')).toHaveCount(2);
 }finally{await app.close();}
 const reopened=new Store(root);try{await reopened.open();expect(JSON.stringify(reopened.project.documents[a])).toContain('Shared canonical words');expect(Object.keys(reopened.project.documents)).toHaveLength(2);}finally{await reopened.release();}
 // Retain the disposable project as native evidence; never remove an unknown path.
});
