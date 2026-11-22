// SPDX-License-Identifier: MPL-2.0
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {build,Platform,Arch}=require('electron-builder');
const {withShellTemplates}=require('./nsis-shell-adapter.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex').toUpperCase();
async function main(){
 const pkg=require('../package.json');if(pkg.version!=='0.1.2'||pkg.devDependencies.electron!=='44.11.1')throw Error('Version mismatch');
 const baseline=path.resolve('release/candidates/official-repository-updater');
 if(sha(fs.readFileSync(path.join(baseline,'PageHearth-Setup-0.1.2.exe')))!=='542373E3F3FE0BA9351D350005F86F08E8EE1F214905B314524437C1FC8967A7')throw Error('Baseline mismatch');
 const output=path.resolve('release/candidates/microsoft-recipient-terms-final'),evidence=path.resolve('.acceptance/microsoft-recipient-terms-final');
 if(fs.existsSync(output))throw Error('Preserve candidate');fs.mkdirSync(output,{recursive:true});fs.mkdirSync(evidence,{recursive:true});
 const runtime=path.join(output,'win-unpacked');fs.cpSync(path.join(baseline,'win-unpacked'),runtime,{recursive:true,filter:src=>!path.relative(path.join(baseline,'win-unpacked'),src).replaceAll('\\','/').match(/^resources\/documentation\/legal(?:\/|$)/)});
 const archive=path.join(runtime,'resources/app.asar');
 const imports=require('./verify-packaged-imports.cjs').verify(path.join(runtime,'PageHearth.exe'),archive);fs.writeFileSync(path.join(evidence,'isolated-imports.json'),JSON.stringify(imports,null,2));
 const manifest=JSON.parse(fs.readFileSync(path.join(runtime,'resources/epub/runtime.json')));
 if(manifest.files.filter(f=>f.path.startsWith('java/')).length!==316)throw Error('JRE count');
 for(const f of manifest.files){const b=fs.readFileSync(path.join(runtime,'resources/epub',f.path));if(b.length!==f.bytes||sha(b)!==f.sha256.toUpperCase())throw Error('Runtime integrity '+f.path)}
 execFileSync(process.execPath,['scripts/build-distribution-legal.mjs',archive],{stdio:'inherit',env:{...process.env,PAGEHEARTH_LEGAL_OUTPUT:path.join(runtime,'resources/documentation/legal')}});
 const config={...pkg.build,publish:null,directories:{...pkg.build.directories,output},electronVersion:'44.11.1'};
 await withShellTemplates(path.join(evidence,'templates'),()=>build({projectDir:process.cwd(),prepackaged:runtime,targets:Platform.WINDOWS.createTarget(['nsis'],Arch.x64),publish:'never',config}));
 const installer=path.join(output,'PageHearth-Setup-0.1.2.exe');
 const receipt={installer,bytes:fs.statSync(installer).size,sha256:sha(fs.readFileSync(installer)),runtime,appAsarUnchanged:sha(fs.readFileSync(archive))===sha(fs.readFileSync(path.join(baseline,'win-unpacked/resources/app.asar'))),runtimeEntries:manifest.files.length,javaFiles:316,agreementSha256:sha(fs.readFileSync(pkg.build.nsis.license)),nativeAcceptance:'Pending',status:'PRIVATE REVIEW ONLY; text requires Hush approval; provenance uncertainty not legally certified'};
 fs.writeFileSync(path.join(evidence,'candidate.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
