// SPDX-License-Identifier: MPL-2.0
// Internal assembly only. No upload, installer execution or release authorization.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {build,Platform,Arch}=require('electron-builder');
const {withShellTemplates}=require('./nsis-shell-adapter.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex').toUpperCase();
async function main(){
 const pkg=require('../package.json');
 if(pkg.version!=='0.1.2'||pkg.devDependencies.electron!=='44.11.1')throw Error('Version mismatch');
 const output=path.resolve('release/candidates/official-repository-updater');
 const evidence=path.resolve('.acceptance/official-repository-updater');
 const runtime=path.join(output,'win-unpacked');
 if(fs.existsSync(output))throw Error('Preserve existing candidate');
 const accepted='release/candidates/typst-bundled-runtime-path/PageHearth-Setup-0.1.2.exe';
 if(sha(fs.readFileSync(accepted))!=='B730A5894ED36985276168E1B7D22E56C06C1C20FF88A721C7EDCAF30108EFB6')throw Error('Accepted baseline mismatch');
 fs.mkdirSync(output,{recursive:true});fs.mkdirSync(evidence,{recursive:true});
 const baseline=path.resolve('release/candidates/typst-bundled-runtime-path/win-unpacked');
 fs.cpSync(baseline,runtime,{recursive:true,filter:src=>!path.relative(baseline,src).replaceAll('\\','/').match(/^resources\/documentation\/legal(?:\/|$)/)});
 const manifest=JSON.parse(fs.readFileSync(path.join(runtime,'resources/epub/runtime.json'),'utf8'));
 const javaFiles=manifest.files.filter(f=>f.path.startsWith('java/'));
 if(javaFiles.length!==316)throw Error('Expected unchanged 316-file Temurin runtime');
 for(const f of manifest.files){const bytes=fs.readFileSync(path.join(runtime,'resources/epub',f.path));if(bytes.length!==f.bytes||sha(bytes)!==f.sha256.toUpperCase())throw Error('Runtime integrity mismatch: '+f.path);}
 for(const f of javaFiles){if(!fs.readFileSync(path.join('assets/epub',f.path)).equals(fs.readFileSync(path.join(runtime,'resources/epub',f.path))))throw Error('JRE source mismatch: '+f.path);}
 const asar=require('@electron/asar'),archive=path.join(runtime,'resources/app.asar'),stage=fs.mkdtempSync(path.join(evidence,'app-'));
 asar.extractAll(archive,stage);
 // Only compiled application output changes. Preserve accepted production packages and unpack layout.
 for(const d of ['dist','dist-main']){const target=path.join(stage,d);if(!target.startsWith(stage+path.sep))throw Error('Unsafe stage');fs.rmSync(target,{recursive:true,force:true});fs.cpSync(d,target,{recursive:true});}
 const packagedManifest=JSON.parse(fs.readFileSync(path.join(stage,'package.json'),'utf8'));packagedManifest.repository=pkg.repository;fs.writeFileSync(path.join(stage,'package.json'),JSON.stringify(packagedManifest,null,2));
 const unpacked=asar.listPackage(archive).map(f=>f.replace(/^[/\\]/,'')).filter(f=>!asar.statFile(archive,f).files&&asar.statFile(archive,f).unpacked).map(f=>f.replace(/^[/\\]/,'').replaceAll('\\','/'));
 await asar.createPackageWithOptions(stage,archive,{unpackDir:path.join('node_modules','@napi-rs','canvas-win32-x64-msvc')});
 const resultUnpacked=asar.listPackage(archive).map(f=>f.replace(/^[/\\]/,'')).filter(f=>!asar.statFile(archive,f).files&&asar.statFile(archive,f).unpacked).map(f=>f.replaceAll('\\','/'));
 if(JSON.stringify(resultUnpacked.sort())!==JSON.stringify(unpacked.sort()))throw Error('Unpack layout changed');
 const imports=require('./verify-packaged-imports.cjs').verify(path.join(runtime,'PageHearth.exe'),archive);
 fs.writeFileSync(path.join(evidence,'isolated-imports.json'),JSON.stringify(imports,null,2));
 const legal=path.join(runtime,'resources/documentation/legal');
 execFileSync(process.execPath,['scripts/build-distribution-legal.mjs',path.join(runtime,'resources/app.asar')],{stdio:'inherit',env:{...process.env,PAGEHEARTH_LEGAL_OUTPUT:legal}});
 const config={...pkg.build,publish:null,directories:{...pkg.build.directories,output},electronVersion:'44.11.1'};
 if(config.nsis.script)throw Error('Preserve standard installer lifecycle');
 await withShellTemplates(path.join(evidence,'templates'),()=>build({projectDir:process.cwd(),prepackaged:runtime,targets:Platform.WINDOWS.createTarget(['nsis'],Arch.x64),publish:'never',config}));
 const installer=path.join(output,'PageHearth-Setup-0.1.2.exe');
 const receipt={status:'INTERNAL ONLY; retained Microsoft redistribution interpretation unresolved',head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),installer,bytes:fs.statSync(installer).size,sha256:sha(fs.readFileSync(installer)),runtime,appAsarSha256:sha(fs.readFileSync(path.join(runtime,'resources/app.asar'))),nsis:config.nsis,fileAssociations:config.fileAssociations};
 fs.writeFileSync(path.join(evidence,'candidate.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
