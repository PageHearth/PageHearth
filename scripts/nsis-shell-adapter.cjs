// SPDX-License-Identifier: MPL-2.0
// Isolated template copy: do not edit node_modules or opt into nsis.script.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const pins={
 'include/installer.nsh':['0e319437dd01dcbf911f3f48f664fde0cefbaef704f1cdb1739f63d563f5d4a0',7],
 'uninstaller.nsh':['9ee2dac4593478083e8aa6f8487287ce9401006ccd50ecc538871d133ea4a42c',3],
};
function adapt(text,file){
 const pin=pins[file];
 if(!pin||crypto.createHash('sha256').update(text).digest('hex')!==pin[0])throw Error(`Unreviewed NSIS template: ${file}`);
 let count=0;
 const result=text.replace(/WinShell::(SetLnkAUMI|UninstShortcut|UninstAppUserModelId)/g,(_,op)=>{count++;return '!insertmacro PH_'+op;});
 if(count!==pin[1]||result.includes('WinShell::'))throw Error('Unexpected WinShell call set');
 return '!include "pagehearth-shell.nsh"\n'+result;
}
async function withShellTemplates(destination,run){
 if(require('app-builder-lib/package.json').version!=='26.15.3')throw Error('Unreviewed electron-builder version');
 const util=require('app-builder-lib/out/targets/nsis/nsisUtil');
 const original=util.nsisTemplatesDir;
 const changed=Object.fromEntries(Object.keys(pins).map(f=>[f,adapt(fs.readFileSync(path.join(original,f),'utf8'),f)]));
 if(fs.existsSync(destination))throw Error('Preserve previous template evidence');
 fs.cpSync(original,destination,{recursive:true});
 for(const [f,text]of Object.entries(changed))fs.writeFileSync(path.join(destination,f),text);
 fs.copyFileSync(path.resolve('build/pagehearth-shell.nsh'),path.join(destination,'include/pagehearth-shell.nsh'));
 util.nsisTemplatesDir=destination;
 try{return await run();}finally{util.nsisTemplatesDir=original;}
}
module.exports={adapt,withShellTemplates,pins};
