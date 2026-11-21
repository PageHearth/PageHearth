// Host packaging fallback: Windows intermittently rejects electron-builder's
// immediate chmod after copying the physical ICO. Copy and verify the same
// configured resource without changing permissions, artwork or shell identity.
const {build,Platform,Arch}=require('electron-builder');
const {promises:fs}=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
async function readCopied(file){for(let attempt=0;;attempt++){try{return await fs.readFile(file);}catch(error){if(!['EPERM','EACCES'].includes(error.code)||attempt===7)throw error;await new Promise(resolve=>setTimeout(resolve,250));}}}
const config=require('../package.json').build;
const expected={from:'assets/branding/pagehearth/PageHearth_App_Icon.ico',to:'branding/PageHearth_App_Icon.ico'};
if(config.extraResources.length!==1||config.extraResources[0].from!==expected.from||config.extraResources[0].to!==expected.to)throw Error('Review changed resource configuration before using this fallback.');
build({targets:Platform.WINDOWS.createTarget(['nsis'],Arch.x64),config:{directories:{output:'release/import-candidate'},extraResources:null,afterPack:async context=>{const source=path.resolve(expected.from),target=path.join(context.appOutDir,'resources',expected.to);await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(source,target);const hash=b=>createHash('sha256').update(b).digest('hex');if(hash(await fs.readFile(source))!==hash(await readCopied(target)))throw Error('Packaged physical ICO failed verification.');console.log('Approved physical ICO copied and SHA-256 verified.');}}}).then(()=>console.log('NSIS fallback build complete.'),error=>{console.error(error);process.exit(1);});
