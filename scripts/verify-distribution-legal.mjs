// SPDX-License-Identifier: MPL-2.0
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const asar=createRequire(import.meta.url)('@electron/asar');
const base=path.resolve(process.argv[2]||'release/candidates/licensing-compliance-review/win-unpacked');
const old=path.resolve('release/candidates/electron-44-security-update-startup-repair/win-unpacked');
const archive=path.join(base,'resources/app.asar'),original=path.join(old,'resources/app.asar');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=(a,p)=>asar.extractFile(a,path.normalize(p));
assert.equal(JSON.parse(read(archive,'package.json')).license,'MPL-2.0');
assert.equal(sha(read(archive,'LICENSE')),sha(fs.readFileSync('LICENSE')));
let checked=0;
function compareTree(source,destination){for(const ent of fs.readdirSync(source,{withFileTypes:true})){const a=path.join(source,ent.name),b=path.join(destination,ent.name);if(ent.isDirectory())compareTree(a,b);else {assert.equal(sha(fs.readFileSync(a)),sha(fs.readFileSync(b)),b);checked++;}}}
compareTree('dist-legal',path.join(base,'resources/documentation/legal'));
// Existing tools, guides and branding must remain byte-identical.
for(const dir of ['epub','typst','branding'])compareTree(path.join(old,'resources',dir),path.join(base,'resources',dir));
for(const file of ['PageHearth_Quick_Start_Guide.pdf','user-guide/index.html'])assert.equal(sha(fs.readFileSync(path.join(old,'resources/documentation',file))),sha(fs.readFileSync(path.join(base,'resources/documentation',file))));
let appFiles=0;
for(const file of asar.listPackage(original)){
 const p=file.replace(/^[/\\]/,'');if(!/^(dist|dist-main|assets[\\/]branding)[\\/]/.test(p))continue;
 let bytes;try{bytes=read(original,p);}catch{continue;}
 assert.equal(sha(read(archive,p)),sha(bytes),'Application/branding changed: '+p);appFiles++;
}
const inventory=JSON.parse(fs.readFileSync('dist-legal/npm-inventory.json'));
for(const item of inventory){const pkg=JSON.parse(read(archive,item.location+'/package.json'));assert.equal(pkg.version,item.version,item.name);}
for(const file of asar.listPackage(archive)){
 const p=file.replaceAll('\\','/').replace(/^\//,'');
 if(!p.startsWith('node_modules/')||!p.endsWith('/package.json'))continue;
 const pkg=JSON.parse(read(archive,p));if(!pkg.name||!pkg.version)continue;
 assert(inventory.some(i=>i.location+'/package.json'===p),'Missing inventory entry: '+p);
}
for(const text of ['saxes-ISC.txt','isarray-MIT.txt','NSIS-COPYING.txt'])assert(fs.readFileSync(path.join(base,'resources/documentation/legal/supplemental',text)).length>200);
assert(!fs.existsSync('build/license.txt'),'Unexpected automatic installer license page');
console.log(JSON.stringify({result:'PASS',resourceFiles:checked,unchangedApplicationFiles:appFiles,productionPackages:inventory.length,rootLicense:true,sourceArchive:true},null,2));
