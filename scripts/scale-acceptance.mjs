// Disposable large-project storage exercise. Run after npm run build.
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,randomBytes} from 'node:crypto';
import {Store} from '../dist-main/main/storage.js';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'pagehearth-scale-'));
let store=new Store(root);const report={words:157500,documents:350,referenceFiles:200,assetBytes:64*1024*1024,saveMs:[],backupMs:[],reopenMs:[],maxEventLoopDelayMs:0};
let last=performance.now();const timer=setInterval(()=>{const now=performance.now();report.maxEventLoopDelayMs=Math.max(report.maxEventLoopDelayMs,now-last-10);last=now;},10);
try{
  await store.create('Scale acceptance');const p=structuredClone(store.project);p.manifest.nodes=[];p.documents={};
  for(let i=0;i<350;i++){const id=i===0?store.project.manifest.nodes[0].id:randomUUID();p.manifest.nodes.push({id,parent:null,title:`Scene ${i+1}`,kind:'Scene'});p.documents[id]={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:('word '.repeat(449)+'end')}]}]};}
  await store.commit(p);
  for(let i=0;i<64;i++)await fs.writeFile(path.join(root,'assets',`asset-${i}.bin`),randomBytes(1024*1024));
  for(let i=0;i<200;i++)await fs.writeFile(path.join(root,'research',`reference-${i}.json`),JSON.stringify({title:`Reference ${i}`,notes:'Local research data',related:p.manifest.nodes[i].id}));
  for(let i=0;i<10;i++){const next=structuredClone(store.project);next.documents[next.manifest.nodes[i].id].content[0].content[0].text+=' edited';const start=performance.now();await store.commit(next);report.saveMs.push(Math.round(performance.now()-start));}
  for(let i=0;i<3;i++){const start=performance.now();await store.backup();report.backupMs.push(Math.round(performance.now()-start));}
  for(let i=0;i<3;i++){await store.close();const start=performance.now();store=new Store(root);await store.open();report.reopenMs.push(Math.round(performance.now()-start));if(store.project.manifest.nodes.length!==350)throw Error('Scene loss');}
  await store.close();await new Promise(r=>setTimeout(r,20));report.maxEventLoopDelayMs=Math.round(report.maxEventLoopDelayMs);
  await fs.mkdir('.acceptance',{recursive:true});await fs.writeFile('.acceptance/scale-latest.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{clearInterval(timer);await store.release().catch(()=>{});await fs.rm(root,{recursive:true,force:true});}
