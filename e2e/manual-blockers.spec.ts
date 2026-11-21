import {test,expect,_electron as electron} from '@playwright/test';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {Store} from '../src/main/storage';

test('tree focus works from rows without Draft Pages; trash view, restore and backup give unambiguous results',async()=>{
  const base=await fs.mkdtemp(path.resolve('.acceptance/manual-blockers-'));
  const root=path.join(base,'Novel');await fs.mkdir(root);
  const store=new Store(root);await store.create('Manual blockers');
  const first=store.project.manifest.nodes[0].id;
  const second=crypto.randomUUID();const p=structuredClone(store.project);
  p.manifest.nodes.push({id:second,parent:null,kind:'Chapter',title:'Second'});
  p.documents[second]={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Second preserved prose.'}]}]};
  await store.commit(p);await store.release();
  const executablePath=process.env.PAGEHEARTH_EXECUTABLE;
  const app=await electron.launch({...(executablePath?{executablePath}:{}),args:[...(executablePath?[]:['.']),`--user-data-dir=${path.join(base,'profile')}`,path.join(root,'project.pagehearth')]});
  try{
    const page=await app.firstWindow();await expect(page.locator('.tree-row')).toHaveCount(2);
    await expect(page.getByLabel('Draft navigator')).toHaveValue('none');
    await page.locator('#tree-'+first).focus();
    await page.keyboard.press('ArrowDown');await expect(page.locator('#tree-'+second)).toBeFocused();
    await page.keyboard.press('Enter');await expect(page.locator('.page h1')).toHaveText('Second');
    await expect(page.locator('#tree-'+second)).toBeFocused();
    await page.keyboard.press('Home');await expect(page.locator('#tree-'+first)).toBeFocused();
    await page.keyboard.press('End');await expect(page.locator('#tree-'+second)).toBeFocused();
    await page.keyboard.press('Shift+F10');
    await expect(page.getByRole('menu',{name:'Actions for Second',exact:true})).toBeVisible();
    await expect(page.getByRole('menuitem',{name:'Delete permanently…'})).toHaveCount(0);
    await page.keyboard.press('Escape');await expect(page.locator('#tree-'+second)).toBeFocused();
    await page.locator('.tree-row').filter({hasText:'Chapter 1'}).press('Control+Space');
    await page.locator('#tree-'+second).click({button:'right'});
    await page.getByRole('menuitem',{name:'Rename',exact:true}).click();
    await page.getByLabel('Document name',{exact:true}).fill('Second renamed');
    await page.getByRole('button',{name:'Save name'}).click();
    await expect(page.locator('#tree-'+second)).toHaveText('Second renamed');
    await expect(page.locator('#tree-'+first)).toHaveText('Chapter 1');
    await page.locator('#tree-'+second).click({button:'right'});
    await page.getByRole('menuitem',{name:'Rename',exact:true}).click();
    await page.getByLabel('Document name',{exact:true}).fill('Second');await page.getByRole('button',{name:'Save name'}).click();
    await page.getByRole('button',{name:'View Trash',exact:true}).click();
    await expect(page.getByText('Trash is empty.',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Restore',exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:'Return to Story Tree',exact:true}).click();
    await expect(page.locator('.tree-row')).toHaveCount(2);
    await page.locator('.tree-row').filter({hasText:'Chapter 1'}).press('Control+Space');
    await page.locator('#tree-'+second).click({button:'right'});
    await page.getByRole('menuitem',{name:'Move to Trash',exact:true}).click();
    await expect(page.locator('.tree-row')).toHaveCount(1);
    await page.getByRole('button',{name:'View Trash',exact:true}).click();
    await page.locator('#tree-'+second).click({button:'right'});
    await expect(page.getByRole('menuitem',{name:'Move to Trash',exact:true})).toHaveCount(0);
    await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:0,checkboxChecked:false});});
    await page.getByRole('menuitem',{name:'Delete permanently…'}).click();
    await expect(page.locator('#tree-'+second)).toBeVisible();
    await page.locator('#tree-'+second).click({button:'right'});
    await page.getByRole('menuitem',{name:'Restore',exact:true}).click();
    await expect(page.getByRole('status').filter({hasText:'Restored'})).toBeVisible();
    await page.getByRole('button',{name:'Return to Story Tree',exact:true}).click();
    await page.locator('#tree-'+second).click();
    await expect(page.getByRole('textbox',{name:'Manuscript editor'})).toHaveText('Second preserved prose.');
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.send('app-command',{kind:'settings'}));await page.getByRole('button',{name:'Back up now',exact:true}).click();
    await expect(page.locator('.notice')).toContainText('Verified backup saved');
    for(const file of (await fs.readdir(path.join(root,'backups'))).filter(n=>n.endsWith('.zip')))await Store.verifyBackup(path.join(root,'backups',file));
    const manifest=JSON.parse(await fs.readFile(path.join(root,'project.pagehearth'),'utf8'));
    expect(manifest.nodes.map((n:any)=>n.id)).toEqual([first,second]);expect(manifest.nodes.every((n:any)=>!n.trashed)).toBe(true);
  }finally{await app.close(); /* Preserve disposable evidence, including failed runs. */}
});

