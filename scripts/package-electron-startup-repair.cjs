// A lockfile-backed, physical production install; no node_modules junction discovery.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {build,Platform,Arch}=require('electron-builder');
const {verify}=require('./verify-packaged-imports.cjs');
async function main(){
 const root=process.cwd(),prod=JSON.parse(fs.readFileSync('package.json'));
 if(prod.version!=='0.1.2'||prod.devDependencies.electron!=='44.11.1')throw Error('Unexpected runtime/application version');
 const output=path.resolve('release/candidates/electron-44-security-update-startup-repair');
 if(fs.existsSync(output))throw Error('Preserve existing candidate');
 const evidence=path.resolve('.acceptance/electron-startup-repair');fs.mkdirSync(evidence,{recursive:true});
 const app=fs.mkdtempSync(path.join(evidence,'package-'));
 for(const d of ['dist','dist-main','assets','build'])fs.cpSync(d,path.join(app,d),{recursive:true});
 fs.copyFileSync('package.json',path.join(app,'package.json'));fs.copyFileSync('package-lock.json',path.join(app,'package-lock.json'));
 const npmCli=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
 execFileSync(process.execPath,[npmCli,'ci','--omit=dev','--ignore-scripts','--no-audit','--no-fund','--fetch-retries=0','--fetch-timeout=30000'],{cwd:app,stdio:'inherit',timeout:180000,windowsHide:true});
 const config={...prod.build,publish:null,npmRebuild:false,electronVersion:'44.11.1',electronDist:path.join(root,'node_modules/electron/dist'),directories:{app,output},extraResources:null,afterPack:async c=>{
  for(const r of prod.build.extraResources){const src=path.resolve(r.from),dest=path.join(c.appOutDir,'resources',r.to);fs.cpSync(src,dest,{recursive:true});}
  const result=verify(path.join(c.appOutDir,'PageHearth.exe'),path.join(c.appOutDir,'resources/app.asar'));
  fs.writeFileSync(path.join(evidence,'isolated-imports.json'),JSON.stringify(result,null,2));
 }};
 await build({projectDir:app,targets:Platform.WINDOWS.createTarget(['nsis'],Arch.x64),publish:'never',config});
 const artifacts=['PageHearth-Setup-0.1.2.exe','win-unpacked/PageHearth.exe'].map(name=>{const file=path.join(output,name),bytes=fs.readFileSync(file);return{file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};});
 fs.writeFileSync(path.join(evidence,'artifacts.json'),JSON.stringify(artifacts,null,2));console.log(JSON.stringify(artifacts,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
