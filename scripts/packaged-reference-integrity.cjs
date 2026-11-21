// Packaged Electron-as-Node storage acceptance; not native GUI acceptance.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{randomUUID}=require('node:crypto');
(async()=>{
 if(!process.versions.electron)throw Error('Use packaged Electron with ELECTRON_RUN_AS_NODE=1.');
 const archive=path.resolve(process.argv[2]),load=p=>import(pathToFileURL(path.join(archive,'dist-main',p)).href);
 const {Store}=await load('main/storage.js'),{restoredCopy}=await load('shared/history.js'),{projectReferenceRanges}=await load('shared/referenceIntegrity.js'),{bodyFingerprint}=await load('shared/sceneSelection.js');
 const root=await fs.mkdtemp(path.resolve('.acceptance/reference-integrity/packaged-'));let store=new Store(root);const checks=[];
 try{
  await store.create('Reference integrity smoke');const p=structuredClone(store.project),id=p.manifest.nodes[0].id,occ=randomUUID(),target=randomUUID();p.documents[id]={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Mi',marks:[{type:'entityReference',attrs:{targetId:target,occurrenceId:occ}}]},{type:'text',text:'na',marks:[{type:'bold'},{type:'entityReference',attrs:{targetId:target,occurrenceId:occ}}]},{type:'text',text:' walks.'}]}]};
  await store.stageDocument(id,p.documents[id]);await store.commit(p);assert.equal(projectReferenceRanges(store.project).size,1);checks.push('protected draft and canonical formatted reference commit');
  const snapshot=await store.history.capture(id,p.documents[id],'manual','Reference snapshot');const record=await store.history.read(id,snapshot.id);await store.commit(restoredCopy(store.project,id,record.body,'Restored reference copy'));assert.equal(projectReferenceRanges(store.project).size,2);checks.push('snapshot read and restore-as-new distinct occurrence identity');
  const result=await store.createScene({projectId:p.manifest.id,revision:store.project.manifest.revision,sourceId:id,from:1,to:5,body:bodyFingerprint(store.project.documents[id])});assert.notEqual(projectReferenceRanges(store.project).get(occ).documentId,id);checks.push('complete formatted reference moves once into Scene');
  await store.traverseScene(p.manifest.id,store.project.manifest.revision,result.operationId,'undo');assert.equal(projectReferenceRanges(store.project).get(occ).documentId,id);await store.traverseScene(p.manifest.id,store.project.manifest.revision,result.operationId,'redo');assert.notEqual(projectReferenceRanges(store.project).get(occ).documentId,id);checks.push('structural Undo/Redo retains occurrence identity');
  await assert.rejects(store.history.prepareRestore(id,snapshot.id,store.project.documents[id]),/Duplicate/);checks.push('same-document historical collision refuses');
  assert.deepEqual((await store.writing.read()).days,{});const backup=await store.backup();assert.equal(await Store.verifyBackup(backup),true);checks.push('zero authored Activity and verified backup');
  const expected=structuredClone(store.project.documents);await store.release();store=new Store(root);await store.open();assert.deepEqual(store.project.documents,expected);assert.equal(projectReferenceRanges(store.project).size,2);checks.push('reopen exact canonical bodies and identities');
  console.log(JSON.stringify({root,backup,electron:process.versions.electron,nativeGUI:false,checks},null,2));
 }finally{await store.release();}
})().catch(e=>{console.error(e);process.exitCode=1;});
