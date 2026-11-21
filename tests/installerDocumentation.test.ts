import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {parse} from 'parse5';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),MarkdownIt=require('markdown-it');
execFileSync(process.execPath,['scripts/build-offline-guide.mjs']);
const root=path.resolve('dist-documentation'),manifest=JSON.parse(fs.readFileSync(root+'/manifest.json','utf8'));
const hash=(p:string)=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
function walk(n:any):any[]{return [n,...(n.childNodes??[]).flatMap(walk)];}
function text(n:any):string{return n.nodeName==='#text'?n.value:(n.childNodes??[]).map(text).join('');}
const attr=(n:any,k:string)=>n.attrs?.find((a:any)=>a.name===k)?.value;
describe('offline installer documentation',()=>{
 it('bundles the exact accepted PDF',()=>expect(hash(root+'/PageHearth_Quick_Start_Guide.pdf')).toBe('D78F4AEF202C7250F09C9E57BD7EC195F61E6ABE7E8C56A75DD590E135A9EEB0'));
 it('preserves every accepted chapter body and image',()=>{
  expect(manifest.chapters).toHaveLength(17);
  for(const c of manifest.chapters){expect(hash('docs/user-guide/'+c.source)).toBe(c.sha256);const expected=parse(new MarkdownIt({html:false}).render(fs.readFileSync('docs/user-guide/'+c.source,'utf8')));const actual=walk(parse(fs.readFileSync(path.join(root,c.output),'utf8'))).find(n=>n.tagName==='main');actual.childNodes=actual.childNodes.filter((n:any)=>n.tagName!=='footer');expect(text(actual).trim()).toBe(text(expected).trim());}
  expect(manifest.assets.length).toBeGreaterThan(30);for(const a of manifest.assets)expect(hash(root+'/user-guide/'+a.file)).toBe(a.sha256);
 });
 it('has no network dependencies and all local links and images resolve',()=>{
  const files=['user-guide/index.html',...manifest.chapters.map((c:any)=>c.output)];
  for(const file of files)for(const n of walk(parse(fs.readFileSync(path.join(root,file),'utf8'))))for(const key of ['href','src']){const v=attr(n,key);if(!v)continue;expect(v).not.toMatch(/^(https?:|\/\/|data:)/);const [target,fragment]=v.split('#');const destination=path.resolve(root,path.dirname(file),target||'');expect(destination.startsWith(root+path.sep)).toBe(true);if(target)expect(fs.existsSync(destination),`${file}: ${v}`).toBe(true);if(fragment)expect(walk(parse(fs.readFileSync(target?destination:path.join(root,file),'utf8'))).some(e=>attr(e,'id')===fragment)).toBe(true);}
 });
});
describe('installer integration contracts',()=>{
 const nsis=fs.readFileSync('build/pagehearth-experience.nsh','utf8'),pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
 it('keeps guide opening opt-in and independent of app launch',()=>{
  expect(nsis).toContain('MUI_FINISHPAGE_SHOWREADME_NOTCHECKED');expect(nsis).toContain('MUI_FINISHPAGE_RUN_FUNCTION PageHearthStartApp');expect(nsis).toContain('MUI_FINISHPAGE_SHOWREADME_FUNCTION PageHearthOpenGuide');expect(nsis).toMatch(/Function PageHearthOpenGuide\s+IfSilent done/);expect(nsis).toContain('${StdUtils.ExecShellAsUser} $0 "$INSTDIR\\resources\\documentation\\PageHearth_Quick_Start_Guide.pdf"');expect(nsis).not.toMatch(/^\s*ExecShell /m);expect(nsis).toContain('PageHearth was installed successfully.');
 });
 it('uses installed paths and narrowly removes only documentation shortcuts',()=>{
  expect(pkg.build.nsis.menuCategory).toBe('PageHearth');expect(pkg.build.extraResources).toContainEqual({from:'dist-documentation',to:'documentation'});expect(pkg.version).toBe('0.1.2');expect(nsis).not.toMatch(/C:\\|RMDir \/r|APPDATA/);expect(nsis.match(/^  Delete /gm)).toHaveLength(2);
 });
 it.each(['sidebar','header'])('has a valid high-resolution %s bitmap',name=>{const b=fs.readFileSync(`build/branding/${name}.bmp`);expect(b.toString('ascii',0,2)).toBe('BM');expect(b.readUInt32LE(2)).toBe(b.length);expect(b.readUInt16LE(28)).toBe(24);expect(b.readInt32LE(18)).toBe(name==='sidebar'?328:300);expect(b.readInt32LE(22)).toBe(name==='sidebar'?628:114);});
});
