// Actual GUI startup outside the checkout, with synthetic project/profile only.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{pathToFileURL}=require('node:url');
const { _electron:electron,expect }=require('@playwright/test');
(async()=>{
 const source=path.resolve(process.argv[2]),evidence=path.resolve(process.argv[3]);await fs.mkdir(evidence,{recursive:true});
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'PageHearth-startup-gui-')),runtime=path.join(root,'runtime');
 await fs.cp(source,runtime,{recursive:true});
 const {Store}=await import(pathToFileURL(path.resolve('dist-main/main/storage.js')).href),project=path.join(root,'Synthetic project');
 await fs.mkdir(project);const store=new Store(project);await store.create('Startup repair smoke');await store.release();
 const result={root,executable:path.join(runtime,'PageHearth.exe'),checks:[]};
 await fs.writeFile(path.join(evidence,'gui-location.json'),JSON.stringify(result,null,2));
 for(const open of [false,true]){
  let app;try{
   app=await electron.launch({executablePath:result.executable,cwd:root,args:[`--user-data-dir=${path.join(root,'profile')}`,...(open?[path.join(project,'project.pagehearth')]:[])],timeout:20000});
   const errors=[];app.process().stderr.on('data',b=>errors.push(b.toString()));
   const page=await app.firstWindow({timeout:15000});
   if(open)await expect(page.getByRole('textbox',{name:'Manuscript editor',exact:true})).toBeVisible({timeout:15000});
   else await expect(page.locator('.home-workspace')).toBeVisible({timeout:15000});
   await page.screenshot({path:path.join(evidence,open?'project.png':'home.png')});
   await page.waitForTimeout(1500);
   if(errors.join('').includes('ERR_MODULE_NOT_FOUND'))throw Error(errors.join(''));
   result.checks.push(open?'Project editor rendered':'Home rendered');
   await fs.writeFile(path.join(evidence,'gui-result.json'),JSON.stringify(result,null,2));
  }finally{if(app)await app.close();}
 }
 console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
