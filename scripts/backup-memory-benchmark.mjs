// Same immutable fixture, separate fresh process per sample; real Store/verify/protection paths.
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {Store} from '../dist-main/main/storage.js';
import {createResearchItem} from '../dist-main/shared/research.js';
import {createEntity} from '../dist-main/shared/worldBible.js';
const base=path.resolve('.acceptance/backup-memory-2026-09-29'),mode=process.argv[2],label=process.argv[3]||'control',mib=Number(process.argv[4]||96),fixture=path.join(base,'fixture-'+label);
const doc=text=>({type:'doc',content:[{type:'paragraph',content:[{type:'text',text}]}]});
async function inventory(root,rel=''){let out=[];for(const entry of await fs.readdir(path.join(root,rel),{withFileTypes:true})){if(!rel&&['.storyloom','backups'].includes(entry.name))continue;const name=path.join(rel,entry.name);if(entry.isDirectory())out.push(...await inventory(root,name));else{const bytes=await fs.readFile(path.join(root,name));out.push({name:name.replaceAll('\\','/'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')})}}return out.sort((a,b)=>a.name.localeCompare(b.name))}
if(mode==='prepare'){
  await fs.mkdir(base,{recursive:true});await fs.mkdir(fixture);const s=new Store(fixture);await s.create('Controlled Research backup');await fs.mkdir(path.join(fixture,'assets/research'),{recursive:true});
  for(let i=0;i<5;i++){const bytes=(i===0?mib:2)*1048576,h=await fs.open(path.join(fixture,`assets/research/source-${i}.bin`),'wx');try{for(let at=0;at<bytes;at+=65536)await h.writeFile(randomBytes(Math.min(65536,bytes-at)))}finally{await h.close()}}
  const external=path.join(base,'external-source.bin');await fs.writeFile(external,'External source must remain untouched');let p=createEntity(s.project,'character','Mina').project;p.documents[p.manifest.nodes[0].id]=doc('Controlled manuscript. '.repeat(2000));
  for(let i=0;i<750;i++)p=createResearchItem(p,{type:'file',title:`Source ${i}`,ownership:i%5===0?'external':'project',...(i%5===0?{externalPath:external}:{assetPath:`assets/research/source-${i%5}.bin`})}).project;
  await s.commit(p);await s.release();const files=await inventory(fixture);await fs.writeFile(path.join(base,`fixture-${label}.json`),JSON.stringify(files,null,2));console.log(JSON.stringify({fixture,files:files.length,ownedAssetBytes:files.filter(f=>f.name.startsWith('assets/')).reduce((n,f)=>n+f.bytes,0)}));
}else if(mode==='run'){
  const sample=process.argv[4]||'before',root=path.join(base,`${label}-${sample}`);await fs.mkdir(root);await fs.cp(fixture,root,{recursive:true,filter:src=>!['.storyloom','backups'].includes(path.relative(fixture,src).split(path.sep)[0])});
  await fs.mkdir(path.join(root,'.storyloom'));await fs.mkdir(path.join(root,'backups'));const expected=JSON.parse(await fs.readFile(path.join(base,`fixture-${label}.json`),'utf8'));assert.deepEqual(await inventory(root),expected);const s=new Store(root);await s.open();global.gc?.();await new Promise(r=>setTimeout(r,200));
  const baseline=process.memoryUsage().rss;let peak=baseline,last=performance.now(),maxGap=0,done=false,verifyMs=0;const protection=[];const originalVerify=Store.verifyBackup;Store.verifyBackup=async file=>{const at=performance.now();try{return await originalVerify(file)}finally{verifyMs+=performance.now()-at}};
  const timer=setInterval(()=>{peak=Math.max(peak,process.memoryUsage().rss);const now=performance.now();maxGap=Math.max(maxGap,now-last);last=now},5),id=s.project.manifest.nodes[0].id;let finalText='';
  const protect=(async()=>{while(!done){await new Promise(r=>setTimeout(r,20));if(done)break;finalText=`Protected while backup ${protection.length}`;const at=performance.now();await s.stageDocument(id,doc(finalText));protection.push(performance.now()-at)}})();
  const start=performance.now();let archive;try{archive=await s.backup()}finally{done=true;await protect;clearInterval(timer)}const backupMs=performance.now()-start,immediate=process.memoryUsage().rss;global.gc?.();await new Promise(r=>setTimeout(r,500));global.gc?.();const settled=process.memoryUsage().rss;
  const verifyStart=performance.now();await originalVerify(archive);const standaloneVerificationMs=performance.now()-verifyStart;await s.release();const reopened=new Store(root);await reopened.open(async()=>true);assert.equal(JSON.stringify(reopened.project.documents[id]),JSON.stringify(doc(finalText)));await reopened.release();
  const result={fixture:label,sample,fixtureDigest:createHash('sha256').update(JSON.stringify(expected)).digest('hex'),ownedAssetBytes:expected.filter(f=>f.name.startsWith('assets/')).reduce((n,f)=>n+f.bytes,0),fileCount:expected.length,archiveBytes:(await fs.stat(archive)).size,backupMs,verificationWithinBackupMs:verifyMs,standaloneVerificationMs,baselineRss:baseline,peakRss:peak,immediateRss:immediate,settledRss:settled,maxEventLoopGapMs:maxGap,protectedWrites:protection.length,maxProtectedWriteMs:Math.max(...protection),protectedWriteMs:protection,finalProtectedRecovered:true,status:'PASS'};
  await fs.mkdir('docs/acceptance',{recursive:true});await fs.writeFile(`docs/acceptance/2026-09-29-backup-${label}-${sample}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}else throw Error('Use prepare <fixture> <large-asset-MiB> or run <fixture> <sample>');
