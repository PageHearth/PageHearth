import {test,expect,_electron as electron} from '@playwright/test';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {Store} from '../src/main/storage';
import {createTreeNode} from '../src/shared/treeCreation';

test('parent-aware creation uses active tree context, explicit root and persisted reveal',async()=>{
  const base=await fs.mkdtemp(path.resolve('.acceptance/tree-creation-')),root=path.join(base,'Synthetic project');await fs.mkdir(root);
  const store=new Store(root);await store.create('Parent-aware creation');
  const part=crypto.randomUUID(),folder=crypto.randomUUID();let p=createTreeNode(store.project,'Part','Part One',null,part);p=createTreeNode(p,'Folder','Notes folder',part,folder);p.author.scenes='available';p.manifest.settings.workspace.collapsed=[part];await store.commit(p);await store.release();
  const executablePath=process.env.PAGEHEARTH_EXECUTABLE;
  const launch=()=>electron.launch({...(executablePath?{executablePath}:{}),args:[...(executablePath?[]:['.']),`--user-data-dir=${path.join(base,'profile')}`,path.join(root,'project.pagehearth')],timeout:20000});
  let app=await launch();
  try{
    const page=await app.firstWindow();await expect(page.locator('#tree-'+part)).toBeVisible();
    const start=async(kind:string)=>{await page.getByRole('button',{name:'Add Chapter or Scene',exact:true}).click();await page.getByRole('menuitem',{name:'New '+kind,exact:true}).click();};
    const add=async(title:string)=>{await page.getByLabel('New document title',{exact:true}).fill(title);await page.getByRole('button',{name:'Add',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:title,exact:true})).toBeVisible();};
    await page.locator('#tree-'+part).click();await start('Chapter');await expect(page.getByLabel('Creation destination')).toHaveValue(part);await add('Nested chapter');
    await start('Scene');await add('Nested scene');
    await page.locator('#tree-'+folder).click();await start('Chapter');await expect(page.getByLabel('Creation destination')).toHaveValue(folder);await add('Folder chapter');
    await page.locator('#tree-'+part).click();await start('Chapter');await page.getByLabel('Creation destination').selectOption('');await add('Explicit root');
    // Keyboard focus, without Enter selection, is the creation context too.
    await page.locator('#tree-'+part).focus();await page.keyboard.press('ArrowDown');await start('Folder');await expect(page.getByLabel('Creation destination')).toHaveValue(folder);await add('Nested folder');
    await page.screenshot({path:path.join(base,'created.png')});await app.close();
    app=await launch();const reopened=await app.firstWindow();await expect(reopened.getByRole('button',{name:'Nested chapter',exact:true})).toBeVisible();await expect(reopened.getByRole('button',{name:'Folder chapter',exact:true})).toBeVisible();
    const manifest=JSON.parse(await fs.readFile(path.join(root,'project.pagehearth'),'utf8')),node=(title:string)=>manifest.nodes.find((n:any)=>n.title===title);
    expect(node('Nested chapter').parent).toBe(part);expect(node('Nested scene').parent).toBe(node('Nested chapter').id);expect(node('Folder chapter').parent).toBe(folder);expect(node('Explicit root').parent).toBeNull();expect(node('Nested folder').parent).toBe(folder);
  }finally{await app.close();}
});
