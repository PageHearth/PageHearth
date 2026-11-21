import {spawn} from 'node:child_process';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import type {EbookValidation} from '../shared/ebookProduction.js';
/** Absolute bundled Java only. No shell, injected Java options, user PATH, or network dependencies. */
export async function validateEpub(resources:string,file:string,version:'5.3.0'|'5.4.0',signal:AbortSignal):Promise<EbookValidation>{
 const report=path.join(path.dirname(file),`epubcheck-${version}.json`),env={...process.env};for(const name of ['JAVA_TOOL_OPTIONS','_JAVA_OPTIONS','JDK_JAVA_OPTIONS','CLASSPATH','JAVA_HOME'])delete env[name];
 try{await new Promise<void>((resolve,reject)=>{if(signal.aborted){reject(Error('Render canceled.'));return;}const child=spawn(path.join(resources,'java/bin/java.exe'),['-Xmx512m','-jar',path.join(resources,`epubcheck-${version}/epubcheck.jar`),file,'--json',report],{cwd:path.dirname(file),env,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});let count=0,failure:Error|undefined;
 const stop=(e:Error)=>{failure=e;child.kill();},abort=()=>stop(Error('Render canceled.'));signal.addEventListener('abort',abort,{once:true});const timer=setTimeout(()=>stop(Error('eBook validation exceeded two minutes.')),120000);
 for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{count+=b.length;if(count>2*1024*1024)stop(Error('Validator output exceeded its limit.'));});child.on('error',e=>{failure=e;});child.on('close',()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);if(failure)reject(failure);else resolve();});});
 const stat=await fs.stat(report);if(stat.size>8*1024*1024)throw Error('Validator report exceeded its limit.');const data=JSON.parse(await fs.readFile(report,'utf8'));if(data.checker?.checkerVersion!==version||!Array.isArray(data.messages))throw Error('Unrecognized validator result.');
 return {version,status:data.checker.nFatal||data.checker.nError||data.checker.nUsage?'fail':'pass',messages:data.messages.map((m:any)=>({severity:String(m.severity),code:String(m.ID||m.id||''),message:String(m.message)}))};
 }catch(e){if(signal.aborted)throw Error('Render canceled.');return {version,status:'unavailable',messages:[{severity:'error',code:'validator-unavailable',message:e instanceof Error?e.message:String(e)}]};}
}