test('tree drops reach final sibling slots and blank background clears only active row',async()=>{
  const base=await fs.mkdtemp(path.resolve('.acceptance/tree-slots-'));
  const root=path.join(base,'Novel');await fs.mkdir(root);
  const store=new Store(root);await store.create('Tree slots');
  const p=structuredClone(store.project);p.manifest.nodes=[];p.documents={};
  const ids=[store.project.manifest.nodes[0].id,crypto.randomUUID(),crypto.randomUUID()];
  for(const [index,title] of ['A','B','C'].entries()){
    p.manifest.nodes.push({id:ids[index],parent:null,kind:index===1?'Scene':'Chapter',title});
    p.documents[ids[index]]={type:'doc',content:[{type:'paragraph',attrs:{indent:index},content:[{type:'text',text:title+' preserved prose.'}]}]};
  }
  await store.commit(p);await store.release();
  const executablePath=process.env.PAGEHEARTH_EXECUTABLE;
  const launch=()=>electron.launch({...(executablePath?{executablePath}:{}),args:[...(executablePath?[]:['.']),`--user-data-dir=${path.join(base,'profile')}`,path.join(root,'project.pagehearth')]});
  let app=await launch();
  try{
    let page=await app.firstWindow();
    const row=(title:string)=>page.getByRole('button',{name:title,exact:true});
    const order=()=>page.locator('.tree-row').allTextContents();
    await expect.poll(order).toEqual(['A','B','C']);
    const drop=async(from:string,to:string,after:boolean)=>{
      const box=await row(to).boundingBox();
      await row(from).dragTo(row(to),{targetPosition:{x:40,y:after?box!.height-3:3}});
    };
    await drop('A','C',true);await expect.poll(order).toEqual(['B','C','A']);
    await drop('C','A',true);await expect.poll(order).toEqual(['B','A','C']);
    await drop('C','B',false);await expect.poll(order).toEqual(['C','B','A']);
    await drop('C','B',true);await expect.poll(order).toEqual(['B','C','A']);
    await row('A').click();await page.locator('.tree-row').filter({hasText:'B'}).press('Control+Space');
    const background=page.locator('.tree');
    // Right edge of the toolbar is empty background, outside any control.
    await background.click({position:{x:(await background.boundingBox())!.width-1,y:1}});
    await expect(page.locator('.tree-row.selected')).toHaveCount(0);
    await expect(background).toBeFocused();
    await expect(row('B')).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('.page h1')).toHaveText('A');
    await page.keyboard.press('Alt+ArrowUp');await page.keyboard.press('Alt+ArrowDown');
    await expect.poll(order).toEqual(['B','C','A']);
    await page.locator('.tree-row').filter({hasText:'B'}).press('Control+Space');
    await background.click({position:{x:(await background.boundingBox())!.width-1,y:1}});
    await expect(page.getByRole('button',{name:'Move to Trash',exact:true})).toHaveCount(0);
    await row('A').click();await expect(row('A')).toHaveClass(/selected/);
    await page.keyboard.press('Alt+ArrowUp');await expect.poll(order).toEqual(['B','A','C']);
    await drop('A','C',true);await expect.poll(order).toEqual(['B','C','A']);
    await app.close();app=await launch();page=await app.firstWindow();
    await expect.poll(order).toEqual(['B','C','A']);
    const disk=JSON.parse(await fs.readFile(path.join(root,'project.pagehearth'),'utf8'));
    expect(disk.nodes).toEqual([p.manifest.nodes[1],p.manifest.nodes[2],p.manifest.nodes[0]]);
    for(const id of ids)expect(JSON.parse(await fs.readFile(path.join(root,'manuscript',id+'.json'),'utf8'))).toEqual(p.documents[id]);
  }finally{await app.close();}
});
