const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {build,Platform,Arch}=require('electron-builder');
const {withShellTemplates}=require('./nsis-shell-adapter.cjs');
async function main(){
 const root=process.cwd(),pkg=require('../package.json');
 if(pkg.version!=='0.1.2'||pkg.devDependencies.electron!=='44.11.1')throw Error('Version mismatch');
 const output=path.resolve('release/candidates/winshell-replacement-verified');
 const evidence=path.resolve('.acceptance/winshell-replacement-verified');
 if(fs.existsSync(output))throw Error('Preserve existing candidate');
 fs.mkdirSync(evidence,{recursive:true});
 const runtime=path.join(evidence,'runtime');
 if(fs.existsSync(runtime))throw Error('Preserve prior runtime');
 fs.cpSync('release/candidates/about-support-icon/win-unpacked',runtime,{recursive:true});
 execFileSync(process.execPath,['scripts/build-distribution-legal.mjs',path.join(runtime,'resources/app.asar')],{stdio:'inherit'});
 fs.cpSync('dist-legal',path.join(runtime,'resources/documentation/legal'),{recursive:true});
 const config={...pkg.build,publish:null,directories:{...pkg.build.directories,output},electronVersion:'44.11.1'};
 if(config.nsis.script)throw Error('Must preserve standard uninstaller generation');
 await withShellTemplates(path.join(evidence,'templates'),()=>build({projectDir:root,prepackaged:runtime,targets:Platform.WINDOWS.createTarget(['nsis'],Arch.x64),publish:'never',config}));
 const file=path.join(output,'PageHearth-Setup-0.1.2.exe'),b=fs.readFileSync(file);
 const receipt={file,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};
 fs.writeFileSync(path.join(evidence,'candidate.json'),JSON.stringify(receipt,null,2));console.log(receipt);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
