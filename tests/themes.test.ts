import {describe,it,expect} from 'vitest';
import {promises as fs} from 'node:fs';
import os from 'node:os';import path from 'node:path';
import {builtinThemes,defaultThemes,readTheme,loadThemes,resolveTheme,importTheme,exportTheme,contrastWarnings,themeTokenNames,themeStyle} from '../src/shared/themes';
import {SettingsStore} from '../src/main/settings';
import {ThemeSettings} from '../src/main/themeSettings';
import {DetachedTheme} from '../src/main/detachedTheme';
const theme=()=>structuredClone(builtinThemes[0]);
it('registers immutable, complete Parchment without changing System or permitting built-in shadowing',()=>{
 const p=builtinThemes.find(t=>t.id==='Parchment')!;
 expect(builtinThemes.map(t=>t.id)).toEqual(['Light','Dark','Parchment']);
 expect(Object.isFrozen(p)).toBe(true);expect(Object.keys(p.tokens).sort()).toEqual([...themeTokenNames].sort());
 expect(loadThemes({selected:'Parchment',custom:[]}).preferences.selected).toBe('Parchment');
 expect(loadThemes({selected:'Parchment',custom:[p]}).preferences).toEqual(defaultThemes());
 expect(resolveTheme({selected:'Parchment',custom:[]},true)).toBe(p);
 expect(resolveTheme(defaultThemes(),true).id).toBe('Dark');expect(resolveTheme(defaultThemes(),false).id).toBe('Light');
 const incomplete={...p,id:'custom-paper',tokens:{editorBackground:'#f2e7cf',accent:'bad'}};
 expect(()=>readTheme(incomplete)).toThrow('Invalid color');
 expect(readTheme(incomplete,false).tokens).toEqual({...builtinThemes[0].tokens,editorBackground:'#f2e7cf'});
});
it('persists Parchment, broadcasts selection, protects canonical palette and edits only its duplicate',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pagehearth-parchment-'));
 try{const s=new SettingsStore(path.join(root,'settings.json')),events:string[]=[];
 const service=new ThemeSettings(s,{read:async()=>null,write:async()=>{},confirmDelete:async()=>true},()=>events.push(service.value.selected));
 await service.request({action:'select',id:'Parchment'});const reopened=new SettingsStore(s.file);await reopened.load();expect(reopened.value.themes?.selected).toBe('Parchment');
 const p=builtinThemes.find(t=>t.id==='Parchment')!,before=JSON.stringify(p);
 await expect(service.request({action:'delete',id:p.id})).rejects.toThrow('Built-in');await expect(service.request({action:'export',id:p.id})).rejects.toThrow('custom');await expect(service.request({action:'save',theme:p,expected:p})).rejects.toThrow('Built-in');
 await service.request({action:'duplicate',id:p.id});const copy=structuredClone(service.value.custom[0]);expect(copy.tokens).toEqual(p.tokens);
 await service.request({action:'save',expected:copy,theme:{...copy,tokens:{...copy.tokens,editorBackground:'#f4ead2'}}});
 expect(service.value.custom[0].tokens.editorBackground).toBe('#f4ead2');expect(JSON.stringify(p)).toBe(before);expect(events[0]).toBe('Parchment');
 await reopened.load();expect(reopened.value.themes).toEqual(service.value);expect(await fs.readdir(root)).toEqual(['settings.json']);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
describe('Theme v1 model and security',()=>{
 it.each(builtinThemes)('$name meets semantic contrast guardrails',t=>{expect(contrastWarnings(t)).toEqual([]);expect(Object.keys(themeStyle(t))).toHaveLength(themeTokenNames.length+9);expect(Object.isFrozen(t.tokens)).toBe(true);});
 it('preserves System default and optional detached override',()=>{const p=defaultThemes();expect(resolveTheme(p,true).id).toBe('Dark');expect(resolveTheme(p,false).id).toBe('Light');expect(resolveTheme(p,true,'Light').id).toBe('Light');const transport=new DetachedTheme();transport.setOverride('notebook','Light');transport.set('Dark',[]);expect(transport.resolve('notebook')).toBe('Light');expect(transport.override('notebook')).toBe('Light');});
 it('fills missing future tokens from appearance defaults',()=>{const t=theme();expect(readTheme({...t,tokens:{accent:'#123456'}}).tokens).toEqual({...t.tokens,accent:'#123456'});});
 it.each(['red','url(https://evil)','expression(alert(1))','#fff','</style><script>','#00000000'])('rejects invalid opaque token %s',value=>{const t=theme();expect(()=>readTheme({...t,tokens:{...t.tokens,accent:value}})).toThrow('Invalid color');});
 it('allows alpha only for backdrop/shadow/focus wash',()=>{const t=theme();t.tokens.modalBackdrop='#12345688';expect(readTheme(t).tokens.modalBackdrop).toBe('#12345688');});
 it('rejects unsupported versions and executable/unknown fields',()=>{expect(()=>readTheme({...theme(),version:2})).toThrow('version');expect(()=>readTheme({...theme(),css:'body{}'})).toThrow('Unknown');expect(()=>readTheme({...theme(),tokens:{...theme().tokens,__proto__:null,evil:'url(file://a)'}})).toThrow('Unknown');expect(()=>readTheme(JSON.parse('{"version":1,"__proto__":{}}'))).toThrow('Unknown');});
 it('imports as new stable identity with nonoverwriting names',()=>{const t=theme(),p=defaultThemes();const one=importTheme(exportTheme(t),p,'custom-one');expect(one.id).toBe('custom-one');expect(one.name).toBe('PageHearth Light (2)');const two=importTheme(exportTheme(one),{selected:one.id,custom:[one]},'custom-two');expect(two.name).toBe('PageHearth Light (2) (2)');expect(JSON.parse(exportTheme(one))).toEqual(one);expect(()=>importTheme('x'.repeat(65537),p,'id')).toThrow('large');});
 it('recovers corrupt settings separately from project recovery',()=>{expect(loadThemes({custom:[{version:9}]}).preferences).toEqual(defaultThemes());const t={...theme(),id:'custom-a'};t.tokens.accent='bad';const loaded=loadThemes({selected:t.id,custom:[t]});expect(loaded.preferences.custom[0].tokens.accent).toBe(builtinThemes[0].tokens.accent);expect(loaded.warning).toBeTruthy();});
 it('warns without rewriting valid low-contrast choices',()=>{const t=theme();t.tokens.textPrimary=t.tokens.surface;expect(contrastWarnings(t).length).toBeGreaterThan(0);expect(readTheme(t).tokens.textPrimary).toBe(t.tokens.surface);});
});
describe('Global theme lifecycle through existing durable settings',()=>{
 it('duplicates, renames, resets, exports, deletes, imports and reopens with no project storage',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pagehearth-themes-')),file=path.join(root,'settings.json');try{let exported='',events=0,confirm=true;const s=new SettingsStore(file);await s.load();const manager=new ThemeSettings(s,{read:async()=>exported,write:async(_,text)=>{exported=text;},confirmDelete:async()=>confirm},()=>events++);
 await manager.request({action:'migrate',id:'Dark'});await manager.request({action:'migrate',id:'Light'});expect(manager.value.selected).toBe('Dark');await manager.request({action:'duplicate',id:'Dark'});const original=structuredClone(manager.value.custom[0]),t={...original,name:'My theme',tokens:{...original.tokens,accent:'#aabbcc'}};await manager.request({action:'save',theme:t,expected:original});expect(manager.value.custom[0].id).toBe(original.id);await expect(manager.request({action:'save',theme:t,expected:original})).rejects.toThrow('changed');await manager.request({action:'export',id:t.id});expect(JSON.parse(exported)).toEqual(t);
 const reopen=new SettingsStore(file);await reopen.load();expect(reopen.value.themes).toEqual(manager.value);confirm=false;await manager.request({action:'delete',id:t.id});expect(manager.value.custom).toHaveLength(1);confirm=true;await manager.request({action:'delete',id:t.id});expect(manager.value).toEqual(defaultThemes());await manager.request({action:'import'});expect(manager.value.custom[0].id).not.toBe(t.id);expect(manager.value.custom[0].tokens).toEqual(t.tokens);await expect(manager.request({action:'delete',id:'Dark'})).rejects.toThrow('Built-in');expect(events).toBeGreaterThan(4);expect((await fs.readdir(root)).sort()).toEqual(['settings.json']);}finally{await fs.rm(root,{recursive:true,force:true});}
 });
 it('preserves unrelated settings and serializes concurrent writes',async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'pagehearth-theme-queue-'));try{const s=new SettingsStore(path.join(root,'settings.json'));await s.update({zoomPercent:125});const service=new ThemeSettings(s,{read:async()=>null,write:async()=>{},confirmDelete:async()=>true},()=>{});await Promise.all([service.request({action:'select',id:'Dark'}),s.recentFont('Georgia'),service.request({action:'duplicate',id:'Light'})]);const reopened=new SettingsStore(s.file);await reopened.load();expect(reopened.value.zoomPercent).toBe(125);expect(reopened.value.recentFonts).toEqual(['Georgia']);expect(reopened.value.themes?.custom).toHaveLength(1);}finally{await fs.rm(root,{recursive:true,force:true});}});
 it('preserves unreadable appearance evidence and starts with usable defaults',async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'pagehearth-theme-fallback-'));try{const f=path.join(root,'settings.json');await fs.writeFile(f,JSON.stringify({version:1,zoomPercent:130,themes:{selected:'bad',custom:[{version:2}]}}));const s=new SettingsStore(f);await s.load();expect(s.value.zoomPercent).toBe(130);expect(s.value.themes).toEqual(defaultThemes());expect(s.warning).toContain('Appearance');expect((await fs.readdir(root)).some(f=>f.includes('appearance-unreadable'))).toBe(true);}finally{await fs.rm(root,{recursive:true,force:true});}});
 it('rejects malicious imports without writing settings',async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'pagehearth-theme-import-'));try{const s=new SettingsStore(path.join(root,'settings.json'));await s.update({zoomPercent:150});const before=await fs.readFile(s.file,'utf8');const service=new ThemeSettings(s,{read:async()=>JSON.stringify({...theme(),css:'@import url(file://secret)'}),write:async()=>{},confirmDelete:async()=>true},()=>{throw Error('must not notify');});await expect(service.request({action:'import'})).rejects.toThrow('Unknown');expect(await fs.readFile(s.file,'utf8')).toBe(before);}finally{await fs.rm(root,{recursive:true,force:true});}});
});
it('maps every semantic role into an application CSS consumer and keeps project color ownership',async()=>{
 const files=(await fs.readdir('src/renderer')).filter(f=>f.endsWith('.css'));const css=(await Promise.all(files.map(f=>fs.readFile('src/renderer/'+f,'utf8')))).join('\n');for(const variable of Object.keys(themeStyle(theme())))expect(css).toContain('var('+variable);
 expect(css).toContain('--revision-1,var(--revision-cyan)');expect(css).toContain('--custom-card-base');
});
it('bounds duplicate names before storage so maximum-length custom names remain restart-safe',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pagehearth-theme-name-'));try{const s=new SettingsStore(path.join(root,'settings.json')),manager=new ThemeSettings(s,{read:async()=>null,write:async()=>{},confirmDelete:async()=>true},()=>{});await manager.request({action:'duplicate',id:'Light'});const original=structuredClone(manager.value.custom[0]);await manager.request({action:'save',theme:{...original,name:'a'.repeat(80)},expected:original});await manager.request({action:'duplicate',id:original.id});expect(manager.value.custom[1].name.length).toBeLessThanOrEqual(80);const reloaded=new SettingsStore(s.file);await reloaded.load();expect(reloaded.value.themes).toEqual(manager.value);expect(reloaded.warning).toBeUndefined();}finally{await fs.rm(root,{recursive:true,force:true});}
});
