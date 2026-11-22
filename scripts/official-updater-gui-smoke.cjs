// SPDX-License-Identifier: MPL-2.0
// Actual packaged GUI with disposable project/profile; not an installed-version upgrade claim.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const {chromium,expect}=require('@playwright/test');
const {spawn}=require('node:child_process');
(async()=>{
 const old=path.resolve(process.argv[2]),next=path.resolve(process.argv[3]),evidence=path.resolve(process.argv[4]);await fs.mkdir(evidence,{recursive:true});
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'PageHearth-official-updater-')),profile=path.join(root,'profile'),project=path.join(root,'Synthetic project');await fs.mkdir(profile);await fs.mkdir(project);
 await fs.writeFile(path.join(profile,'settings.json'),JSON.stringify({version:1,zoomPercent:100,recentProjects:[],updates:{automatic:false,lastCheck:12345}}));
 const {Store}=await import(pathToFileURL(path.resolve('dist-main/main/storage.js')).href);const store=new Store(project);await store.create('Updater preservation fixture');await store.release();
 const canary='Official repository update preservation canary.';const checks=[];
 for(const [name,exe]of [['before',old],['after',next]]){
  let app,child;try{const port=name==='before'?19461:19462;child=spawn(exe,[`--user-data-dir=${profile}`,`--remote-debugging-port=${port}`,path.join(project,'project.pagehearth')],{cwd:root,windowsHide:true,stdio:'ignore'});
   const deadline=Date.now()+20000;while(Date.now()<deadline){try{const res=await fetch(`http://127.0.0.1:${port}/json/version`);if(res.ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
   app=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);const page=app.contexts()[0].pages()[0];const editor=page.getByRole('textbox',{name:'Manuscript editor',exact:true});await expect(editor).toBeVisible({timeout:20000});
   if(name==='before'){await editor.fill(canary);await editor.press('Control+s');await page.waitForTimeout(2500);}else await expect(editor).toContainText(canary);
   await page.screenshot({path:path.join(evidence,name+'.png')});checks.push(name+' packaged editor rendered');
  }finally{if(app)await app.close();if(child){child.kill();await new Promise(r=>setTimeout(r,500));}}
  const prefs=JSON.parse(await fs.readFile(path.join(profile,'settings.json'),'utf8'));assert.equal(prefs.updates.automatic,false);assert.equal(prefs.updates.lastCheck,12345);checks.push(name+' update preferences preserved');
 }
 await fs.writeFile(path.join(evidence,'gui-result.json'),JSON.stringify({root,checks,manuscriptReopened:true,installedUpgrade:false,executables:[old,next]},null,2));console.log(JSON.stringify({checks,manuscriptReopened:true,installedUpgrade:false}));
})().catch(e=>{console.error(e);process.exitCode=1;});
