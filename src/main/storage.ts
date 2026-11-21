import {RevisionOperations} from './revisionOperations.js';
import {ExternalAccessRequired,type ExternalAccess} from './externalAccess.js';
import {validRevisionId,type RevisionId} from '../shared/revisionPasses.js';
import {reconcileProject} from '../shared/reconcile.js';
import {commentBody,invalidateComments,type CommentsState} from '../shared/comments.js';
import {SceneOperations,type SceneOperation} from './sceneOperations.js';
import type {SceneSelection} from '../shared/sceneSelection.js';
import {HistoryStore} from './historyStore.js';
import {WritingStore} from './writingStore.js';
import {renameProtected} from './protectedRename.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { strToU8 } from 'fflate';
import { MANIFEST, LEGACY_MANIFEST, discoverManifest } from './projectPaths.js';
import { blank, defaultAuthor, legacyQuickNotesId, validate, plain, type Project, type Doc } from '../shared/model.js';
import { ensureAuthor } from '../shared/author.js';
import { readBackup } from './archive.js';
import { changeTree } from '../shared/tree.js';
import {writeArchive,type ArchiveInput} from './streamArchive.js';

const json = (x: unknown) => JSON.stringify(x, null, 2) + '\n';
const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const directories=['manuscript','research','characters','locations','monsters','notes','assets','snapshots','backups','exports','.storyloom'];
const creationFile='.pagehearth-creating.json';
async function atomic(file: string, data: string | Uint8Array, protectedDraft=false) {
  const temp = file + '.' + randomUUID() + '.tmp';
  const h = await fs.open(temp, 'wx');
  try { await h.writeFile(data); await h.sync(); } finally { await h.close(); }
  try{if(protectedDraft)await renameProtected(temp,file);else await fs.rename(temp,file);}catch(error){if(protectedDraft)await fs.unlink(temp).catch(()=>{});throw error;}
}
async function exists(file: string) { try { await fs.access(file); return true; } catch (e: any) { if (e.code === 'ENOENT') return false; throw e; } }
export class Store {
  project!: Project;
  private revisionOperations=new RevisionOperations();
  clearRevision(projectId:string,revision:number,slot:RevisionId){return this.mutate(async()=>{if(projectId!==this.project.manifest.id||revision!==this.project.manifest.revision||!validRevisionId(slot))throw Error('Project changed before Revision Clear.');await this.assertSceneProtection();const {project,record}=this.revisionOperations.prepare(this.project,slot);const saved=await this.commitNow(project,revision,true);this.revisionOperations.remember(record);return {project:saved,operationId:record.id};});}
  revisionHistory(projectId:string,revision:number,id:string,direction:'undo'|'redo'){return this.mutate(async()=>{if(projectId!==this.project.manifest.id||revision!==this.project.manifest.revision||!['undo','redo'].includes(direction))throw Error('Project changed before Revision history.');await this.assertSceneProtection();const {project,record}=this.revisionOperations.traverse(this.project,id,direction);const saved=await this.commitNow(project,revision);record.applied=direction==='redo';return {project:saved,operationId:id};});}
  private sceneOperations=new SceneOperations();
  createScene(request:SceneSelection){return this.mutate(async()=>{
    await this.assertSceneProtection();
    const {record,plan}=this.sceneOperations.prepare(this.project,request);
    const saved=await this.commitNow(plan.project,this.project.manifest.revision,record);
    this.sceneOperations.remember(record);return this.sceneOperations.reply(saved,record);
  });}
  traverseScene(projectId:string,revision:number,id:string,direction:'undo'|'redo'){return this.mutate(async()=>{
    if(projectId!==this.project.manifest.id||revision!==this.project.manifest.revision||!['undo','redo'].includes(direction))throw Error('The project changed before structural history traversal.');
    await this.assertSceneProtection();
    const {record,project}=this.sceneOperations.traverse(this.project,id,direction);
    if(direction==='undo')await this.checkExternalReferences(record.createdIds);
    const saved=await this.commitNow(project,revision,record);record.applied=direction==='redo';
    return this.sceneOperations.reply(saved,record);
  });}
  private async assertSceneProtection(){
    if(await exists(this.at('.storyloom','comment-draft.json')))throw Error('Settle protected comments before changing structure.');
    if(await exists(this.at('.storyloom','journal.json')))throw Error('Recover the interrupted transaction before changing structure.');
    await this.retireProtectedNow(this.project);
    if((await this.draftRecords()).length||await this.authorDraft())throw Error('Protected edits have not settled. Save/reconcile them before changing structure.');
  }
  readonly history:HistoryStore;
  readonly writing:WritingStore;
  historyWarning='';
  private historyRetryAfter=0;
  private historyEdited=new Set<string>();
  private manifestName=MANIFEST;
  get manifestPath(){return this.at(this.manifestName);}
  generation=0;
  private backedUpFingerprint:string|undefined;
  private fingerprint(p=this.project){const {revision,...manifest}=p.manifest;const {workspace,...settings}=manifest.settings;return hash(Buffer.from(json({manifest:{...manifest,settings},documents:p.documents,author:p.author,...(this.history.revision?{history:this.history.revision}:{})})));}
  get backupDirty(){return this.fingerprint()!==this.backedUpFingerprint;}
  private async backupDirectory(){
    const preference=this.project.manifest.settings.backup?.directory;
    if(!preference)return this.at('backups');
    if(!path.isAbsolute(preference))throw Error('Backup destination must be an absolute local folder.');
    const base=await this.authorizedBackupDirectory();const root=await fs.realpath(this.root);const rel=path.relative(root,base!);
    if(!rel || (!rel.startsWith('..'+path.sep) && rel!=='..' && !path.isAbsolute(rel)))throw Error('Alternate backups must be outside the project folder.');
    const directory=path.join(base!,'PageHearth-Backups-'+this.project.manifest.id);let stat;
    try{stat=await fs.lstat(directory);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;await fs.mkdir(directory);stat=await fs.lstat(directory);}
    if(stat.isSymbolicLink()||!stat.isDirectory())throw new ExternalAccessRequired();return directory;
  }
  externalAccess?:ExternalAccess;
  async authorizedBackupDirectory(){const destination=this.project.manifest.settings.backup?.directory;if(!destination)return undefined;if(!this.externalAccess)throw new ExternalAccessRequired();return this.externalAccess.require({root:this.root,projectId:this.project.manifest.id,purpose:'backup'},destination);}
  private token = randomUUID();
  private held = false;
  // Canonical commits, draft records and lock release share one short mutation lane.
  // Read-only archive work deliberately does not occupy this lane.
  private mutations:Promise<unknown>=Promise.resolve();
  private mutate<T>(fn:()=>Promise<T>):Promise<T>{const task=this.mutations.then(fn);this.mutations=task.catch(()=>{});return task;}
  constructor(public root: string) { this.root = path.resolve(root); this.history=new HistoryStore(this.root,()=>this.project,()=>this.held);this.writing=new WritingStore(this.root,()=>this.project.manifest.id,()=>this.held); }
  private at(...parts: string[]) { return path.join(this.root, ...parts); }
  private draftHash(doc:Doc){return hash(Buffer.from(json(doc)));}
  private authorHash(author:Project['author']){return hash(Buffer.from(json(author)));}
  stageDocument(id:string,document:Doc,comments?:CommentsState,beforeComments?:CommentsState){const copy=structuredClone(document),state=comments&&structuredClone(comments);return this.mutate(async()=>{if(state||this.project.author.comments||await exists(this.at('.storyloom','comment-draft.json')))await this.stageCoupled(id,copy,state,undefined,beforeComments);else await this.stageDocumentNow(id,copy);});}
  stageAuthor(author:Project['author'],before?:Project['author']){const copy=structuredClone(author);return this.mutate(()=>this.stageAuthorNow(copy,before));}
  retireProtected(project:Project){const copy=structuredClone(project);return this.mutate(()=>this.retireProtectedNow(copy));}
  private async stageDocumentNow(id:string,document:Doc){
    if(!this.held || !/^[a-f0-9-]{36}$/.test(id) || !Object.hasOwn(this.project.documents,id))throw Error('No open document to protect.');
    validate({...this.project,documents:{...this.project.documents,[id]:document}});
    const directory=this.at('.storyloom','drafts');await fs.mkdir(directory,{recursive:true});
    await atomic(path.join(directory,id+'.json'),json({version:1,projectId:this.project.manifest.id,id,baseHash:this.draftHash(this.project.documents[id]),document}),true);
  }
  private async stageAuthorNow(author:Project['author'],before?:Project['author']){
    if(!this.held)throw Error('No open Author Workspace to protect.');
    if(author.comments||this.project.author.comments||await exists(this.at('.storyloom','comment-draft.json'))){await this.stageCoupled(undefined,undefined,undefined,author,undefined,before);return;}
    validate({...this.project,author});
    await atomic(this.at('.storyloom','author-draft.json'),json({version:1,projectId:this.project.manifest.id,baseHash:this.authorHash(this.project.author),author}),true);
  }
  private checkCommentBodies(project:Project){for(const c of Object.values(project.author.comments?.byId||{}))if(c.anchor.status==='attached'&&project.author.comments!.documentBases[c.anchor.documentId]!==commentBody(project.documents[c.anchor.documentId]))throw Error('Comment anchors do not match protected manuscript evidence.');}
  private async coupledDraft(project=this.project){
    const file=this.at('.storyloom','comment-draft.json');if(!await exists(file))return null;const record=JSON.parse(await fs.readFile(file,'utf8'));
    if(record.version!==1||record.projectId!==project.manifest.id||!record.documents||!record.beforeHashes||!record.author||!record.baseAuthor||!Array.isArray(record.knownAuthorHashes)||!record.knownBodyHashes||!/^[a-f0-9]{64}$/.test(record.beforeAuthorHash))throw Error('Invalid coupled comment recovery evidence. Preserved.');
    for(const id of Object.keys(record.documents))if(!project.documents[id]||!/^[a-f0-9]{64}$/.test(record.beforeHashes[id]))throw Error('Coupled recovery document identity conflict.');
    const candidate={...project,documents:{...project.documents,...record.documents},author:record.author};validate(candidate);this.checkCommentBodies(candidate);return {file,record};
  }
  private async stageCoupled(id?:string,body?:Doc,comments?:CommentsState,author?:Project['author'],beforeComments?:CommentsState,beforeAuthor?:Project['author']){
    if(!this.held)throw Error('No open project to protect.');const prior=await this.coupledDraft();
    const legacy=prior?[]:await this.draftRecords(),authorDraft=prior?null:await this.authorDraft();
    const record=prior?.record||{version:1,projectId:this.project.manifest.id,documents:Object.fromEntries(legacy.map(x=>[x.record.id,x.record.document])),beforeHashes:Object.fromEntries(legacy.map(x=>[x.record.id,x.record.baseHash])),baseAuthor:this.project.author,knownAuthorHashes:[this.authorHash(this.project.author)],knownBodyHashes:{},beforeAuthorHash:this.authorHash(this.project.author),author:authorDraft?.record.author||this.project.author,superseded:[]};
    if(!prior){for(const x of [...legacy,...(authorDraft?[authorDraft]:[])])record.superseded.push({file:path.relative(this.at('.storyloom'),x.file),hash:hash(await fs.readFile(x.file))});}
    if(id){if(!this.project.documents[id]||!body)throw Error('No document to protect.');record.documents[id]=body;record.beforeHashes[id]??=this.draftHash(this.project.documents[id]);if(comments){const base={...this.project,documents:{...this.project.documents,...record.documents},author:{...record.author,comments:beforeComments??this.project.author.comments}},local={...base,author:{...base.author,comments}},canonical={...base,author:record.author};const merged=reconcileProject(base,local,canonical);if(!merged.project)throw Error('Protected comment changes conflict. Evidence preserved.');record.author=merged.project.author;}}
    if(author){const base={...this.project,documents:{...this.project.documents,...record.documents},author:beforeAuthor||this.project.author},local={...base,author},canonical={...base,author:record.author};const merged=reconcileProject(base,local,canonical);if(!merged.project)throw Error('Protected Author changes conflict. Evidence preserved.');record.author=merged.project.author;}
    const candidate={...this.project,documents:{...this.project.documents,...record.documents},author:record.author};validate(candidate);this.checkCommentBodies(candidate);
    record.knownAuthorHashes=[...(record.knownAuthorHashes||[]),this.authorHash(record.author)].slice(-100);if(id)record.knownBodyHashes[id]=[...(record.knownBodyHashes[id]||[record.beforeHashes[id]]),this.draftHash(body!)].slice(-100);
    await atomic(this.at('.storyloom','comment-draft.json'),json(record),true);
    // The single acknowledged envelope now owns these older independent records.
    for(const x of legacy)await fs.unlink(x.file);if(authorDraft)await fs.unlink(authorDraft.file);
  }
  private async retireSuperseded(record:any){
    const files:string[]=[];
    // Validate every independent record before consuming any recovery evidence.
    for(const old of record.superseded||[]){if(!/^(author-draft\.json|drafts[\\/][a-f0-9-]{36}\.json)$/.test(old.file))throw Error('Invalid superseded recovery path.');const file=this.at('.storyloom',old.file);if(await exists(file)){if(hash(await fs.readFile(file))!==old.hash)throw Error('Conflicting independent recovery evidence. Preserved.');files.push(file);}}
    for(const file of files)await fs.unlink(file);
  }
  private async reconcileCoupled(next:Project,dryRun=false,baseProject=this.project){const draft=await this.coupledDraft(baseProject);if(!draft)return;const r=draft.record;
    if(this.authorHash(r.author)===this.authorHash(next.author)&&Object.entries(r.documents).every(([id,body])=>json(body)===json(next.documents[id]))){if(!dryRun)await fs.unlink(draft.file);return;}
    for(const id of Object.keys(r.documents)){if(!next.documents[id])throw Error('Pending comment protection prevents document removal.');const h=this.draftHash(next.documents[id]);if(h!==r.beforeHashes[id]&&h!==this.draftHash(r.documents[id])&&!r.knownBodyHashes?.[id]?.includes(h))throw Error('Newer manuscript conflicts with pending coupled protection. Evidence preserved.');r.beforeHashes[id]=h;}
    if(!r.knownAuthorHashes?.includes(this.authorHash(next.author))){const canonical={...next,documents:{...next.documents,...r.documents}},base={...canonical,author:r.baseAuthor},local={...canonical,author:r.author},merged=reconcileProject(base,local,canonical);if(!merged.project)throw Error('Newer Author data conflicts with pending coupled protection. Evidence preserved.');r.author=merged.project.author;}
    r.baseAuthor=next.author;r.beforeAuthorHash=this.authorHash(next.author);if(!dryRun)await atomic(draft.file,json(r),true);
  }
  private async retireProtectedNow(project:Project){
    if(!this.held||project.manifest.id!==this.project.manifest.id)throw Error('Project identity changed before protected edits could be retired.');
    validate(project);
    await this.reconcileCoupled(this.project);
    let removed=0;
    for(const {file,record} of await this.draftRecords())if(project.documents[record.id]&&json(record.document)===json(project.documents[record.id])){await fs.unlink(file);removed++;}
    const author=await this.authorDraft();if(author&&json(author.record.author)===json(project.author)){await fs.unlink(author.file);removed++;}
    return removed;
  }
  private async authorDraft(project=this.project){
    const file=this.at('.storyloom','author-draft.json');if(!await exists(file))return null;
    const record=JSON.parse(await fs.readFile(file,'utf8'));
    if(record.version!==1 || record.projectId!==project.manifest.id || !/^[a-f0-9]{64}$/.test(record.baseHash))throw Error('Author Workspace recovery identity conflicts. File preserved.');
    validate({...project,author:record.author});return {file,record};
  }
  private async draftRecords(project=this.project){
    const directory=this.at('.storyloom','drafts');if(!await exists(directory))return [];
    const records=[];
    for(const name of await fs.readdir(directory)){
      if(name.endsWith('.tmp'))continue;
      if(!/^[a-f0-9-]{36}\.json$/.test(name))throw Error('Unrecognized draft recovery evidence. Files preserved.');
      const file=path.join(directory,name);const record=JSON.parse(await fs.readFile(file,'utf8'));
      if(record.version!==1 || record.id+'.json'!==name || record.projectId!==project.manifest.id || !project.documents[record.id])throw Error('Draft recovery identity conflicts. Files preserved.');
      if(!/^[a-f0-9]{64}$/.test(record.baseHash))throw Error('Invalid draft base hash. Files preserved.');
      validate({...project,documents:{...project.documents,[record.id]:record.document}});
      records.push({file,record});
    }return records;
  }
  private async reconcileDrafts(next:Project){
    for(const {file,record} of await this.draftRecords()){
      if(!next.documents[record.id] || json(record.document)===json(next.documents[record.id]))await fs.unlink(file);
      else await atomic(file,json({...record,baseHash:this.draftHash(next.documents[record.id])}));
    }
    const draft=await this.authorDraft(next);if(draft){if(json(draft.record.author)===json(next.author))await fs.unlink(draft.file);else await atomic(draft.file,json({...draft.record,baseHash:this.authorHash(next.author)}));}
  }
  private async checkExternalReferences(ids:string[]){
    const walk=async(directory:string)=>{for(const entry of await fs.readdir(directory,{withFileTypes:true})){
      const file=path.join(directory,entry.name);if(entry.isSymbolicLink())throw Error('Cannot verify references through links. Keep the documents in Trash.');
      if(entry.isDirectory())await walk(file);else if(/\.(json|txt|md|html|svg)$/i.test(entry.name)){const bytes=await fs.readFile(file);if(ids.some(id=>bytes.includes(Buffer.from(id))))throw Error('A project reference file links to this selection. Keep it in Trash or remove the reference first.');}
    }};
    for(const name of ['research','characters','locations','monsters','notes','assets'])if(await exists(this.at(name)))await walk(this.at(name));
  }
  async acquire(recovering=false) {
    if(!recovering && await exists(this.at('.storyloom','lock-recovery')))throw Error('Project lock recovery was interrupted or is in progress. Preserve the complete project folder for inspection.');
    const lock = this.at('.storyloom', 'lock.json');
    try { const h = await fs.open(lock, 'wx'); try { await h.writeFile(json({pid:process.pid, token:this.token})); await h.sync(); } finally { await h.close(); } this.held = true; return false; }
    catch(e: any) {
      if (e.code !== 'EEXIST') throw e;
      let owner; try { owner = JSON.parse(await fs.readFile(lock, 'utf8')); } catch { throw Error('Project lock is damaged. Preserve it and inspect before recovery.'); }
      if (!Number.isInteger(owner.pid) || owner.pid <= 0 || typeof owner.token!=='string' || !owner.token.trim()) throw Error('Invalid project lock.');
      try { process.kill(owner.pid, 0); } catch (err: any) { if (err.code === 'ESRCH') {
        // Exclusive recovery guard prevents contenders from renaming a newly acquired lock.
        const guardPath = this.at('.storyloom','lock-recovery');
        const guard = await fs.open(guardPath,'wx').catch(()=>{throw Error('Project lock recovery is in progress or was interrupted. Preserve the lock files for inspection.');});
        try { const latest = JSON.parse(await fs.readFile(lock,'utf8')); if(json(latest)!==json(owner)) throw Error('Project ownership changed during recovery. Try opening again.'); await fs.rename(lock,this.at('.storyloom',`stale-lock-${randomUUID()}.json`)); await this.acquire(true); return true; }
        finally {await guard.close();await fs.unlink(guardPath);}
      } throw err; }
      throw Error('This project is already open in another PageHearth window.');
    }
  }
  async create(title: string) {
    if (!title.trim()) throw Error('Enter a project title.');
    const id = randomUUID();
    return this.createInitial({manifest:{version:1,id:randomUUID(),title:title.trim(),revision:0,nodes:[{id,parent:null,title:'Chapter 1',kind:'Chapter'}],settings:{editor:{},publication:{},workspace:{editorView:'pages'}}},documents:{[id]:blank()},author:defaultAuthor(),recovery:[]});
  }
  async createInitial(initial:Project,staging=false) {
    validate(initial);
    if(initial.manifest.revision!==0||initial.recovery.length)throw Error('Initial project must have a fresh revision and no recovery state.');
    if(Object.keys(initial.documents).length!==initial.manifest.nodes.length||Object.keys(initial.documents).some(id=>!initial.manifest.nodes.some(n=>n.id===id)))throw Error('Initial project has unexpected manuscript files.');
    const entries=await fs.readdir(this.root);
    if(entries.some(name=>!staging||name!=='.pagehearth-template-staging.json'))throw Error('Choose an empty folder to protect existing files.');
    this.project=structuredClone(initial);
    const creation={version:1,pid:process.pid,token:this.token,project:this.project,interrupted:false};
    const guard=await fs.open(this.at(creationFile),'wx');
    try{await guard.writeFile(json(creation));await guard.sync();}finally{await guard.close();}
    try {
      for(const d of directories)await fs.mkdir(this.at(d));
      await this.acquire();await this.commit(this.project,-1);await fs.unlink(this.at(creationFile));return this.project;
    } catch(e) {await this.release();await atomic(this.at(creationFile),json({...creation,interrupted:true})).catch(()=>{});throw e;}
  }
  async open(approveRecovery?:(message:string)=>Promise<boolean>) {
    if(await exists(this.at('.pagehearth-template-staging.json')))throw Error('Template project creation is incomplete. Preserve this staging directory; it cannot be opened as a project.');
    if(await exists(this.at('.storyloom','restore-in-progress.json')))throw Error('This restore was interrupted. Preserve this folder and restore the original backup to a new folder.');
    this.manifestName=await discoverManifest(this.root);
    if(await exists(this.at(creationFile))){
      const creation=JSON.parse(await fs.readFile(this.at(creationFile),'utf8'));creation.project=ensureAuthor(creation.project);validate(creation.project);
      if(creation.version!==1 || !Number.isInteger(creation.pid) || creation.pid<=0)throw Error('Creation recovery evidence is invalid. Folder preserved.');
      if(!creation.interrupted){try{process.kill(creation.pid,0);throw Error('Project creation is still owned by a running process.');}catch(e:any){if(e.code!=='ESRCH')throw e;}}
      if(approveRecovery && !await approveRecovery(`Creation of ${creation.project.manifest.title} was interrupted. Finish creating this project? Existing files will be checked before recovery.`))throw Error('Creation recovery canceled. Folder preserved.');
      for(const d of directories){if(!await exists(this.at(d)))await fs.mkdir(this.at(d));const stat=await fs.lstat(this.at(d));if(stat.isSymbolicLink() || !stat.isDirectory())throw Error('Creation recovery found an unexpected path. Folder preserved.');}
      await this.acquire();
      try{
        if(!await exists(this.manifestPath) && !await exists(this.at('.storyloom','journal.json'))){
          if((await fs.readdir(this.at('manuscript'))).length)throw Error('Creation recovery found unexpected manuscript files. Folder preserved.');
          await atomic(this.at('.storyloom','journal.json'),json({base:-1,project:creation.project,beforeHashes:Object.fromEntries(Object.keys(creation.project.documents).map(id=>[id,null])),beforeAuthorHash:null}));
        }
        await fs.rename(this.at(creationFile),this.at('.storyloom','creation-'+randomUUID()+'.json'));
      }finally{await this.release();}
    }
    for (const relative of ['.storyloom','manuscript','backups']) {
      const stat = await fs.lstat(this.at(relative));
      if(stat.isSymbolicLink() || !stat.isDirectory()) throw Error('Project directories must be ordinary local folders, not links.');
    }
    if (!(await exists(this.manifestPath)) && !(await exists(this.at('.storyloom','journal.json')))) throw Error('This folder is not a PageHearth project.');
    const stale = await this.acquire();
    const recovery: string[] = stale ? ['An unclean shutdown was detected. Saved project files were checked.'] : [];
    try {
      const journal = this.at('.storyloom','journal.json');
      if (await exists(journal)) {
        const j = JSON.parse(await fs.readFile(journal,'utf8'));j.project=ensureAuthor(j.project); validate(j.project);
        if(!Number.isSafeInteger(j.base) || j.base < -1 || j.project.manifest.revision !== j.base+1) throw Error('Invalid recovery revision. Journal preserved.');
        const current = await exists(this.manifestPath) ? JSON.parse(await fs.readFile(this.manifestPath,'utf8')) : null;
        if (current && (current.id !== j.project.manifest.id || (current.revision !== j.base && json(current) !== json(j.project.manifest)))) throw Error('Recovery conflicts with newer project data. Files were preserved.');
        // Check all evidence before rewriting any canonical file or consuming the journal.
        const manifestHash=current?hash(Buffer.from(json(current))):null;
        const targetManifestHash=hash(Buffer.from(json(j.project.manifest)));
        const expectedManifestHash=j.beforeManifestHash===undefined?hash(Buffer.from(json({...j.project.manifest,revision:j.base}))):j.beforeManifestHash;
        if(current && manifestHash!==targetManifestHash && manifestHash!==expectedManifestHash)throw Error('Recovery conflicts with manifest metadata. Files preserved.');
        const removed=j.removed || [];
        if(!Array.isArray(removed) || removed.some((id:any)=>typeof id!=='string' || !/^[a-f0-9-]{36}$/.test(id) || j.project.documents[id]))throw Error('Invalid deletion recovery evidence. Files preserved.');
        const ids=new Set<string>([...Object.keys(j.project.documents),...removed]);
        if(j.beforeHashes!==undefined && (!j.beforeHashes || typeof j.beforeHashes!=='object' || Array.isArray(j.beforeHashes)))throw Error('Invalid recovery base hashes. Files preserved.');
        for(const id of ids){
          const file=this.at('manuscript',id+'.json');const present=await exists(file);
          const saved=present?this.draftHash(JSON.parse(await fs.readFile(file,'utf8'))):null;
          const target=j.project.documents[id]?this.draftHash(j.project.documents[id]):null;
          const before=j.beforeHashes?.[id];
          if(before!==undefined && before!==null && !/^[a-f0-9]{64}$/.test(before))throw Error('Invalid recovery base hash. Files preserved.');
          if(saved!==target && (before===undefined || saved!==before))throw Error('Recovery conflicts with manuscript files or lacks base evidence. Files and journal preserved for inspection.');
        }
        const authorFile=this.at('author.json');
        const currentAuthorHash=await exists(authorFile)?hash(await fs.readFile(authorFile)):null;
        const targetAuthorHash=this.authorHash(j.project.author);
        const beforeAuthorHash=j.beforeAuthorHash;
        if(beforeAuthorHash!==undefined && beforeAuthorHash!==null && !/^[a-f0-9]{64}$/.test(beforeAuthorHash))throw Error('Invalid Author Workspace recovery base hash. Files preserved.');
        if(currentAuthorHash!==targetAuthorHash && (beforeAuthorHash===undefined || currentAuthorHash!==beforeAuthorHash))throw Error('Recovery conflicts with Author Workspace data or lacks base evidence. Files and journal preserved for inspection.');
        for(const {record} of await this.draftRecords(j.project)){
          const target=this.draftHash(j.project.documents[record.id]);
          if(this.draftHash(record.document)!==target && record.baseHash!==target)throw Error('Draft and save recovery evidence conflicts. All files preserved for inspection.');
        }
        const authorDraft=await this.authorDraft(j.project);if(authorDraft){const target=this.authorHash(j.project.author);if(this.authorHash(authorDraft.record.author)!==target && authorDraft.record.baseHash!==target)throw Error('Author Workspace and save recovery evidence conflicts. All files preserved for inspection.');}
        let coupledChoice=false;const coupled=await this.coupledDraft(j.project);
        if(coupled){try{await this.reconcileCoupled(j.project,true,j.project);}catch(error){
          this.checkCommentBodies(j.project);
          const protectedProject={...j.project,documents:{...j.project.documents,...coupled.record.documents},author:coupled.record.author};validate(protectedProject);this.checkCommentBodies(protectedProject);
          if(!approveRecovery||!await approveRecovery('Two coherent recovery versions differ. Open the interrupted saved version (revision '+j.project.manifest.revision+')? Both versions and original evidence will be preserved in .storyloom/recovery-evidence. The protected alternative can be imported with Recover Emergency JSON. Cancel keeps all files untouched.'))throw Error('Coupled recovery conflict: recovery choice required. All evidence preserved.');
          const folder=this.at('.storyloom','recovery-evidence',randomUUID());await fs.mkdir(folder,{recursive:true});
          await atomic(path.join(folder,'journal.json'),await fs.readFile(journal));
          await atomic(path.join(folder,'saved-version.json'),json(j.project));
          await atomic(path.join(folder,'protected-version.json'),json(protectedProject));
          await atomic(path.join(folder,'decision.json'),json({choice:'interrupted-save',revision:j.project.manifest.revision}));
          await fs.rename(coupled.file,path.join(folder,'comment-draft.json'));
          coupledChoice=true;recovery.push('Opened the chosen interrupted save. Both recovery versions and original evidence are preserved in '+folder);
        }}

        if(approveRecovery && !coupledChoice && !await approveRecovery(`An interrupted save for ${j.project.manifest.title} is available (revision ${j.project.manifest.revision}, ${j.project.manifest.nodes.length} documents). Recover it now? Cancel leaves all recovery evidence intact.`))throw Error('Recovery canceled. Project and journal preserved.');
        await this.materialize(j.project,j.removed,undefined,j.structural===true); await this.reconcileCoupled(j.project,false,j.project); await fs.unlink(journal); recovery.push('An interrupted save was recovered from the journal.');
      }
      const manifest = JSON.parse(await fs.readFile(this.manifestPath,'utf8'));
      // Validate IDs before using them as file names.
      if (!Array.isArray(manifest.nodes) || manifest.nodes.some((n: any) => !/^[a-f0-9-]{36}$/.test(n.id))) throw Error('Invalid manuscript paths.');
      const documents: Record<string,Doc> = {};
      for (const n of manifest.nodes) documents[n.id] = JSON.parse(await fs.readFile(this.at('manuscript',n.id+'.json'),'utf8'));
      const author=await exists(this.at('author.json'))?JSON.parse(await fs.readFile(this.at('author.json'),'utf8')):defaultAuthor(legacyQuickNotesId(manifest.id));
      this.project = ensureAuthor({manifest,documents,author,recovery}); validate(this.project);
      await this.history.initialize();
      await this.migrateManifest();
      const paired=await this.coupledDraft();if(paired){const r=paired.record,recovered=structuredClone(this.project);const savedAuthor=this.authorHash(recovered.author);if(savedAuthor!==r.beforeAuthorHash&&savedAuthor!==this.authorHash(r.author))throw Error('Coupled Author recovery conflicts with newer data. Evidence preserved.');for(const [id,body] of Object.entries(r.documents)){const saved=this.draftHash(recovered.documents[id]);if(saved!==r.beforeHashes[id]&&saved!==this.draftHash(body as Doc))throw Error('Coupled prose recovery conflicts with newer data. Evidence preserved.');recovered.documents[id]=body as Doc;}recovered.author=r.author;this.checkCommentBodies(recovered);if(approveRecovery&&!await approveRecovery('Recover protected manuscript and comment changes together?'))throw Error('Coupled recovery canceled. Evidence preserved.');await this.retireSuperseded(r);await this.commit(recovered);this.project.recovery.push('Protected manuscript and comments recovered together.');}
      const pending=await this.draftRecords();const recovered=structuredClone(this.project);let changed=false;
      for(const {record} of pending){
        const saved=this.draftHash(documents[record.id]);
        if(saved===this.draftHash(record.document))continue;
        if(saved!==record.baseHash)throw Error('Draft recovery conflicts with newer manuscript content. Recovery files were preserved in .storyloom/drafts.');
        recovered.documents[record.id]=record.document;changed=true;
      }
      if(changed){
        if(approveRecovery && !await approveRecovery(`${manifest.title} has protected editor changes that were waiting for autosave. Recover ${pending.length} document(s)? Cancel preserves the saved project and recovery files.`))throw Error('Draft recovery canceled. Files preserved.');
        await this.commit(recovered);this.project.recovery.push('Protected editor changes recovered after interruption.');
      }else for(const {file} of pending)await fs.unlink(file);
      const authorDraft=await this.authorDraft();if(authorDraft){const saved=this.authorHash(this.project.author),drafted=this.authorHash(authorDraft.record.author);if(saved===drafted)await fs.unlink(authorDraft.file);else{if(saved!==authorDraft.record.baseHash)throw Error('Author Workspace recovery conflicts with newer canonical data. Recovery file preserved.');if(approveRecovery && !await approveRecovery(`${manifest.title} has protected Author Workspace changes waiting for autosave. Recover them now? Cancel preserves the saved project and recovery file.`))throw Error('Author Workspace recovery canceled. File preserved.');const recovered=structuredClone(this.project);recovered.author=authorDraft.record.author;await this.commit(recovered);this.project.recovery.push('Protected Author Workspace changes recovered after interruption.');}}
      try { const state=JSON.parse(await fs.readFile(this.at('.storyloom','backup-state.json'),'utf8')); if(state.version===1 && typeof state.fingerprint==='string' && /^(?:StoryLoom|PageHearth)-[a-zA-Z0-9-]+\.zip$/.test(state.file)){await Store.verifyBackup(path.join(await this.backupDirectory(),state.file));this.backedUpFingerprint=state.fingerprint;} } catch { /* Missing/corrupt backup bookkeeping or archive means a fresh verified baseline is needed. */ }
      let repaired=this.project;for(const c of Object.values(this.project.author.comments?.byId||{}))if(c.anchor.status==='attached'&&this.project.author.comments!.documentBases[c.anchor.documentId]!==commentBody(this.project.documents[c.anchor.documentId]))repaired={...repaired,author:{...repaired.author,comments:invalidateComments(repaired.author.comments,c.anchor.documentId,repaired.documents[c.anchor.documentId],'unmapped-replacement')}};if(repaired!==this.project){await this.commit(repaired);this.project.recovery.push('Comments with unproven body evidence are Anchor Missing.');}
      return this.project;
    } catch(e) { await this.release(); throw e; }
  }
  private async migrateManifest() {
    if(!this.manifestName.toLowerCase().endsWith('.pagehearth')){
      const bytes=await fs.readFile(this.manifestPath);
      const destination=this.at(MANIFEST);
      // Publish without replacing any existing file; the project lock is shared with legacy builds.
      const temp=destination+'.'+randomUUID()+'.tmp';
      await atomic(temp,bytes);
      try{await fs.link(temp,destination);}catch(e:any){if(['ENOSYS','ENOTSUP','EOPNOTSUPP','EXDEV'].includes(e.code))throw Error('Legacy migration needs same-folder hard-link support. Copy the complete original project to a local NTFS drive and open that copy. The legacy source remains intact.');throw e;}finally{await fs.unlink(temp);}
      if(!(await fs.readFile(destination)).equals(bytes))throw Error('Manifest migration verification failed. Legacy files were preserved.');
      this.manifestName=MANIFEST;
      this.project.recovery.push('Legacy project migrated to PageHearth. Original manifest retained in .storyloom/legacy-manifests.');
    }
    // Also finish an interrupted migration. Archive, never discard, the old entry point:
    // an old executable must not reopen a stale manifest against the shared manuscript.
    const legacy=(await fs.readdir(this.root,{withFileTypes:true})).filter(e=>e.isFile() && (e.name===LEGACY_MANIFEST || e.name.toLowerCase().endsWith('.storyloom'))).map(e=>e.name);
    for(const name of legacy){
      const original=JSON.parse(await fs.readFile(this.at(name),'utf8'));
      if(json(original)!==json(this.project.manifest))throw Error('Legacy manifest conflicts with the current project. Files were preserved.');
      await fs.mkdir(this.at('.storyloom','legacy-manifests'),{recursive:true});
      await fs.rename(this.at(name),this.at('.storyloom','legacy-manifests',randomUUID()+'-'+name));
    }
  }
  private async materialize(p: Project,removed:string[]=[],previous?:Project,preserveHistory=false ) {
    if(!Array.isArray(removed) || removed.some(id=>! /^[a-f0-9-]{36}$/.test(id) || Object.hasOwn(p.documents,id)))throw Error('Invalid document deletion journal.');
    for (const n of p.manifest.nodes) if(!previous || json(previous.documents[n.id])!==json(p.documents[n.id]))await atomic(this.at('manuscript',n.id+'.json'),json(p.documents[n.id]));
    if(!previous || json(previous.author)!==json(p.author))await atomic(this.at('author.json'),json(p.author));
    await atomic(this.manifestPath,json(p.manifest));
    for(const id of removed)await fs.unlink(this.at('manuscript',id+'.json')).catch(e=>{if(e.code!=='ENOENT')throw e;});
    for(const id of removed)await fs.unlink(this.at('.storyloom','drafts',id+'.json')).catch(e=>{if(e.code!=='ENOENT')throw e;});
    if(removed.length&&!preserveHistory)await this.history.cleanup(removed,p);
  }
  commit(p:Project,base=this.project.manifest.revision){const copy=structuredClone(p);return this.mutate(()=>this.commitNow(copy,base));}
  private async commitNow(p: Project, base:number,structural?:SceneOperation|true) {
    if (!this.held) throw Error('Project lock is not held.');
    validate(p);this.checkCommentBodies(p);
    if (base !== -1 && (p.manifest.revision !== base || this.project.manifest.revision !== base)) throw Error('This save is outdated. Your edits remain open.');
    const journalFile=this.at('.storyloom','journal.json');
    const retrying=await exists(journalFile);
    const pending:any=retrying?JSON.parse(await fs.readFile(journalFile,'utf8')):null;
    if (retrying) {
      if(pending.structural)throw Error('Recover the interrupted structural transaction before saving. Files preserved.');
      pending.project=ensureAuthor(pending.project); validate(pending.project);
      if(pending.base !== base || pending.project.manifest.id !== p.manifest.id || pending.project.manifest.revision !== base+1) throw Error('Conflicting interrupted save. Save a recovery copy before proceeding.');
      // Same session retry: latest in-memory content supersedes its own interrupted commit.
    }
    const next = structuredClone(p); next.manifest.revision = base + 1;
    // Reject incompatible protection before publishing a journal or canonical files.
    await this.reconcileCoupled(next,true);
    const removed=this.project.manifest.nodes.filter(n=>!next.manifest.nodes.some(x=>x.id===n.id)).map(n=>n.id);
    if(removed.length&&!structural){changeTree(this.project,{kind:'delete',ids:removed});await this.checkExternalReferences(removed);if(this.backupDirty)throw Error('Create a verified backup before permanently deleting documents.');}
    const beforeHashes=retrying?pending.beforeHashes:Object.fromEntries([...new Set([...Object.keys(this.project.documents),...Object.keys(next.documents)])].map(id=>[id,base===-1 || !this.project.documents[id]?null:this.draftHash(this.project.documents[id])]));
    const beforeAuthorHash=retrying?pending.beforeAuthorHash:base===-1 || !await exists(this.at('author.json'))?null:this.authorHash(this.project.author);
    await atomic(journalFile,json({base,project:next,removed,...(structural?{structural:true}:{}),beforeHashes,beforeAuthorHash,beforeManifestHash:retrying?pending.beforeManifestHash:base===-1?null:hash(Buffer.from(json(this.project.manifest)))}));
    // Replay still materializes the complete journal. Ordinary commits only write changed prose.
    await this.materialize(next,removed,base===-1 || retrying?undefined:this.project,!!structural);
    await this.reconcileCoupled(next);
    await this.reconcileDrafts(next);
    await fs.unlink(journalFile);
    if(base===-1 || this.fingerprint(next)!==this.fingerprint(this.project))this.generation++;
    const edited=base===-1?[]:next.manifest.nodes.filter(n=>!n.trashed&&['Chapter','Scene'].includes(n.kind)&&json(next.documents[n.id])!==json(this.project.documents[n.id]));
    this.project = next;
    for(const node of edited){this.historyEdited.add(node.id);void this.historyBoundary(node.id);}
    return next;
  }
  async rebuildIndex() {
    const { DatabaseSync } = await import('node:sqlite');
    const temp = this.at('.storyloom',`index-${randomUUID()}.sqlite`);
    const db = new DatabaseSync(temp);
    try { db.exec('BEGIN; DROP TABLE IF EXISTS documents; CREATE TABLE documents(id TEXT PRIMARY KEY, title TEXT, body TEXT);'); const stmt = db.prepare('INSERT INTO documents VALUES(?,?,?)'); for (const n of this.project.manifest.nodes) stmt.run(n.id,n.title,plain(this.project.documents[n.id])); db.exec('COMMIT'); } finally { db.close(); }
    await fs.rename(temp,this.at('.storyloom','index.sqlite'));
  }
  backup() {return this.history.exclusive(()=>this.backupNow());}
  private async backupNow() {
    if (await exists(this.at('.storyloom','journal.json'))) throw Error('Recover the interrupted save before creating a backup.');
    const captured=structuredClone(this.project);const fingerprint=this.fingerprint(captured);const directory=await this.backupDirectory();
    const files: Record<string,ArchiveInput> = {};
    const walk = async (dir: string, rel = '') => { for (const entry of await fs.readdir(dir,{withFileTypes:true})) { const name = rel + entry.name; if (!rel && ['backups','.storyloom','exports'].includes(name)) continue; if (entry.isSymbolicLink()) throw Error('Backups cannot include symbolic links.'); if (entry.isDirectory()) await walk(path.join(dir,entry.name),name+'/'); else if (entry.isFile() && !name.endsWith('.tmp')) files[name] = {name,file:path.join(dir,entry.name)}; } };
    await walk(this.root);
    const writingSnapshot=await this.writing.snapshot();files['writing.json']={name:'writing.json',bytes:writingSnapshot};
    // Canonical text is one coherent committed snapshot, even if a caller commits during asset reads.
    files[this.manifestName]={name:this.manifestName,bytes:strToU8(json(captured.manifest))};
    files['author.json']={name:'author.json',bytes:strToU8(json(captured.author))};
    for(const node of captured.manifest.nodes)files[`manuscript/${node.id}.json`]={name:`manuscript/${node.id}.json`,bytes:strToU8(json(captured.documents[node.id]))};

    const name = `PageHearth-${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID()}.zip`;
    const target=path.join(directory,name),temp=target+'.'+randomUUID()+'.tmp';
    try{await writeArchive(temp,Object.values(files));await Store.verifyBackup(temp);await fs.rename(temp,target);}catch(error){await fs.unlink(temp).catch(()=>{});throw error;}
    const old = (await fs.readdir(directory)).filter(n => /^(?:StoryLoom|PageHearth)-.*\.zip$/.test(n)).sort((a,b)=>b.replace(/^(?:StoryLoom|PageHearth)-/,'').localeCompare(a.replace(/^(?:StoryLoom|PageHearth)-/,'')));
    for (const n of old.slice(20)) { await Store.verifyBackup(path.join(directory,n)); await fs.unlink(path.join(directory,n)); }
    await atomic(this.at('.storyloom','backup-state.json'),json({version:1,fingerprint,file:name}));
    this.backedUpFingerprint=fingerprint;
    this.writing.markBackedUp(writingSnapshot);
    return target;
  }
  async backupIfChanged(){return this.backupDirty||this.writing.backupDirty ? this.backup() : null;}
  static async verifyBackup(file: string) {
    await readBackup(file);
    return true;
  }
  async release(){await this.writing.close();await this.history.settled();return this.mutate(()=>this.releaseNow());}
  private async releaseNow() {
    if (!this.held) return;
    const file = this.at('.storyloom','lock.json'); const lock = JSON.parse(await fs.readFile(file,'utf8'));
    if (lock.token !== this.token) throw Error('Project lock ownership changed.');
    await fs.unlink(file); this.held = false;
  }
  async historyBoundary(id?:string){if(Date.now()<this.historyRetryAfter)return;for(const key of id?[id]:this.historyEdited){if(!this.historyEdited.has(key)||!this.project.documents[key]||this.project.manifest.nodes.find(n=>n.id===key)?.trashed)continue;try{await this.history.capture(key,this.project.documents[key],'automatic');this.historyWarning='';}catch(error){this.historyRetryAfter=Date.now()+15*60*1000;this.historyWarning='Automatic History could not finish; retry after the next eligible edit: '+String(error);break;}}}
  async close(skipUnapprovedBackup=false) { await this.historyBoundary();try{await this.backupIfChanged();}catch(error){if(!skipUnapprovedBackup||!(error instanceof ExternalAccessRequired))throw error;} await this.release(); }
}
