// Reuse established actual-renderer acceptance; keep this wave's evidence separate.
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
const root='.acceptance/visual-planning/regressions';await fs.mkdir(root,{recursive:true});
const selected=process.argv.slice(2);
for(const name of selected.length?selected:['formatting-state','focus','manuscript-images','reference-navigation','updater','typography','split-layout']){
 let source=await fs.readFile('scripts/'+name+'-browser.mjs','utf8');
 source=source.replaceAll("from '../","from './").replaceAll("import('../","import('./");
 source=source.replace(/\.acceptance\/([\w-]+)\//g,(_,folder)=>root+'/'+folder+'/');
 for(const match of source.matchAll(/\.acceptance\/visual-planning\/regressions\/[\w-]+\//g))await fs.mkdir(match[0],{recursive:true});
 await fs.writeFile(root+'/'+name+'-executed.mjs',source);
 await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--input-type=module','-'],{stdio:['pipe','pipe','pipe']});let log='';child.stdout.on('data',d=>{log+=d;});child.stderr.on('data',d=>{log+=d;});const timer=setTimeout(()=>{child.kill();reject(Error(name+' exceeded 180s; terminated'));},180000);child.on('exit',async code=>{clearTimeout(timer);await fs.writeFile(root+'/'+name+'.log',log);console.log(name+': '+(code===0?'PASS':'FAIL')+' — '+root+'/'+name+'.log');code===0?resolve():reject(Error(log));});child.stdin.end(source);});
}
