import path from 'node:path';
import {promises as fs} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {Store} from './storage.js';
import {renameProtected} from './protectedRename.js';
import {instantiateTemplate,validateTemplate,type ProjectTemplate} from '../shared/projectTemplates.js';
import {requireTemplate,TemplateError} from '../shared/templateSafety.js';
import {ordinaryDirectory,childPath,absent,fileError} from './templateFiles.js';
import {type Project,validate} from '../shared/model.js';

export const TEMPLATE_STAGING_MARKER='.pagehearth-template-staging.json';
export type CreationPhase='staging'|'materialize'|'readback'|'finalize'|'adopt'|'recents';
export type CreationHooks={checkpoint?:(phase:CreationPhase,staging:string,target:string)=>Promise<void>;adopt?:(store:Store,project:Project)=>Promise<void>;rollbackAdoption?:()=>Promise<void>;remember?:(project:Project,root:string)=>Promise<void>};
/** Windows directory rename fails for an existing destination (including an empty directory).
 * Do not use POSIX rename here: it can replace an empty target. */
export async function finalizeProjectDirectory(staging:string,target:string){requireTemplate(process.platform==='win32','PLATFORM','No-clobber directory publication is currently supported on Windows only.');await fs.rename(staging,target);}
export async function createTemplateProject(template:ProjectTemplate,title:string,parent:string,hooks:CreationHooks={}){
  validateTemplate(template);return createInitialProject(instantiateTemplate(template,title),title,parent,hooks);
}
export async function createInitialProject(made:{project:Project;activeDocumentId:string},title:string,parent:string,hooks:CreationHooks={},extras?:{write:(root:string)=>Promise<void>;verify:(root:string)=>Promise<void>}){
  validate(made.project);let staging='',target='',owner='',store:Store|undefined,published=false,identity:{ino:number;dev:number}|undefined;
  try{const base=await ordinaryDirectory(parent);target=childPath(base,title);await absent(target);staging=await fs.mkdtemp(path.join(base,'.pagehearth-template-stage-'));owner=randomUUID();const marker={version:1,owner,target};const guard=await fs.open(path.join(staging,TEMPLATE_STAGING_MARKER),'wx');try{await guard.writeFile(JSON.stringify(marker));await guard.sync();}finally{await guard.close();}await hooks.checkpoint?.('staging',staging,target);
    store=new Store(staging);await hooks.checkpoint?.('materialize',staging,target);await store.createInitial(made.project,true);await extras?.write(staging);await store.release();store=undefined;
    await hooks.checkpoint?.('readback',staging,target);const manifest=JSON.parse(await fs.readFile(path.join(staging,'project.pagehearth'),'utf8')),author=JSON.parse(await fs.readFile(path.join(staging,'author.json'),'utf8')),documents:Project['documents']={};for(const n of manifest.nodes)documents[n.id]=JSON.parse(await fs.readFile(path.join(staging,'manuscript',n.id+'.json'),'utf8'));const readback:Project={manifest,author,documents,recovery:[]};validate(readback);requireTemplate(JSON.stringify({...readback.manifest,revision:0})===JSON.stringify(made.project.manifest)&&JSON.stringify(author)===JSON.stringify(made.project.author)&&JSON.stringify(documents)===JSON.stringify(made.project.documents),'READBACK','Created project failed readback verification.');
    await extras?.verify(staging);identity=await fs.lstat(staging);await hooks.checkpoint?.('finalize',staging,target);await finalizeProjectDirectory(staging,target);published=true;
    await hooks.checkpoint?.('adopt',staging,target);await fs.unlink(path.join(target,TEMPLATE_STAGING_MARKER));store=new Store(target);const project=await store.open();await hooks.adopt?.(store,project);await hooks.checkpoint?.('recents',staging,target);await hooks.remember?.(project,target);return {store,project,root:target,activeDocumentId:made.activeDocumentId};
  }catch(error){await hooks.rollbackAdoption?.().catch(()=>{});await store?.release().catch(()=>{});
    // Only quarantine the exact directory owned by this transaction. Never remove user data.
    if(published){try{const stat=await fs.lstat(target);requireTemplate(!stat.isSymbolicLink()&&identity?.ino===stat.ino&&identity.dev===stat.dev,'OWNERSHIP','Creation target changed ownership.');const evidence=path.join(target,TEMPLATE_STAGING_MARKER);let ours=false;try{ours=JSON.parse(await fs.readFile(evidence,'utf8')).owner===owner;}catch{}if(!ours){const h=await fs.open(evidence,'wx');try{await h.writeFile(JSON.stringify({version:1,owner,target,interrupted:true}));await h.sync();}finally{await h.close();}}// A just-published Windows directory can transiently deny a reverse rename even
      // with all project handles closed. Recheck authority across every bounded retry.
      await renameProtected(target,staging,async(from,to)=>{
        const current=await fs.lstat(target);
        requireTemplate(current.isDirectory()&&!current.isSymbolicLink()&&identity?.ino===current.ino&&identity.dev===current.dev,'OWNERSHIP','Creation target changed ownership.');
        const marker=JSON.parse(await fs.readFile(evidence,'utf8'));
        requireTemplate(marker.owner===owner&&marker.target===target,'OWNERSHIP','Creation recovery evidence changed ownership.');
        await absent(staging); // Never replace a newly introduced quarantine destination.
        await fs.rename(from,to);
      });}catch{throw new TemplateError('CREATION_RECOVERY','Creation could not be adopted or quarantined. Preserve the destination and staging evidence for recovery.',target);}}
    const e=fileError(error);throw new TemplateError(e.code,e.message+(staging?' Staging evidence was preserved at '+staging:''),e.field);
  }
}
