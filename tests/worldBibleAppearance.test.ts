import {it,expect} from 'vitest';
import {promises as fs} from 'node:fs';import os from 'node:os';import path from 'node:path';
import {Store} from '../src/main/storage';
import {createEntity,createCustomCategory,updateCustomCategory,deleteCustomCategory} from '../src/shared/worldBible';
import {appearanceReferences,resolveWorldBibleTheme,setWorldBibleTheme} from '../src/shared/worldBibleAppearance';
import {builtinThemes,type ThemePreferences} from '../src/shared/themes';
import {reconcileProject} from '../src/shared/reconcile';
const prefs:ThemePreferences={selected:'Dark',custom:[]};
it('inherits application then World Bible then category and handles malformed/missing references',()=>{
 expect(resolveWorldBibleTheme(undefined,'character',prefs).id).toBe('Dark');
 const a={defaultTheme:'Parchment',categories:{bestiary:'Dark'}};
 expect(resolveWorldBibleTheme(a,'character',prefs).id).toBe('Parchment');expect(resolveWorldBibleTheme(a,'bestiary',prefs).id).toBe('Dark');
 expect(resolveWorldBibleTheme({...a,categories:{character:'missing'}},'character',prefs).id).toBe('Parchment');
 for(const invalid of [null,[],42,{defaultTheme:'bad id',categories:[]},{defaultTheme:'missing',categories:{character:123}}])expect(resolveWorldBibleTheme(invalid,'character',prefs).id).toBe('Dark');
 expect(appearanceReferences(JSON.parse('{"categories":{"__proto__":"Light"}}')).categories).toEqual({});
 expect(resolveWorldBibleTheme(undefined,undefined,{selected:'System',custom:[]},false).id).toBe('Light');
});
it('uses global custom definitions live and falls back separately at each missing reference',()=>{
 const t={...structuredClone(builtinThemes[2]),id:'custom-paper',name:'Paper'},p={...prefs,custom:[t]},a={defaultTheme:t.id,categories:{character:t.id}};
 expect(resolveWorldBibleTheme(a,'character',p)).toBe(t);expect(resolveWorldBibleTheme(a,'character',prefs).id).toBe('Dark');
 expect(resolveWorldBibleTheme({...a,defaultTheme:'Parchment'},'character',prefs).id).toBe('Parchment');
});
it('persists project-only references, isolates projects, preserves content/activity and cleans deleted category identity',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pagehearth-world-theme-'));let store=new Store(root);
 try{await store.create('World appearance');let p=createEntity(store.project,'character','Mina').project;const made=createCustomCategory(p,'Artifacts','Artifact');p=made.project;await store.commit(p);
 const before=structuredClone(store.project),writing=await store.writing.snapshot();
 let next=setWorldBibleTheme(before,undefined,'Parchment',prefs);next=setWorldBibleTheme(next,made.id,'Light',prefs);
 expect(next.documents).toEqual(before.documents);expect(next.manifest).toEqual(before.manifest);const without=structuredClone(next.author);delete without.worldBible!.appearance;expect(without).toEqual(before.author);
 expect(before.author.worldBible!.appearance).toBeUndefined();expect(resolveWorldBibleTheme(before.author.worldBible!.appearance,made.id,prefs).id).toBe('Dark');
 await store.commit(next);expect(await store.writing.snapshot()).toEqual(writing);await store.release();store=new Store(root);await store.open();
 expect(store.project.author.worldBible!.appearance).toEqual({defaultTheme:'Parchment',categories:{[made.id]:'Light'}});
 const renamed=updateCustomCategory(store.project,made.id,{name:'Relics'});expect(resolveWorldBibleTheme(renamed.author.worldBible!.appearance,made.id,prefs).id).toBe('Light');
 const removed=deleteCustomCategory(renamed,made.id);expect(removed.author.worldBible!.appearance?.categories?.[made.id]).toBeUndefined();
 const other=createCustomCategory(removed,'Artifacts','Artifact');expect(other.id).not.toBe(made.id);expect(resolveWorldBibleTheme(other.project.author.worldBible!.appearance,other.id,prefs).id).toBe('Parchment');
 const local=setWorldBibleTheme(before,'character','Light',prefs),canonical=setWorldBibleTheme(before,'character','Parchment',prefs);expect(reconcileProject(before,local,canonical).conflicts).toContain('author.worldBible.appearance.categories.character');
 expect(reconcileProject(before,local,setWorldBibleTheme(before,'bestiary','Parchment',prefs)).conflicts).toEqual([]);
 }finally{await store.release();await fs.rm(root,{recursive:true,force:true});}
});
