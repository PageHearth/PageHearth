import {it,expect,afterEach,vi} from 'vitest';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {zipSync,strToU8} from 'fflate';
import {createHash} from 'node:crypto';
import {Store} from '../src/main/storage';
import {projectRoot,discoverManifest,MANIFEST,isShellProjectFile} from '../src/main/projectPaths';
import {projectBrowseDirectory} from '../src/main/settings';
const roots:string[]=[];const stores:Store[]=[];
it('does not claim arbitrary .storyloom files as shell launch requests',()=>{expect(isShellProjectFile('other.storyloom')).toBe(false);expect(isShellProjectFile('storyloom.project.json')).toBe(true);expect(isShellProjectFile('project.pagehearth')).toBe(true);});
it('opens frozen current version-1 metadata and Trash without rewriting canonical files',async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'pagehearth-current-fixture-'));roots.push(root);await fs.cp('tests/fixtures/pagehearth-v1',root,{recursive:true});await fs.mkdir(path.join(root,'.storyloom'));await fs.mkdir(path.join(root,'backups'));const before=await fs.readFile(path.join(root,MANIFEST));const s=store(root);await s.open();expect(s.project.manifest.nodes[1].trashed).toBe(true);expect(s.project.manifest.settings.workspace.treeWidth).toBe(300);expect(await fs.readFile(path.join(root,MANIFEST))).toEqual(before);await s.rebuildIndex();await s.release();});
it('hard-link-unavailable migration fails safely with a useful local-copy instruction',async()=>{const root=await fixture();const before=await fs.readFile(path.join(root,'storyloom.project.json'));vi.spyOn(fs,'link').mockRejectedValueOnce(Object.assign(Error('Unsupported'),{code:'ENOTSUP'}));await expect(store(root).open()).rejects.toThrow('local NTFS');expect(await fs.readFile(path.join(root,'storyloom.project.json'))).toEqual(before);await expect(fs.stat(path.join(root,MANIFEST))).rejects.toThrow();});
async function fixture(name='storyloom.project.json'){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'pagehearth-migration-'));roots.push(root);
  await fs.cp('tests/fixtures/legacy-storyloom',root,{recursive:true});
  for(const dir of ['.storyloom','backups','assets'])await fs.mkdir(path.join(root,dir));
  await fs.writeFile(path.join(root,'assets','map.txt'),'Original asset');
  if(name!=='storyloom.project.json')await fs.rename(path.join(root,'storyloom.project.json'),path.join(root,name));
  return root;
}
function store(root:string){const s=new Store(root);stores.push(s);return s;}
afterEach(async()=>{vi.restoreAllMocks();for(const s of stores.splice(0))await s.release().catch(()=>{});for(const r of roots.splice(0))await fs.rm(r,{recursive:true,force:true});});
it.each(['storyloom.project.json','Novel.storyloom'])('migrates %s byte-for-byte without changing IDs/prose/order/metadata/assets',async name=>{
  const root=await fixture(name);const original=await fs.readFile(path.join(root,name));
  const names=await fs.readdir(path.join(root,'manuscript'));const before=await Promise.all(names.map(n=>fs.readFile(path.join(root,'manuscript',n))));
  const s=store(root);await s.open();expect(await fs.readFile(path.join(root,MANIFEST))).toEqual(original);
  expect(await Promise.all(names.map(n=>fs.readFile(path.join(root,'manuscript',n))))).toEqual(before);
  const archived=await fs.readdir(path.join(root,'.storyloom','legacy-manifests'));expect(archived).toHaveLength(1);expect(await fs.readFile(path.join(root,'.storyloom','legacy-manifests',archived[0]))).toEqual(original);
  expect(await fs.readFile(path.join(root,'assets','map.txt'),'utf8')).toBe('Original asset');
  expect(await projectRoot(path.join(root,MANIFEST))).toBe(root);await s.rebuildIndex();await s.close();
  const reopened=store(root);await reopened.open();expect(reopened.project.manifest).toEqual(JSON.parse(original.toString()));expect(reopened.backupDirty).toBe(false);
});
it('preserves sole legacy manifest when publication fails and retries safely',async()=>{
  const root=await fixture();const old=await fs.readFile(path.join(root,'storyloom.project.json'));
  const spy=vi.spyOn(fs,'link').mockRejectedValueOnce(Error('Disk full'));await expect(store(root).open()).rejects.toThrow('Disk full');spy.mockRestore();
  expect(await fs.readFile(path.join(root,'storyloom.project.json'))).toEqual(old);await expect(fs.stat(path.join(root,MANIFEST))).rejects.toThrow();await store(root).open();
});
it('finishes interrupted legacy archival after a verified current manifest exists',async()=>{
  const root=await fixture();const rename=fs.rename.bind(fs);const spy=vi.spyOn(fs,'rename').mockImplementation(async(a,b)=>{if(String(b).includes('legacy-manifests'))throw Error('Archive unavailable');return rename(a,b);});
  await expect(store(root).open()).rejects.toThrow('Archive unavailable');spy.mockRestore();expect(await fs.readFile(path.join(root,MANIFEST))).toEqual(await fs.readFile(path.join(root,'storyloom.project.json')));await store(root).open();await expect(fs.stat(path.join(root,'storyloom.project.json'))).rejects.toThrow();
});
it('does not fall back from damaged current data or migrate unsupported versions',async()=>{
  const root=await fixture();await fs.writeFile(path.join(root,MANIFEST),'broken');await expect(store(root).open()).rejects.toThrow();expect(await fs.readFile(path.join(root,'storyloom.project.json'),'utf8')).toContain('Legacy');
  await fs.unlink(path.join(root,MANIFEST));const p=JSON.parse(await fs.readFile(path.join(root,'storyloom.project.json'),'utf8'));p.version=99;await fs.writeFile(path.join(root,'storyloom.project.json'),JSON.stringify(p));await expect(store(root).open()).rejects.toThrow('Unsupported');await expect(fs.stat(path.join(root,MANIFEST))).rejects.toThrow();
});
it('shares legacy locks and rejects ambiguous manifests',async()=>{
  const root=await fixture();await fs.writeFile(path.join(root,'.storyloom','lock.json'),JSON.stringify({pid:process.pid,token:'legacy-owner'}));await expect(store(root).open()).rejects.toThrow('already open');await fs.unlink(path.join(root,'.storyloom','lock.json'));await fs.copyFile(path.join(root,'storyloom.project.json'),path.join(root,'other.storyloom'));await expect(discoverManifest(root)).rejects.toThrow('Multiple legacy');
});
it('never archives a conflicting or newer legacy manifest beside a current one',async()=>{
  const root=await fixture();const original=await fs.readFile(path.join(root,'storyloom.project.json'));const older=JSON.parse(original.toString());older.revision--;await fs.writeFile(path.join(root,MANIFEST),JSON.stringify(older));await expect(store(root).open()).rejects.toThrow('conflicts');expect(await fs.readFile(path.join(root,'storyloom.project.json'))).toEqual(original);
});
it('retention orders mixed-brand archives by timestamp rather than brand prefix',async()=>{
  const root=await fixture();const s=store(root);await s.open();const archive=await s.backup();const bytes=await fs.readFile(archive);
  for(let i=0;i<20;i++)await fs.writeFile(path.join(root,'backups',`StoryLoom-2000-01-${String(i+1).padStart(2,'0')}T00-00-00-000Z-old.zip`),bytes);
  const latest=await s.backup();expect(await fs.stat(latest)).toBeTruthy();expect(await fs.readdir(path.join(root,'backups'))).toHaveLength(20);
});
it('preserves ambiguous legacy journal metadata rather than choosing an authority',async()=>{
  const root=await fixture();const manifest=JSON.parse(await fs.readFile(path.join(root,'storyloom.project.json'),'utf8'));const documents:Record<string,unknown>={};for(const n of manifest.nodes)documents[n.id]=JSON.parse(await fs.readFile(path.join(root,'manuscript',n.id+'.json'),'utf8'));manifest.revision++;manifest.title='Recovered title';await fs.writeFile(path.join(root,'.storyloom','journal.json'),JSON.stringify({base:7,project:{manifest,documents,recovery:[]}}));const s=store(root);await expect(s.open()).rejects.toThrow('metadata');expect(JSON.parse(await fs.readFile(path.join(root,'storyloom.project.json'),'utf8')).revision).toBe(7);expect(await fs.readFile(path.join(root,'.storyloom','journal.json'),'utf8')).toContain('Recovered title');
});
it('verifies historical StoryLoom backup manifests',async()=>{
  const root=await fixture();const files:Record<string,Uint8Array>={'storyloom.project.json':await fs.readFile(path.join(root,'storyloom.project.json'))};
  for(const name of await fs.readdir(path.join(root,'manuscript')))files['manuscript/'+name]=await fs.readFile(path.join(root,'manuscript',name));
  const inventory=Object.fromEntries(Object.entries(files).map(([name,bytes])=>[name,createHash('sha256').update(bytes).digest('hex')]));
  files['backup-integrity.json']=strToU8(JSON.stringify(inventory));const file=path.join(root,'backups','StoryLoom-legacy.zip');await fs.writeFile(file,zipSync(files));expect(await Store.verifyBackup(file)).toBe(true);
});
it('uses home PageHearth Projects by default and preserves available existing locations',async()=>{
  const root=await fixture();const initial=await projectBrowseDirectory(undefined,root,root);expect(initial).toBe(path.join(root,'PageHearth','Projects'));expect(await projectBrowseDirectory(root,root,root)).toBe(root);expect(await projectBrowseDirectory(path.join(root,'missing'),root,root)).toBe(initial);
});
it('opens and verifies backups for a case-varied current manifest filename',async()=>{
  const root=await fixture('Novel.PAGEHEARTH');const s=store(root);await s.open();
  expect(await projectRoot(path.join(root,'Novel.PAGEHEARTH'))).toBe(root);
  expect(await Store.verifyBackup(await s.backup())).toBe(true);
});
