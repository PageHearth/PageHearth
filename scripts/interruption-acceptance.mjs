// Real process termination at deterministic storage boundaries, using disposable projects only.
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {Store} from '../dist-main/main/storage.js';
const doc=text=>({type:'doc',content:[{type:'paragraph',content:[{type:'text',text}]}]});
if(process.argv[2]==='--child'){
  const [, , ,root,phase]=process.argv;const store=new Store(root);await store.open();const id=store.project.manifest.nodes[0].id;
  const signal=()=>{process.send('ready');return new Promise(()=>{});};
  if(phase==='draft'){await store.stageDocument(id,doc('Protected before process termination'));await signal();}
  else if(phase==='streamed-backup'){
    const open=fs.open.bind(fs);let writes=0;
    fs.open=async(...args)=>{const h=await open(...args);if(String(args[0]).includes('.zip.')&&args[1]==='wx'){const write=h.writeFile.bind(h);h.writeFile=async(...values)=>{if(++writes===3){await store.stageDocument(id,doc('Protected during interrupted archive'));return signal();}return write(...values);};}return h;};
    await store.backup();
  }
  else{
    const rename=fs.rename.bind(fs);fs.rename=async(a,b)=>{if((phase==='save' && String(b).endsWith('project.pagehearth')) || (phase==='backup' && String(b).endsWith('.zip')))return signal();return rename(a,b);};
    if(phase==='save'){const p=structuredClone(store.project);p.documents[id]=doc('Journal survives process termination');await store.commit(p);}else await store.backup();
  }
}else{
  const base=await fs.mkdtemp(path.join(os.tmpdir(),'pagehearth-interruption-'));const results=[];
  try{
    for(const phase of ['draft','save','backup','streamed-backup']){
      const root=path.join(base,phase);await fs.mkdir(root);let store=new Store(root);await store.create('Interruption '+phase);await store.close();
      const child=fork(fileURLToPath(import.meta.url),['--child',root,phase],{stdio:['ignore','ignore','pipe','ipc']});
      try{await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Interruption boundary timed out')),20000);child.once('message',()=>{clearTimeout(timeout);resolve();});child.once('error',e=>{clearTimeout(timeout);reject(e);});child.once('exit',code=>{clearTimeout(timeout);reject(Error('Child exited before boundary: '+code));});});}
      finally{const ended=new Promise(r=>child.once('exit',r));child.kill('SIGKILL');await ended;}
      store=new Store(root);await store.open(async()=>true);const text=JSON.stringify(store.project.documents);
      if(phase==='draft')assert.match(text,/Protected before process termination/);
      if(phase==='streamed-backup')assert.match(text,/Protected during interrupted archive/);
      if(phase==='save')assert.match(text,/Journal survives process termination/);
      await store.close();for(const name of await fs.readdir(path.join(root,'backups')))if(name.endsWith('.zip'))await Store.verifyBackup(path.join(root,'backups',name));
      results.push({phase,result:'PASS',projectPreserved:true,lockRecovered:true});
    }
    console.log(JSON.stringify(results,null,2));await fs.mkdir('.acceptance',{recursive:true});await fs.writeFile('.acceptance/interruption-latest.json',JSON.stringify(results,null,2));
  }finally{await fs.rm(base,{recursive:true,force:true});}
}
