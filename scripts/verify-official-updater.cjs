// SPDX-License-Identifier: MPL-2.0
// Isolated packaged-module checks. Synthetic transport; never opens a real browser.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const runtime=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]);fs.mkdirSync(out,{recursive:true});
const code=`const assert=require('node:assert/strict');const {pathToFileURL}=require('node:url');
const root=${JSON.stringify(runtime)};const path=require('node:path');const m=await import(pathToFileURL(path.join(root,'resources/app.asar/dist-main/main/updateAdapter.js')));
const {UpdateService}=await import(pathToFileURL(path.join(root,'resources/app.asar/dist-main/main/updateService.js')));
const {updateCapabilities}=await import(pathToFileURL(path.join(root,'resources/app.asar/dist-main/shared/updates.js')));
assert.equal(m.releaseApi,'https://api.github.com/repos/PageHearth/PageHearth/releases/latest');
const r={tag_name:'v1.0.0',draft:false,prerelease:false,html_url:'https://github.com/PageHearth/PageHearth/releases/tag/v1.0.0'};
let opened;const a=m.createUpdateAdapter('0.1.2',async url=>{opened=url;},async url=>{assert.equal(url,m.releaseApi);return new Response(JSON.stringify(r));});
assert.equal((await a.check()).version,'1.0.0');await a.open(await a.check(),'download');assert.equal(opened,r.html_url);
for(const bad of [{...r,draft:true},{...r,prerelease:true},{...r,tag_name:'v1.0.0-beta.1'},{...r,html_url:'https://github.com/ThatsHush/StoryLoom/releases/tag/v1.0.0'},{...r,html_url:r.html_url+'?x=y'}])assert.throws(()=>m.parseRelease(bad,'0.1.2'));
const service=new UpdateService(m.createUpdateAdapter('0.1.2',async()=>{throw Error('Unexpected browser');},async()=>new Response('',{status:404})),'0.1.2',updateCapabilities('win32',true),{read:()=>({automatic:false}),write:async()=>{}},()=>{});
await service.check();assert.equal(service.getState().phase,'noPublishedRelease');
console.log(JSON.stringify({packaged:true,transport:'synthetic',stable100:true,download:opened,rejectedUnsafe:true,http404:service.getState().phase,versions:process.versions}));`;
const result=execFileSync(path.join(runtime,'PageHearth.exe'),['--input-type=module','-e',code.replace("const assert=require('node:assert/strict');const {pathToFileURL}=require('node:url');","import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';").replace("const path=require('node:path');","const path=await import('node:path');")],{cwd:out,env:{...process.env,ELECTRON_RUN_AS_NODE:'1',NODE_PATH:''},encoding:'utf8',timeout:30000,windowsHide:true});
fs.writeFileSync(path.join(out,'packaged-updater.json'),result);console.log(result);
