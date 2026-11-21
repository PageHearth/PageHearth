import {afterEach,describe,expect,it} from 'vitest';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Store} from '../src/main/storage';
import {RevisionCoordinator} from '../src/main/revisionCoordinator';
import {ProjectDirtyState,setEditorInteraction} from '../src/renderer/saveState';
import {createNote,updateMetadata} from '../src/shared/author';
import type {Project} from '../src/shared/model';

const roots:string[]=[];const stores:Store[]=[];
afterEach(async()=>{for(const store of stores)await store.release().catch(()=>{});stores.length=0;for(const root of roots)await fs.rm(root,{recursive:true,force:true});roots.length=0;});
async function fresh(){const root=await fs.mkdtemp(path.join(os.tmpdir(),'pagehearth-idle-'));roots.push(root);const store=new Store(root);stores.push(store);await store.create('Idle project');return {root,store};}
async function phase1(){const base=await fs.mkdtemp(path.join(os.tmpdir(),'pagehearth-phase1-idle-'));roots.push(base);const root=path.join(base,'project');await fs.cp(path.join(process.cwd(),'tests','fixtures','pagehearth-v1'),root,{recursive:true});for(const name of ['.storyloom','backups','research','characters','locations','monsters','notes','assets','snapshots','exports'])await fs.mkdir(path.join(root,name));const store=new Store(root);stores.push(store);await store.open();return {root,store};}
function editor(initial:boolean,onUpdate:()=>void){let editable=initial;return {get isEditable(){return editable;},setEditable(value:boolean,emitUpdate=true){editable=value;if(emitUpdate)onUpdate();}};}
async function snapshot(root:string){const file=path.join(root,'project.pagehearth'),stat=await fs.stat(file);return {bytes:await fs.readFile(file,'utf8'),mtime:stat.mtimeMs,revision:JSON.parse(await fs.readFile(file,'utf8')).revision};}

describe('idle save quiescence',()=>{
  it('keeps a newly created project clean and leaves its canonical manifest untouched while idle',async()=>{const s=await fresh(),before=await snapshot(s.root);let updates=0;setEditorInteraction(editor(false,()=>updates++),true);await new Promise(r=>setTimeout(r,30));const after=await snapshot(s.root);expect(updates).toBe(0);expect(after).toEqual(before);});

  it('opens a Phase 1 project clean without materializing author defaults or rewriting revision',async()=>{const s=await phase1(),before=await snapshot(s.root);await expect(fs.stat(path.join(s.root,'author.json'))).rejects.toThrow();let updates=0;setEditorInteraction(editor(false,()=>updates++),true);await new Promise(r=>setTimeout(r,30));expect(updates).toBe(0);expect(await snapshot(s.root)).toEqual(before);await expect(fs.stat(path.join(s.root,'author.json'))).rejects.toThrow();});

  it('persists the first Author edit once and then remains quiescent',async()=>{const s=await phase1(),id=s.store.project.manifest.nodes[0].id,revisions=new RevisionCoordinator(),state=new ProjectDirtyState();revisions.reset(s.store.project);const next=updateMetadata(s.store.project,id,{summary:'First Author edit'});state.markChanged();const at=state.generation,result=await revisions.save(next,s.store.project,(p,base)=>s.store.commit(p,base));expect(state.acknowledge(at)).toBe(true);expect(state.dirty).toBe(false);expect(result.project.manifest.revision).toBe(8);const before=await snapshot(s.root);expect(await fs.readFile(path.join(s.root,'author.json'),'utf8')).toContain('First Author edit');await new Promise(r=>setTimeout(r,30));expect(await snapshot(s.root)).toEqual(before);});

  it('canonical save-result adoption acknowledges rather than creating another dirty generation',()=>{const state=new ProjectDirtyState();expect(state.dirty).toBe(false);state.markChanged();const at=state.generation;expect(state.acknowledge(at)).toBe(true);const settled=state.generation;expect(state.dirty).toBe(false);expect(state.generation).toBe(settled);});

  it('does not increment revisions repeatedly without another real change',async()=>{const s=await fresh(),revisions=new RevisionCoordinator();revisions.reset(s.store.project);const base=s.store.project.manifest.revision;await new Promise(r=>setTimeout(r,40));expect(s.store.project.manifest.revision).toBe(base);expect((await snapshot(s.root)).revision).toBe(base);});

  it('suppresses synthetic editor updates so idle interaction changes issue no save or protection work',()=>{let saveIpc=0,protectWrites=0;const surface=editor(false,()=>{saveIpc++;protectWrites++;});setEditorInteraction(surface,true);setEditorInteraction(surface,true);setEditorInteraction(surface,false);setEditorInteraction(surface,false);expect(saveIpc).toBe(0);expect(protectWrites).toBe(0);});

  it('retains the real Saved to Unsaved to Saved state transition',()=>{const state=new ProjectDirtyState();const statuses=['Saved'];state.markChanged();statuses.push(state.dirty?'Unsaved':'Saved');const at=state.generation;expect(state.acknowledge(at)).toBe(true);statuses.push(state.dirty?'Unsaved':'Saved');expect(statuses).toEqual(['Saved','Unsaved','Saved']);});

  it('settles both main and detached trackers after a reconciled save without another cycle',async()=>{const s=await fresh(),base=structuredClone(s.store.project),revisions=new RevisionCoordinator(),main=new ProjectDirtyState(),detached=new ProjectDirtyState();revisions.reset(base);const mainEdit=structuredClone(base);mainEdit.manifest.settings.workspace={writeView:'notebook'};main.markChanged();let at=main.generation;let result=await revisions.save(mainEdit,s.store.project,(p,revision)=>s.store.commit(p,revision));expect(main.acknowledge(at)).toBe(true);const child=createNote(base,null,'Detached note').project;detached.markChanged();at=detached.generation;result=await revisions.save(child,s.store.project,(p,revision)=>s.store.commit(p,revision));expect(result.reconciled).toBe(true);expect(detached.acknowledge(at)).toBe(true);expect(main.dirty).toBe(false);expect(detached.dirty).toBe(false);const revision=result.project.manifest.revision;await new Promise(r=>setTimeout(r,30));expect(s.store.project.manifest.revision).toBe(revision);});
});
