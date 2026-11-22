// SPDX-License-Identifier: MPL-2.0
// Local-only assembly: never fetches source or license material at runtime/build time.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';
import {createRequire} from 'node:module';
const root=process.cwd(),out=path.resolve(process.env.PAGEHEARTH_LEGAL_OUTPUT||path.join(root,'dist-legal'));
const manifest=JSON.parse(await fs.readFile('package.json','utf8'));
const lock=JSON.parse(await fs.readFile('package-lock.json','utf8'));
assert.equal(manifest.license,'MPL-2.0');assert.equal(lock.packages[''].license,'MPL-2.0');
assert.equal(manifest.version,'0.1.2');assert.equal(manifest.devDependencies.electron,'44.11.1');
await fs.mkdir(out,{recursive:true});
for(const name of ['LICENSE','LICENSING.md'])await fs.copyFile(name,path.join(out,name));
for(const name of ['SOURCE-AVAILABILITY.md','THIRD-PARTY-NOTICES.md','BRANDING-POLICY-DRAFT.md','BETA-DISTRIBUTION-STATUS.md','MICROSOFT-RECIPIENT-TERMS-PROPOSAL.md'])await fs.copyFile(path.join('docs/licensing',name),path.join(out,name));
await fs.copyFile('docs/BETA-INSTRUCTIONS-DRAFT.md',path.join(out,'BETA-INSTRUCTIONS.md'));
await fs.cp('assets/licenses',path.join(out,'supplemental'),{recursive:true});
await fs.cp('assets/distribution-sources',path.join(out,'sources'),{recursive:true});
const source=await fs.readFile('assets/distribution-sources/saxon11-4source.zip');
assert.equal(crypto.createHash('sha256').update(source).digest('hex'),'7707309bcbc404775bac4cb180bd81bf1f40e9512c1a440d9ffdffaeb92558fb');
const inventory=[];
const archive=process.argv[2];
const asar=createRequire(import.meta.url)('@electron/asar');
const archiveFiles=archive?new Set(asar.listPackage(archive).map(p=>p.replaceAll('\\','/').replace(/^\//,''))):null;
if(archiveFiles){
 for(const file of archiveFiles){
  if(!file.startsWith('node_modules/')||!file.endsWith('/package.json'))continue;
  const pkg=JSON.parse(asar.extractFile(archive,path.normalize(file)));
  if(!pkg.name||!pkg.version)continue;
  const location=file.slice(0,-'/package.json'.length),prefix=location+'/',notices=[];
  for(const f of archiveFiles){
   if(!f.startsWith(prefix))continue;
   const rel=f.slice(prefix.length);
   if(rel.includes('node_modules/')||!/^(licen[cs]e|notice|copying|copyright|third.party)/i.test(path.basename(rel)))continue;
   let bytes;try{bytes=asar.extractFile(archive,path.normalize(f));}catch{continue;}
   const dest=path.join(out,'npm',location.slice('node_modules/'.length),rel);
   await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,bytes);notices.push(rel);
  }
  inventory.push({location,name:pkg.name,version:pkg.version,license:pkg.license,notices});
 }
}else{
for(const [location,entry] of Object.entries(lock.packages)){
 if(!location||entry.dev)continue;
 const base=path.join(root,location);let pkg;try{pkg=JSON.parse(await fs.readFile(path.join(base,'package.json'),'utf8'));}catch(e){if(e.code==='ENOENT'&&entry.optional)continue;throw e;}
 assert.equal(pkg.version,entry.version,location);
 const notices=[];
 async function visit(dir,relative=''){
  for(const f of await fs.readdir(dir,{withFileTypes:true})){
   if(f.name==='node_modules')continue;
   const rel=path.join(relative,f.name),file=path.join(dir,f.name);
   if(f.isDirectory()){await visit(file,rel);continue;}
   if(!f.isFile()||! /^(licen[cs]e|notice|copying|copyright|third.party)/i.test(f.name))continue;
   const target=path.join(out,'npm',location.replace(/^node_modules[\/]/,''),rel);
   await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(file,target);notices.push(rel.replaceAll('\\','/'));
  }
 }
 await visit(base);inventory.push({location,name:pkg.name,version:pkg.version,license:pkg.license,notices});
}
}
await fs.writeFile(path.join(out,'npm-inventory.json'),JSON.stringify(inventory,null,2)+'\n');
const md=new MarkdownIt({html:false,linkify:false});
for(const name of ['LICENSING.md','THIRD-PARTY-NOTICES.md','SOURCE-AVAILABILITY.md','BRANDING-POLICY-DRAFT.md','BETA-DISTRIBUTION-STATUS.md','MICROSOFT-RECIPIENT-TERMS-PROPOSAL.md','BETA-INSTRUCTIONS.md']){
 const text=await fs.readFile(path.join(out,name),'utf8');
 await fs.writeFile(path.join(out,name+'.html'),'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>PageHearth legal information</title><style>body{font:17px/1.6 system-ui;max-width:960px;margin:2rem auto;padding:0 1rem}table{border-collapse:collapse}td,th{border:1px solid #888;padding:.6rem}a,td{overflow-wrap:anywhere}</style><body>'+md.render(text)+'</body></html>');
}
// Simple offline entry point in the existing installed documentation folder.
await fs.writeFile(path.join(out,'index.html'),'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>PageHearth licenses</title><body><h1>PageHearth licenses and source information</h1><p>Internal candidate: external distribution remains on HOLD. Unresolved obligations are documented below.</p><p><a href="supplemental/microsoft/MICROSOFT_RUNTIME_AGREEMENT.txt">Microsoft runtime component agreement shown during installation</a> | <a href="supplemental/microsoft/MICROSOFT_RUNTIME_TERMS.txt">Microsoft component notices</a></p><ul>'+['LICENSE','LICENSING.md','THIRD-PARTY-NOTICES.md','SOURCE-AVAILABILITY.md','BRANDING-POLICY-DRAFT.md','BETA-DISTRIBUTION-STATUS.md','MICROSOFT-RECIPIENT-TERMS-PROPOSAL.md','BETA-INSTRUCTIONS.md','npm-inventory.json'].map(n=>`<li><a href="${n.endsWith('.md')?n+'.html':n}">${n}</a></li>`).join('')+'</ul></body></html>');
console.log(`Legal assembly PASS: ${inventory.length} installed production packages; Saxon source hash verified.`);

const materials=[];
async function inventoryMaterials(dir,rel=''){for(const f of await fs.readdir(dir,{withFileTypes:true})){const r=rel?rel+'/'+f.name:f.name;if(f.isDirectory())await inventoryMaterials(path.join(dir,f.name),r);else{const b=await fs.readFile(path.join(dir,f.name));materials.push({path:r,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')});}}}
await inventoryMaterials(out);
await fs.writeFile(path.join(out,'MATERIALS-MANIFEST.json'),JSON.stringify({version:'0.1.2',files:materials},null,2));
