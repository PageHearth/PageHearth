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
 const output=path.resolve('release/candidates/internal-beta-assembly-2026-11-19');
 const evidence=path.resolve('.acceptance/final-beta-assembly');
 const runtime=path.join(output,'win-unpacked');
 if(fs.existsSync(output))throw Error('Preserve existing candidate');
 const accepted='release/candidates/winshell-replacement-verified/PageHearth-Setup-0.1.2.exe';
 if(sha(fs.readFileSync(accepted))!=='506BFD185E136D322E0B35BB6B3DBDF313A4A0A612C35B81590346E581FFA445')throw Error('Accepted baseline mismatch');
 fs.mkdirSync(output,{recursive:true});fs.mkdirSync(evidence,{recursive:true});
 const baseline=path.resolve('.acceptance/winshell-replacement-verified/runtime');
 fs.cpSync(baseline,runtime,{recursive:true,filter:src=>!path.relative(baseline,src).replaceAll('\\','/').match(/^resources\/documentation\/legal(?:\/|$)/)});
 const legal=path.join(runtime,'resources/documentation/legal');
 execFileSync(process.execPath,['scripts/build-distribution-legal.mjs',path.join(runtime,'resources/app.asar')],{stdio:'inherit',env:{...process.env,PAGEHEARTH_LEGAL_OUTPUT:legal}});
 const config={...pkg.build,publish:null,directories:{...pkg.build.directories,output},electronVersion:'44.11.1'};
 if(config.nsis.script)throw Error('Preserve standard installer lifecycle');
 await withShellTemplates(path.join(evidence,'templates'),()=>build({projectDir:process.cwd(),prepackaged:runtime,targets:Platform.WINDOWS.createTarget(['nsis'],Arch.x64),publish:'never',config}));
 const installer=path.join(output,'PageHearth-Setup-0.1.2.exe');
 const receipt={status:'INTERNAL ONLY; Microsoft redistribution BLOCKED',head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),installer,bytes:fs.statSync(installer).size,sha256:sha(fs.readFileSync(installer)),runtime,appAsarSha256:sha(fs.readFileSync(path.join(runtime,'resources/app.asar'))),nsis:config.nsis,fileAssociations:config.fileAssociations};
 fs.writeFileSync(path.join(evidence,'candidate.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
