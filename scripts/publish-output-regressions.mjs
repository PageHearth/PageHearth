// Preserve historical evidence. Only adapt the accepted visible labels and output destinations.
import fs from 'node:fs/promises';import {spawn} from 'node:child_process';
const base='.acceptance/visual-publish/outputs';await fs.mkdir(base,{recursive:true});
for(const name of process.argv.length>2?process.argv.slice(2):['export-feedback','export-routing','cover','reference-studio']){
 let s=await fs.readFile('scripts/'+name+'-browser.mjs','utf8');
 const old=name==='cover'?'.acceptance/cover-production':name==='reference-studio'?'.acceptance/visual-research-collections/browser':'.acceptance/'+name,next=base+'/'+name;await fs.mkdir(next,{recursive:true});
 if(name==='cover')for(const f of ['pipeline.json','cover.pdf'])await fs.copyFile(old+'/'+f,next+'/'+f);
 s=s.replaceAll(old,next).replaceAll("from '../","from './");
 s=s.replaceAll('Export Print Cover PDF…','Export Cover PDF…').replaceAll('Export TXT…','Export Plain Text…').replaceAll('Export PDF…','Export Interior PDF…');
 s=s.replace("format==='md'?'Markdown':format.toUpperCase()","format==='pdf'?'Interior PDF':format==='txt'?'Plain Text':format==='md'?'Markdown':format.toUpperCase()");
 s=s.replace("format==='md'?'Export Markdown…':'Export '+format.toUpperCase()+'…'","format==='txt'?'Export Plain Text…':format==='md'?'Export Markdown…':'Export '+format.toUpperCase()+'…'");
 await fs.writeFile(next+'/executed.mjs',s);
 await new Promise((resolve,reject)=>{const p=spawn(process.execPath,['--input-type=module','-'],{stdio:['pipe','pipe','pipe']});let log='';p.stdout.on('data',b=>log+=b);p.stderr.on('data',b=>log+=b);const timer=setTimeout(()=>{p.kill();reject(Error(name+' timeout'));},180000);p.on('exit',async code=>{clearTimeout(timer);await fs.writeFile(next+'/run.log',log);console.log(name+': '+(code===0?'PASS':'FAIL'));code===0?resolve():reject(Error(log));});p.stdin.end(s);});
}
