// Packaged Node/ASAR execution, not native GUI acceptance.
const path=require('node:path'),fs=require('node:fs/promises'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
(async()=>{
 if(!process.versions.electron)throw Error('Use the packaged EXE with ELECTRON_RUN_AS_NODE=1.');
 const archive=path.resolve(process.argv[2]||'release/win-unpacked/resources/app.asar');
 const {Store}=await import(pathToFileURL(path.join(archive,'dist-main/main/storage.js')).href);
 const {bodyFingerprint}=await import(pathToFileURL(path.join(archive,'dist-main/shared/sceneSelection.js')).href);
 await fs.mkdir('.acceptance/scene-selection',{recursive:true});const root=await fs.mkdtemp(path.resolve('.acceptance/scene-selection/packaged-'));let store=new Store(root);
 try{
  await store.create('Packaged scene smoke');const p=structuredClone(store.project),id=p.manifest.nodes[0].id;p.documents[id]={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'AAA BBB CCC'}]}]};await store.commit(p);
  const result=await store.createScene({projectId:p.manifest.id,revision:store.project.manifest.revision,sourceId:id,from:5,to:8,body:bodyFingerprint(store.project.documents[id])});assert.equal(result.pieceIds.length,3);
  await store.traverseScene(p.manifest.id,store.project.manifest.revision,result.operationId,'undo');assert.deepEqual(store.project.documents,p.documents);
  const redo=await store.traverseScene(p.manifest.id,store.project.manifest.revision,result.operationId,'redo');assert.deepEqual(redo.pieceIds,result.pieceIds);
  assert.deepEqual((await store.writing.read()).days,{});assert.equal(await Store.verifyBackup(await store.backup()),true);
  const canonical=structuredClone(store.project);await store.release();store=new Store(root);await store.open();assert.deepEqual(store.project.documents,canonical.documents);
  console.log(JSON.stringify({root,electron:process.versions.electron,checks:['packaged schema dependencies','create','one-step undo','stable-ID redo','zero Activity','verified backup','reopen'],nativeGUI:false},null,2));
 }finally{await store.release();}
})().catch(error=>{console.error(error);process.exitCode=1;});
