// Asset-heavy storage acceptance; owned disposable folder only.
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {Store} from '../dist-main/main/storage.js';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'pagehearth-assets-'));const store=new Store(root);
const report={assetMiB:256,files:32,baselineRssMiB:0,peakRssMiB:0,maxEventLoopGapMs:0,backupMs:0,protectionMs:[]};let last=performance.now();
const timer=setInterval(()=>{const now=performance.now();report.maxEventLoopGapMs=Math.max(report.maxEventLoopGapMs,now-last);last=now;report.peakRssMiB=Math.max(report.peakRssMiB,process.memoryUsage().rss/1048576);},10);
try{await store.create('Asset-heavy acceptance');for(let i=0;i<32;i++)await fs.writeFile(path.join(root,'assets',`asset-${i}.bin`),randomBytes(8*1048576));report.baselineRssMiB=process.memoryUsage().rss/1048576;const id=store.project.manifest.nodes[0].id;
for(let i=0;i<20;i++){const start=performance.now();await store.stageDocument(id,{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Protection sample '+i}]}]});report.protectionMs.push(performance.now()-start);}
const start=performance.now();await store.backup();report.backupMs=performance.now()-start;await store.release();for(const key of ['baselineRssMiB','peakRssMiB','maxEventLoopGapMs','backupMs'])report[key]=Math.round(report[key]);report.protectionMs=report.protectionMs.map(n=>Math.round(n*100)/100);await fs.mkdir('.acceptance',{recursive:true});await fs.writeFile('.acceptance/asset-heavy-latest.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{clearInterval(timer);await store.release().catch(()=>{});await fs.rm(root,{recursive:true,force:true});}
