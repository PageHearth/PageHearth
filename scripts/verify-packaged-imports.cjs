// Resolve outside the checkout so repository node_modules cannot hide missing packages.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{pathToFileURL}=require('node:url'),{execFileSync}=require('node:child_process');
function verify(executable,archive){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'PageHearth-package-imports-'));
 fs.copyFileSync(archive,path.join(root,'app.asar'));
 if(fs.existsSync(archive+'.unpacked'))fs.cpSync(archive+'.unpacked',path.join(root,'app.asar.unpacked'),{recursive:true});
 const modules=['shared/revisionSchema.js','shared/manuscriptSchema.js','main/sceneOperations.js','main/importSchema.js'];
 const urls=modules.map(f=>pathToFileURL(path.join(root,'app.asar','dist-main',f)).href);
 const output=execFileSync(executable,['--input-type=module','-e',`for(const url of ${JSON.stringify(urls)}){await import(url);console.log('PASS '+url)};console.log(JSON.stringify(process.versions))`],{cwd:root,env:{...process.env,ELECTRON_RUN_AS_NODE:'1',NODE_PATH:''},encoding:'utf8',timeout:30000,windowsHide:true});
 console.log(output);return {root,modules}; // Retain isolated evidence; no broad temporary cleanup.
}
module.exports={verify};
if(require.main===module)verify(path.resolve(process.argv[2]),path.resolve(process.argv[3]));
