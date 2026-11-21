import {test,expect,_electron as electron} from '@playwright/test';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {Store} from '../src/main/storage';
import {createTreeNode} from '../src/shared/treeCreation';

test('center and edge moves, keyboard destination dialog and grouped root moves persist',async()=>{
 const base=await fs.mkdtemp(path.resolve('.acceptance/tree-moving-')),root=path.join(base,'Project');await fs.mkdir(root);
 const store=new Store(root);await store.create('Moving');const part=crypto.randomUUID(),folder=crypto.randomUUID(),chapter=crypto.randomUUID(),scene=crypto.randomUUID();
 let p=createTreeNode(store.project,'Part','Part',null,part);p=createTreeNode(p,'Folder','Folder',null,folder);p=createTreeNode(p,'Chapter','Chapter',null,chapter);p.author.scenes='available';p=createTreeNode(p,'Scene','Scene',chapter,scene);p.documents[chapter]={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Moving preserves this prose.'}]}]};p.manifest.settings.workspace.collapsed=[part,folder];await store.commit(p);await store.release();
 const executablePath=process.env.PAGEHEARTH_EXECUTABLE,launch=()=>electron.launch({...(executablePath?{executablePath}:{}),args:[...(executablePath?[]:['.']),`--user-data-dir=${path.join(base,'profile')}`,path.join(root,'project.pagehearth')],timeout:20000});let app=await launch();
 try{
 const page=await app.firstWindow(),row=(id:string)=>page.locator('#tree-'+id),saved=async()=>JSON.parse(await fs.readFile(path.join(root,'project.pagehearth'),'utf8'));
 await expect(row(chapter)).toBeVisible();
 const drop=async(ids:string[],target:string,fraction:number,expected:string)=>{
 const dt=await page.evaluateHandle(ids=>{const d=new DataTransfer();d.setData('text/plain',JSON.stringify(ids));return d;},ids);await row(ids[0]).dispatchEvent('dragstart',{dataTransfer:dt});const box=(await row(target).boundingBox())!,event={dataTransfer:dt,clientY:box.y+box.height*fraction};await row(target).dispatchEvent('dragover',event);await expect(row(target)).toHaveAttribute('data-drop',expected);await page.screenshot({path:path.join(base,`hint-${expected}.png`)});await row(target).dispatchEvent('drop',event);await dt.dispose();
 };
 await drop([chapter],part,.5,'inside');await expect.poll(async()=>(await saved()).nodes.find((n:any)=>n.id===chapter).parent).toBe(part);await expect(row(scene)).toBeVisible();await expect(row(chapter)).toBeFocused();
 await drop([chapter],folder,.05,'before');await expect.poll(async()=>(await saved()).nodes.find((n:any)=>n.id===chapter).parent).toBeNull();
 await drop([chapter],folder,.95,'after');await expect.poll(async()=>{const ns=(await saved()).nodes.filter((n:any)=>n.parent===null);return ns.findIndex((n:any)=>n.id===chapter)>ns.findIndex((n:any)=>n.id===folder);}).toBe(true);
 const openMove=async(id:string)=>{await row(id).press('Shift+F10');const item=page.getByRole('menuitem',{name:'Move to…',exact:true});for(let i=0;i<6&&!(await item.evaluate(e=>e===document.activeElement));i++)await page.keyboard.press('ArrowDown');await expect(item).toBeFocused();await page.keyboard.press('Enter');await expect(page.getByRole('dialog',{name:'Move documents'})).toBeVisible();};
 await openMove(chapter);const select=page.getByLabel('Move destination');await expect(select.locator(`option[value="${chapter}"]`)).toHaveCount(0);await expect(select.locator(`option[value="${scene}"]`)).toHaveCount(0);await select.selectOption(folder);await page.getByRole('button',{name:'Move',exact:true}).press('Enter');await expect(page.getByRole('dialog')).toHaveCount(0);await expect.poll(async()=>(await saved()).nodes.find((n:any)=>n.id===chapter).parent).toBe(folder);await expect(row(scene)).toBeVisible();
 await row(chapter).press('Control+Space');await row(part).press('Control+Space');await openMove(chapter);await expect(select).toHaveValue('');await page.getByRole('button',{name:'Move',exact:true}).press('Enter');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.tree-row.multi-selected')).toHaveCount(2);await expect.poll(async()=>(await saved()).nodes.find((n:any)=>n.id===chapter).parent).toBeNull();await expect(page.locator('.error')).toHaveCount(0);
 await app.close();app=await launch();await expect((await app.firstWindow()).locator('#tree-'+scene)).toBeVisible();const result=await saved();expect(result.nodes.find((n:any)=>n.id===scene).parent).toBe(chapter);expect(result.nodes.find((n:any)=>n.id===part).parent).toBeNull();expect(JSON.parse(await fs.readFile(path.join(root,'manuscript',chapter+'.json'),'utf8'))).toEqual(p.documents[chapter]);
 }finally{await app.close();}
});
