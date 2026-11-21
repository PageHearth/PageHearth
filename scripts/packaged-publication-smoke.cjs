// Runs the exact candidate's ASAR in Electron Node mode. Not native GUI acceptance.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
(async()=>{
 if(!process.versions.electron)throw Error('Run with the candidate executable and ELECTRON_RUN_AS_NODE=1.');
 const archive=path.resolve(process.argv[2]),load=file=>import(pathToFileURL(path.join(archive,'dist-main',file)).href);
 const {Store}=await load('main/storage.js'),{addPublicationPage,editPublication}=await load('shared/publication.js'),{compilePublication}=await load('shared/publicationCompiler.js'),{restoreBackup}=await load('main/archive.js');
 const root=await fs.mkdtemp(path.resolve('.acceptance/publish-foundation/packaged-'));let store=new Store(root),restored;
 try{
  await store.create('Packaged publication');const original=structuredClone(store.project.documents),a=addPublicationPage(store.project,'front','Dedication');const p=editPublication(a.project,p=>{p.metadata.author='Writer';p.metadata.identifiers.ebook='Optional ebook identifier';p.pages[a.id].body={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'For the readers 世界',marks:[{type:'italic'}]}]}]};});
  await store.stageAuthor(p.author,store.project.author);await store.release();store=new Store(root);await store.open(async()=>true);assert.deepEqual(store.project.author.publication,p.author.publication);assert.deepEqual(store.project.documents,original);
  const before=store.project.manifest.revision,compiled=compilePublication(store.project,'ebook');assert.ok(Object.isFrozen(compiled));assert.ok(JSON.stringify(compiled).includes('For the readers 世界'));assert.equal(store.project.manifest.revision,before);
  const archivePath=await store.backup();assert.equal(await Store.verifyBackup(archivePath),true);restored=new Store(await restoreBackup(archivePath,root));await restored.open();assert.deepEqual(restored.project.author.publication,p.author.publication);assert.deepEqual((await restored.writing.read()).days,{});
  const result={runtime:process.versions.electron,root,checks:['ASAR compiler/model loaded','protected publication recovery','immutable compile / no revision changes','verified backup / restore / portability','Unicode authored page and metadata retained','shared manuscript unchanged','zero Activity'],nativeGUI:false};await fs.writeFile(path.join(root,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{await restored?.release();await store.release();}
})().catch(error=>{console.error(error);process.exitCode=1;});
