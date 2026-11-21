const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {adapt,pins,withShellTemplates}=require('./nsis-shell-adapter.cjs');
const base=require('app-builder-lib/out/targets/nsis/nsisUtil').nsisTemplatesDir;
let checks=0;
for(const f of Object.keys(pins)){
 const original=fs.readFileSync(path.join(base,f),'utf8'),changed=adapt(original,f);
 assert(!changed.includes('WinShell::'));checks++;
 assert.equal(changed.replace('!include "pagehearth-shell.nsh"\n','').replace(/!insertmacro PH_(SetLnkAUMI|UninstShortcut|UninstAppUserModelId)/g,'WinShell::$1'),original);checks++;
 assert.throws(()=>adapt(original+'\n',f),/Unreviewed/);checks++;
}
assert.throws(()=>adapt('', 'other.nsh'),/Unreviewed/);checks++;
async function lifecycle(){
 const util=require('app-builder-lib/out/targets/nsis/nsisUtil');
 const directory=path.resolve('.acceptance/winshell-replacement/adapter-test-'+Date.now());
 await assert.rejects(withShellTemplates(directory,async()=>{assert.equal(util.nsisTemplatesDir,directory);throw Error('synthetic packaging failure');}),/synthetic packaging failure/);checks++;
 assert.equal(util.nsisTemplatesDir,base);checks++;
 for(const f of Object.keys(pins)){adapt(fs.readFileSync(path.join(base,f),'utf8'),f);checks++;}
 console.log(`${checks} adapter checks PASS`);
}
lifecycle().catch(e=>{console.error(e);process.exitCode=1;});
