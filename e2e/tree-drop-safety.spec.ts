import {test,expect,_electron as electron} from '@playwright/test';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {Store} from '../src/main/storage';
import {createTreeNode} from '../src/shared/treeCreation';

test('return/rejected drops do not save or enter recovery; valid group moves survive reopen',async()=>{
  const base=await fs.mkdtemp(path.resolve('.acceptance/tree-drop-safety-')),root=path.join(base,'Synthetic project');await fs.mkdir(root);
  const store=new Store(root);await store.create('Drop safety');
  const part=crypto.randomUUID(),folder=crypto.randomUUID(),chapter=crypto.randomUUID(),scene=crypto.randomUUID();
  let p=createTreeNode(store.project,'Part','Part',null,part);p=createTreeNode(p,'Folder','Folder',null,folder);p=createTreeNode(p,'Chapter','Chapter',part,chapter);p.author.scenes='available';p=createTreeNode(p,'Scene','Scene',chapter,scene);p.documents[chapter]={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Unchanged manuscript canary.'}]}]};await store.commit(p);await store.release();
  const executablePath=process.env.PAGEHEARTH_EXECUTABLE;
  const launch=()=>electron.launch({...(executablePath?{executablePath}:{}),args:[...(executablePath?[]:['.']),`--user-data-dir=${path.join(base,'profile')}`,path.join(root,'project.pagehearth')],timeout:20000});
  let app=await launch();
  try{
    const page=await app.firstWindow(),manifest=path.join(root,'project.pagehearth');await expect(page.locator('#tree-'+scene)).toBeVisible();
    await page.waitForTimeout(1500);
    const before=await fs.readFile(manifest,'utf8'),mtime=(await fs.stat(manifest)).mtimeMs;
    const drop=async(ids:string[],target:string,placement:'before'|'after'|'inside')=>{
      const transfer=await page.evaluateHandle(ids=>{const dt=new DataTransfer();dt.setData('text/plain',JSON.stringify(ids));return dt;},ids);
      const row=page.locator('#tree-'+target),box=(await row.boundingBox())!;
      await row.dispatchEvent('drop',{dataTransfer:transfer,clientY:placement==='before'?box.y+1:box.y+box.height-1,shiftKey:placement==='inside'});
      await transfer.dispose();
    };
    for(const id of [part,folder,chapter,scene])for(const placement of ['before','after'] as const)await drop([id],id,placement);
    await drop([part],part,'inside');await drop([part],scene,'inside');await drop([part],chapter,'before');
    await expect(page.getByRole('status').filter({hasText:'Cannot move into the selection'})).toBeVisible();
    const message=page.getByRole('status').filter({hasText:'Cannot move into the selection'});
    await page.waitForTimeout(3000);await drop([part],scene,'inside');await page.waitForTimeout(3000);
    await expect(message).toBeVisible(); // Identical rejection restarts the deadline.
    await page.getByRole('button',{name:'Dismiss Story Tree message',exact:true}).focus();await page.keyboard.press('Enter');await expect(message).toHaveCount(0);
    await drop([part],scene,'inside');await expect(message).toBeVisible();
    await expect(message).toHaveCount(0,{timeout:6500});
    await expect(page.locator('.error')).toHaveCount(0);await expect(page.locator('footer')).toContainText('Saved');
    await page.waitForTimeout(1500);expect(await fs.readFile(manifest,'utf8')).toBe(before);expect((await fs.stat(manifest)).mtimeMs).toBe(mtime);
    // Group cancellation preserves deliberate multi-selection and every canonical byte.
    await page.locator('#tree-'+part).press('Control+Space');await page.locator('#tree-'+folder).press('Control+Space');await page.waitForTimeout(1500);
    const groupBefore=await fs.readFile(manifest,'utf8');await drop([part,folder],folder,'after');await drop([part,folder],scene,'inside');
    await expect(page.locator('.tree-row.multi-selected')).toHaveCount(2);await page.waitForTimeout(1500);expect(await fs.readFile(manifest,'utf8')).toBe(groupBefore);await expect(page.locator('.error')).toHaveCount(0);
    // Same shared handler must still perform a valid Shift/drop, carrying subtrees.
    const rootChapter=p.manifest.nodes[0].id;await drop([part,folder],rootChapter,'inside');await expect(page.locator('footer')).toContainText('Saved');
    await expect.poll(async()=>JSON.parse(await fs.readFile(manifest,'utf8')).nodes.find((n:any)=>n.id===part).parent).toBe(rootChapter);
    await page.screenshot({path:path.join(base,'safe-drop.png')});await app.close();app=await launch();await expect((await app.firstWindow()).locator('#tree-'+scene)).toBeVisible();
    const reopened=new Store(root); // Inspect persisted content without opening a second locked Store.
    const saved=JSON.parse(await fs.readFile(manifest,'utf8'));expect(saved.nodes.find((n:any)=>n.id===folder).parent).toBe(rootChapter);expect(saved.nodes.find((n:any)=>n.id===chapter).parent).toBe(part);expect(saved.nodes.find((n:any)=>n.id===scene).parent).toBe(chapter);
    expect(JSON.parse(await fs.readFile(path.join(reopened.root,'manuscript',chapter+'.json'),'utf8'))).toEqual(p.documents[chapter]);
  }finally{await app.close();}
});
