// SPDX-License-Identifier: MPL-2.0
// Curated local source delivery, never uploads or overwrites prior archives.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {zipSync,unzipSync}=require('fflate');
const asar=require('@electron/asar');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex').toUpperCase();
const candidate='release/candidates/typst-bundled-runtime-path';

const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const output='release/source-delivery/self-contained-'+head.slice(0,12);
if(fs.existsSync(output))throw Error('Preserve existing source delivery');
const acceptedHash='B730A5894ED36985276168E1B7D22E56C06C1C20FF88A721C7EDCAF30108EFB6';
if(sha(fs.readFileSync(candidate+'/PageHearth-Setup-0.1.2.exe'))!==acceptedHash)throw Error('Accepted installer mismatch');
const archive=candidate+'/win-unpacked/resources/app.asar';
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);}
const compiled=walk('dist').concat(walk('dist-main')).map(f=>{
 const b=fs.readFileSync(f);if(sha(b)!==sha(asar.extractFile(archive,path.normalize(f))))throw Error('Compiled mismatch '+f);
 return {path:f,bytes:b.length,sha256:sha(b)};
});
const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const roots=['assets/typst/book.typ','assets/typst/cover.typ','assets/typst/runtime.json','assets/epub/runtime.json','assets/epub/NOTICE.md','package.json','package-lock.json','index.html','tsconfig.json','tsconfig.main.json','vite.config.ts','playwright.config.ts','.gitattributes','.gitignore','LICENSE','LICENSING.md'];
const privateQa=new Set(['scripts/editor-surface-browser.mjs','scripts/cover-prerequisite.mjs','scripts/import-browser.mjs','scripts/manuscript-images-qa.mjs','scripts/publish-studio-production.mjs','scripts/updater-60k-smoke.cjs']);
const docs=['SOURCE-AVAILABILITY.md','THIRD-PARTY-NOTICES.md','BRANDING-POLICY-DRAFT.md','BETA-DISTRIBUTION-STATUS.md','MICROSOFT-RECIPIENT-TERMS-PROPOSAL.md'].map(n=>'docs/licensing/'+n);
const selected=[...new Set(tracked.filter(f=>!privateQa.has(f)&&(roots.includes(f)||/^(src|scripts)\//.test(f)||/^build\/[^/]+\.(nsh|nsi)$/.test(f)||/^assets\/licenses\//.test(f)||(/^(tests|e2e)\//.test(f)&&/\.(ts|js|cjs|mjs|json|txt|md|html|css)$/.test(f)))).concat(docs,['docs/BETA-INSTRUCTIONS-DRAFT.md','scripts/package-internal-beta.cjs','scripts/prepare-internal-beta-source.cjs'],walk('assets/licenses')))];
const entries={},files=[];
for(const f of selected){
 const b=fs.readFileSync(f),s=b.toString('utf8');
 if(!b.equals(execFileSync('git',['show',head+':'+f],{maxBuffer:64*1024*1024}))) {
  const canonical=b.toString('utf8').replaceAll('\r\n','\n');
  if(canonical!==execFileSync('git',['show',head+':'+f],{encoding:'utf8',maxBuffer:64*1024*1024}).replaceAll('\r\n','\n'))throw Error('Uncommitted source: '+f);
 }
 if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{30,}|\bAKIA[A-Z0-9]{16}\b|C:(?:\\|\/)+Users(?:\\|\/)/i.test(s)||(process.env.USERNAME && s.toLowerCase().includes(process.env.USERNAME.toLowerCase())))throw Error('Private-data review required: '+f);
 entries[f]=b;files.push({path:f,bytes:b.length,sha256:sha(b)});
}
const installer=candidate+'/PageHearth-Setup-0.1.2.exe';
const installerHash=sha(fs.readFileSync(installer));
const manifest={version:'0.1.2',baseRevision:head,sourceState:'Committed checkpoint; per-file hashes and compiled-output correspondence',installerSha256:installerHash,compiled,files,excludedTrackedFiles:tracked.filter(f=>!selected.includes(f))};
entries['SOURCE-MANIFEST.json']=Buffer.from(JSON.stringify(manifest,null,2));
entries['SOURCE-PACKAGE-README.md']=Buffer.from(`# PageHearth 0.1.2 matching application source

Copyright © 2026 PixelFF. Original source: MPL-2.0. PixelFF is the owner's personal development brand, not a company. Third-party notices and separately protected branding remain distinct.

Committed revision ${head}; the source files are listed and hashed in SOURCE-MANIFEST.json. Installer SHA-256 ${installerHash}. All ${compiled.length} freshly compiled application files match the candidate app.asar. This is source/output correspondence, not a byte-reproducible installer guarantee.

INTERNAL REVIEW ONLY: external beta HOLD; retained Microsoft redistribution interpretations unresolved. This label is a release hold, not a limitation on MPL or third-party license rights. See docs/licensing/BETA-DISTRIBUTION-STATUS.md.

Build prerequisites: Node 24/npm; npm ci; npm run build. Electron remains 44.11.1. Artwork is deliberately excluded: supply locally authorized artwork or replacements at referenced paths before Vite/installer builds (notably assets/branding/pagehearth/PageHearth_App_Icon.png and assets/branding/kofi/cup.avif). Full installer assembly additionally requires the publishing tools, branding, generated documentation and legal resources declared in package.json. This archive is not a self-contained branded rebuild kit. The WinShell adapter and NSIS source are included; default dist:win does not enable it. The internal packaging harness consumes an accepted prepackaged runtime and refuses overwriting prior candidates.

No Git history, personal data, acceptance reports, private evidence, caches, generated application files, runtime binaries, artwork or guide content are included. Six optional host-specific QA scripts and binary test fixtures are excluded; some tests require their separately documented fixtures. No application src/ file is omitted. Pattern scanning is not a guarantee that every possible secret format is detected.

Deliver this ZIP and its receipt beside the exact installer after approval. Deliver the version-matched PageHearth third-party-materials ZIP from the receipt with equivalent access too; it contains upstream source/build materials, NOT PageHearth application source. Installed legal notices explain each component. No NDA or extra restriction on MPL source rights. No endpoint is provisioned or distribution authorized by this archive.
`);
fs.mkdirSync(output,{recursive:true});
function saveZip(name,data){const b=zipSync(data,{level:6,mtime:new Date('2026-11-19T12:00:00Z')});const f=output+'/'+name;fs.writeFileSync(f,b);const round=unzipSync(b);for(const [n,v]of Object.entries(data))if(!round[n]||sha(round[n])!==sha(v))throw Error('ZIP integrity '+n);return {path:f,bytes:b.length,sha256:sha(b),entries:Object.keys(data).length};}
const source=saveZip('PageHearth-0.1.2-source-'+head.slice(0,12)+'-beta-review.zip',entries);
const legal=candidate+'/win-unpacked/resources/documentation/legal';
const materialManifest=JSON.parse(fs.readFileSync(legal+'/MATERIALS-MANIFEST.json'));
for(const item of materialManifest.files){const bytes=fs.readFileSync(legal+'/'+item.path);if(bytes.length!==item.bytes||sha(bytes)!==item.sha256.toUpperCase())throw Error('Legal resource mismatch '+item.path);}
const upstream={};for(const f of walk(legal))upstream['installed-legal/'+f.slice(legal.length+1)]=fs.readFileSync(f);
for(const f of [...docs,'docs/BETA-INSTRUCTIONS-DRAFT.md'])upstream['current-recipient-docs/'+path.basename(f)]=fs.readFileSync(f);
upstream['README.md']=Buffer.from('This archive preserves all installed third-party sources, license texts and notices under installed-legal/. Paths in those upstream instructions are relative to that folder. Current recipient documents are under current-recipient-docs/. The installed source-availability filename is historical: use the matching application source ZIP and RELEASE-RECEIPT.json supplied beside this archive. External beta remains HOLD. No new licensing clearance is asserted.');
const thirdParty=saveZip('PageHearth-0.1.2-third-party-materials-'+head.slice(0,12)+'.zip',upstream);
fs.copyFileSync('docs/BETA-INSTRUCTIONS-DRAFT.md',output+'/BETA-INSTRUCTIONS.md');
fs.copyFileSync('docs/licensing/SOURCE-AVAILABILITY.md',output+'/SOURCE-AVAILABILITY.md');
const receipt={recipientDocuments:['BETA-INSTRUCTIONS.md','SOURCE-AVAILABILITY.md'].map(name=>{const b=fs.readFileSync(output+'/'+name);return {name,bytes:b.length,sha256:sha(b)};}),status:'INTERNAL REVIEW ONLY; external beta HOLD',baseRevision:head,version:'0.1.2',installer:{path:installer,bytes:fs.statSync(installer).size,sha256:installerHash},source,thirdParty,compiledMatchingFiles:compiled.length};
fs.writeFileSync(output+'/RELEASE-RECEIPT.json',JSON.stringify(receipt,null,2));
console.log(JSON.stringify(receipt,null,2));
