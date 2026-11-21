import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {randomBytes} from 'node:crypto';
import {Store} from '../dist-main/main/storage.js';
import {createResearchItem,researchSearch,updateResearchItem} from '../dist-main/shared/research.js';

const base=await fs.mkdtemp(path.join(os.tmpdir(),'pagehearth-research-scale-')),root=path.join(base,'Research Novel'),externalRoot=path.join(base,'External');
await fs.mkdir(root);await fs.mkdir(externalRoot);const store=new Store(root);
try{
  await store.create('Research Scale');await fs.mkdir(path.join(root,'assets','research'),{recursive:true});
  const smallAssets=[];for(let index=0;index<12;index++){const name=`source-${index}.${index%2?'png':'pdf'}`;await fs.writeFile(path.join(root,'assets','research',name),Buffer.alloc(768*1024,index));smallAssets.push(name)}
  const large='large-source.pdf',largeBytes=96*1024*1024,largePath=path.join(root,'assets','research',large),handle=await fs.open(largePath,'w');for(let written=0;written<largeBytes;written+=1024*1024)await handle.write(randomBytes(Math.min(1024*1024,largeBytes-written)));await handle.close();
  const externalFiles=[];for(let index=0;index<20;index++){const file=path.join(externalRoot,`external-${index}.pdf`);await fs.writeFile(file,`%PDF research ${index}`);externalFiles.push(file)}
  let project=store.project;const buildStart=performance.now();for(let index=0;index<750;index++){const owned=index%4!==1,type=index%5===0?'pdf':index%5===1?'image':index%5===2?'web':index%5===3?'text':'file',source=type==='web'?{ownership:'none',url:`https://example.com/archive/${index}`} : type==='text'?{ownership:'none',body:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:`Interview transcript ${index}`}]}]}}:owned?{ownership:'project',assetPath:`assets/research/${index===0?large:smallAssets[index%smallAssets.length]}`,originalFilename:`source-${index}.${type==='pdf'?'pdf':'bin'}`,size:index===0?largeBytes:768*1024}:{ownership:'external',externalPath:externalFiles[index%externalFiles.length],originalFilename:path.basename(externalFiles[index%externalFiles.length]),size:20};const made=createResearchItem(project,{type,title:`Research Source ${index} Atlantic shipping`,...source});project=updateResearchItem(made.project,made.id,{tags:[`tag-${index%30}`,'shipping'],notes:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:`Useful source note ${index} for chapter ${index%45}.`}]}]}})}
  const modelMs=performance.now()-buildStart,searchStart=performance.now(),searchResults=researchSearch(project,'shipping',{ownership:'project'},'modified'),searchMs=performance.now()-searchStart,saveStart=performance.now();await store.commit(project);const saveMs=performance.now()-saveStart;
  let peakRss=process.memoryUsage().rss,sampling=true;const sample=setInterval(()=>{if(sampling)peakRss=Math.max(peakRss,process.memoryUsage().rss)},10),backupStart=performance.now(),archive=await store.backup();sampling=false;clearInterval(sample);const backupMs=performance.now()-backupStart;
  console.log(JSON.stringify({records:project.author.research.items.length,owned:project.author.research.items.filter(item=>item.ownership==='project').length,external:project.author.research.items.filter(item=>item.ownership==='external').length,smallAssetCount:smallAssets.length,largeAssetMiB:largeBytes/1024/1024,modelMs:Number(modelMs.toFixed(2)),searchMatches:searchResults.length,searchMs:Number(searchMs.toFixed(2)),saveMs:Number(saveMs.toFixed(2)),backupMs:Number(backupMs.toFixed(2)),peakRssMiB:Number((peakRss/1024/1024).toFixed(1)),archiveBytes:(await fs.stat(archive)).size},null,2));
}finally{await store.release().catch(()=>{});await fs.rm(base,{recursive:true,force:true})}
