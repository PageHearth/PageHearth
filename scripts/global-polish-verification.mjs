// Reuse accepted harnesses with isolated evidence paths; never overwrite earlier acceptance.
import fs from 'node:fs/promises';import {spawn} from 'node:child_process';
const base='.acceptance/visual-global-polish';
for(const name of process.argv.slice(2)){
 if(!['publish-studio-production','publish-studio-app','publish-alignment-browser','publish-output-regressions','publish-studio-regressions'].includes(name))throw Error('Unknown verification');
 let source=await fs.readFile('scripts/'+name+'.mjs','utf8');source=source.replaceAll('visual-publish','visual-global-polish');if(!name.endsWith('regressions'))source=source.replaceAll("from '../","from './").replaceAll("import('../dist-main/","import('./dist-main/");
 if(name==='publish-studio-regressions')source=source.replace("const selected=process.argv.slice(2);","const selected=['formatting-state','focus','reference-navigation','updater','split-layout'];");
 await fs.writeFile(base+'/'+name+'-executed.mjs',source);
 await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--input-type=module','-'],{stdio:['pipe','pipe','pipe']});let log='';child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);const timer=setTimeout(()=>{child.kill();reject(Error(name+' exceeded 240s'));},240000);child.on('exit',async code=>{clearTimeout(timer);await fs.writeFile(base+'/'+name+'.log',log);console.log(name+': '+(code===0?'PASS':'FAIL'));code===0?resolve():reject(Error(log));});child.stdin.end(source);});
}
