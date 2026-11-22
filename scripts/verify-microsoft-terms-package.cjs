const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex').toUpperCase();
const base='release/candidates/official-repository-updater/win-unpacked',next='release/candidates/microsoft-recipient-terms-final/win-unpacked';
assert.equal(sha(fs.readFileSync(base+'/resources/app.asar')),sha(fs.readFileSync(next+'/resources/app.asar')));
function same(dir){for(const e of fs.readdirSync(base+'/'+dir,{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())same(p);else assert.equal(sha(fs.readFileSync(base+'/'+p)),sha(fs.readFileSync(next+'/'+p)),p)}}
for(const d of ['resources/epub','resources/typst','resources/branding'])same(d);
const legal=next+'/resources/documentation/legal',manifest=JSON.parse(fs.readFileSync(legal+'/MATERIALS-MANIFEST.json'));
for(const f of manifest.files){const b=fs.readFileSync(legal+'/'+f.path);assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256.toUpperCase(),f.path)}
for(const file of ['MICROSOFT_RUNTIME_TERMS.txt','MICROSOFT_RUNTIME_AGREEMENT.txt'])assert.equal(sha(fs.readFileSync('assets/licenses/microsoft/'+file)),sha(fs.readFileSync(legal+'/supplemental/microsoft/'+file)));
assert.match(fs.readFileSync(legal+'/index.html','utf8'),/supplemental\/microsoft\/MICROSOFT_RUNTIME_AGREEMENT.txt/);
for(const f of ['installer-list.txt','uninstaller-list.txt']){const s=fs.readFileSync('.acceptance/microsoft-recipient-terms-final/'+f,'utf8');assert.ok(s.length>500);assert.ok(!/WinShell/i.test(s))}
const result={appAsarUnchanged:true,publishingPayloadUnchanged:true,legalFiles:manifest.files.length,agreementMatchesInstallerSource:true,winShellAbsentFromBoth:true,nativeAgreeDecline:'UNVERIFIED - stopped after screenshot targeting mismatch'};
fs.writeFileSync('.acceptance/microsoft-recipient-terms-final/payload-verification.json',JSON.stringify(result,null,2));console.log(result);
