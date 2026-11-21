import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';import {extractFile} from '@electron/asar';
const archive='release/candidates/visual-global-polish-preset-refinement/win-unpacked/resources/app.asar',hash=b=>createHash('sha256').update(b).digest('hex');let compiledFilesMatch=0;
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else{assert(fs.readFileSync(file).equals(extractFile(archive,file)),file);compiledFilesMatch++;}}}walk('dist');walk('dist-main');
const old=JSON.parse(fs.readFileSync('.acceptance/reference-closure/sanity.json'));let preservedPriorArtifactsAndGuides=0;
for(const item of [...old.artifacts,...old.priorArtifacts,...old.guides]){const file=item.file||item.path;assert.equal(hash(fs.readFileSync(file)),item.sha256.toLowerCase(),file);preservedPriorArtifactsAndGuides++;}
const artifacts=['release/candidates/visual-global-polish-preset-refinement/PageHearth-Setup-0.1.2.exe','release/candidates/visual-global-polish-preset-refinement/win-unpacked/PageHearth.exe'].map(file=>{const b=fs.readFileSync(file);return {file,bytes:b.length,sha256:hash(b)};});
const accepted=fs.readFileSync('release/candidates/visual-publish/PageHearth-Setup-0.1.2.exe');assert.equal(hash(accepted),'53ac682a457d8b428a73482e6546ef9cab12f44443a3d9c6dce0fdd66ad8f689');
for(const [file,expected] of [
 ['release/candidates/visual-global-polish/PageHearth-Setup-0.1.2.exe','b7f87ac26e53e9d806bee50147fdab69ffba47ff01de787e551318c14a6afe41'],
 ['release/candidates/visual-global-polish/win-unpacked/PageHearth.exe','ce9dded153d5265f2b78902f575f4bad3b8b352a4bc6f1c39a0f11712e27652d'],
 ['.acceptance/visual-global-polish/superseded-first-candidate/PageHearth-Setup-0.1.2.exe','05198887f1f609c4dbbb8238ceaa1370d821c7d48c4caa9ecac0b3cb1e6ed7c2'],
 ])assert.equal(hash(fs.readFileSync(file)),expected,file);
const result={compiledFilesMatch,preservedPriorArtifactsAndGuides,artifacts};fs.writeFileSync('.acceptance/visual-global-polish-preset-refinement/packaged-integrity.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
