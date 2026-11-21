import {describe,it,expect,afterEach} from 'vitest';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {appCommands,commandBinding,commandForInput,validateBindings,changeBinding,recordRecent,cleanRecent,type CommandResult} from '../src/shared/commands';
import {commandState,matchCommand,paletteResults,type CommandContext} from '../src/shared/commandPalette';
import {SettingsStore} from '../src/main/settings';
const context:CommandContext={project:true,manuscript:true,selection:true,singleDocument:true,busy:false,composing:false,workspace:'editor',focus:false,typewriter:false,revisionActive:true,revisionVisible:true,revisionAll:false,split:true,locked:false,undo:true,redo:false,tree:true,inspector:true,pages:false};
const state=(id:string,x:Partial<CommandContext>={})=>commandState(appCommands.find(c=>c.id===id)!,{...context,...x});
describe('canonical commands',()=>{
 it('has unique IDs and explicit metadata for every command',()=>{expect(new Set(appCommands.map(c=>c.id)).size).toBe(appCommands.length);for(const c of appCommands){expect(c.label.length).toBeGreaterThan(3);expect(['any','project','manuscript','selection']).toContain(c.context);expect(['normal','search-only','hidden']).toContain(c.palette);expect(['normal','sensitive','destructive']).toContain(c.safety);}});
 it('uses a current effective configurable palette shortcut',()=>{expect(commandBinding('command-palette')).toBe('Ctrl+Shift+P');const b=changeBinding({},'command-palette','Ctrl+Shift+J');expect(b).toBeTruthy();});
 it('preserves a preexisting palette-default assignment without invalidating settings',()=>{const b={quicknotes:'Ctrl+Shift+P'};expect(validateBindings(b)).toEqual(b);expect(commandBinding('quicknotes',b)).toBe('Ctrl+Shift+P');expect(commandBinding('command-palette',b)).toBe('');expect(commandForInput({key:'P',control:true,shift:true,alt:false,meta:false},b)).toBe('quicknotes');});
 it('permits explicit unbinding and changing the palette binding',()=>{expect(commandBinding('command-palette',changeBinding({},'command-palette',''))).toBe('');expect(commandBinding('command-palette',changeBinding({},'command-palette','Ctrl+Shift+J'))).toBe('Ctrl+Shift+J');});
 it('protects conflicting/reserved keys and ignores composition',()=>{expect(()=>changeBinding({},'command-palette','Ctrl+S')).toThrow();expect(commandForInput({key:'P',control:true,shift:true,alt:false,meta:false,isComposing:true})).toBeUndefined();});
 it.each(['delete-project','permanent-delete','remove-comment','export-epub'])('does not invent or expose unsafe command %s',id=>expect(appCommands.some(c=>c.id===id)).toBe(false));
});
describe('context and matching',()=>{
 it.each([['revision-remove',{selection:false},'Select manuscript'],['statistics',{project:false},'Open a project'],['focus-mode',{manuscript:false},'WRITE'],['revision-mark',{revisionActive:false},'Revision pass'],['comment-add',{singleDocument:false},'one document'],['bold',{busy:true},'operation'],['bold',{composing:true},'composition'],['editor-lock',{split:false},'Split'],['redo',{},'history']])('explains unavailable %s',(id,x,reason)=>expect(state(id as string,x as Partial<CommandContext>).reason).toContain(reason));
 it('lock does not disable valid manuscript editing',()=>expect(state('bold',{locked:true}).available).toBe(true));
 it('dynamic labels reflect current state',()=>{expect(state('focus-mode',{focus:true}).label).toBe('Exit Focus Mode');expect(state('revision-visible',{revisionVisible:false}).label).toBe('Show Revision Marks');expect(state('typewriter-toggle',{typewriter:true}).label).toContain('Disable');});
 it.each([['foc mod','focus-mode'],['rev mark','revision-mark'],['stats','statistics'],['Align Center','align-center']])('finds %s', (q,id)=>expect(paletteResults(q,context,{},[]).some(c=>c.id===id)).toBe(true));
 it('exact/prefix precede word starts and subsequences',()=>{expect(matchCommand('Focus','Focus')).toBe(0);expect(matchCommand('Focus Mode','focus')!).toBeLessThan(matchCommand('Enter Focus Mode','foc mod')!);expect(matchCommand('Enter Focus Mode','foc mod')!).toBeLessThan(matchCommand('Enter Focus Mode','efm')!);});
 it('does not search internal IDs or project text',()=>{expect(paletteResults('opaqueinternalxyz',context,{},[],[{...appCommands[0],id:'opaqueinternalxyz' as any,label:'New Project'}])).toEqual([]);expect(paletteResults('Secret Mina manuscript phrase',context,{},[])).toEqual([]);});
 it('known unavailable results remain searchable but are hidden in empty browsing',()=>{const x={...context,project:false,manuscript:false};expect(paletteResults('Statistics',x,{},[])[0].available).toBe(false);expect(paletteResults('',x,{},[]).some(c=>c.id==='statistics')).toBe(false);});
 it('recency never outranks a better text match; ties are deterministic',()=>{expect(paletteResults('Align Left',context,{},['align-right'])[0].id).toBe('align-left');expect(paletteResults('',context,{},['save'])[0].id).toBe('save');expect(paletteResults('rev',context,{},[])).toEqual(paletteResults('rev',context,{},[]));});
 it('detached context cannot impersonate WRITE ownership',()=>{expect(state('bold',{detached:true}).available).toBe(false);expect(state('search-project',{detached:true}).available).toBe(true);});
});
describe('Recent app preferences',()=>{
 const roots:string[]=[];afterEach(async()=>{for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
 it.each(['canceled','failed','refused'])('never records %s',status=>expect(recordRecent(['save'],'bold',{status,reason:'No'} as CommandResult)).toEqual(['save']));
 it('deduplicates, caps eight and removes unsafe/stale IDs',()=>{expect(cleanRecent(['revision-clear','corkboard-clear','command-palette','missing','save','save'])).toEqual(['save']);let r:any=[];for(const c of appCommands)r=recordRecent(r,c.id,{status:'completed'});expect(r).toHaveLength(8);expect(new Set(r).size).toBe(8);});
 it('survives restart without query/project persistence',async()=>{const root=await mkdtemp(path.join(os.tmpdir(),'palette-'));roots.push(root);const file=path.join(root,'settings.json'),store=new SettingsStore(file);await store.load();await store.update({recentCommands:recordRecent([], 'statistics',{status:'opened'})});const next=new SettingsStore(file);await next.load();expect(next.value.recentCommands).toEqual(['statistics']);expect(await readFile(file,'utf8')).not.toContain('query');});
});


describe('Save retry eligibility',()=>{
 it('permits canonical Save with an error banner, without enabling unrelated commands',()=>{expect(state('save',{saveError:true}).available).toBe(true);expect(state('revision-clear',{saveError:true}).reason).toContain('Retry Save');});
 it('retains real mutation-lane ownership even with an error banner',()=>{expect(state('save',{saveError:true,busy:true}).reason).toBe('Finish the current operation first.');});
 it('retains project and composition requirements during retry',()=>{expect(state('save',{saveError:true,project:false}).available).toBe(false);expect(state('save',{saveError:true,composing:true}).available).toBe(false);});
});
