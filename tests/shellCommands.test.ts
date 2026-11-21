import {afterEach,describe,expect,it} from 'vitest';
import {promises as fs,readFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {changeBinding,commandBinding,commandForInput,validateBindings} from '../src/shared/commands';
import {SettingsStore} from '../src/main/settings';
import {KeyboardShortcuts,ShellNavigation,StatusZoom,zoomPresets} from '../src/renderer/AppShell';
const roots:string[]=[];
afterEach(async()=>{for(const root of roots.splice(0))await fs.rm(root,{recursive:true,force:true});});
describe('shared application bindings',()=>{
  it.each(['Ctrl+E','Ctrl+Shift+B','Ctrl+Shift+7','Ctrl+Shift+8','Ctrl+Shift+9'])('does not let an app binding intercept the installed editor keymap %s',binding=>{
    expect(()=>changeBinding({},'quicknotes',binding)).toThrow('reserved');
    expect(()=>changeBinding({},'notebook',binding)).toThrow('reserved');
    expect(()=>changeBinding({},'command-palette',binding)).toThrow('reserved');
  });
  it('dispatches the default and changed QuickNotes binding from the same registry',()=>{
    const input={key:'m',control:true,shift:true,alt:false,meta:false,type:'keyDown'};
    expect(commandBinding('quicknotes')).toBe('Ctrl+Shift+M');expect(commandForInput(input)).toBe('quicknotes');
    const changed=changeBinding({},'quicknotes','Alt+Q');expect(commandForInput(input,changed)).toBeUndefined();expect(commandForInput({...input,key:'q',control:false,shift:false,alt:true},changed)).toBe('quicknotes');
    expect(commandBinding('quicknotes',changeBinding(changed,'quicknotes',null))).toBe('Ctrl+Shift+M');
  });
  it('refuses collisions, reserved editor shortcuts, modifier-only and AltGr combinations',()=>{
    const current=changeBinding({},'notebook','Alt+Q');expect(()=>changeBinding(current,'quicknotes','Alt+Q')).toThrow('Notebook');
    for(const value of ['', 'M','Ctrl','Ctrl+Ctrl+M','Ctrl+Z','Ctrl+S','Ctrl+Alt+Q'])expect(()=>changeBinding({},'quicknotes',value)).toThrow();
    expect(()=>changeBinding({},'save','Alt+Q')).toThrow('fixed');expect(()=>validateBindings({unknown:'Alt+Q'})).toThrow();
    expect(commandForInput({key:'m',control:true,shift:true,alt:false,meta:false,isComposing:true})).toBeUndefined();
  });
  it('persists changed shortcuts without project writes and preserves damaged preferences',async()=>{
    const root=await fs.mkdtemp(path.join(os.tmpdir(),'pagehearth-shell-'));roots.push(root);const file=path.join(root,'settings.json'),store=new SettingsStore(file);await store.load();await store.update({keybindings:changeBinding({},'quicknotes','Alt+Q')});const reopen=new SettingsStore(file);await reopen.load();expect(commandBinding('quicknotes',reopen.value.keybindings)).toBe('Alt+Q');expect(await fs.readdir(root)).toEqual(['settings.json']);
    await fs.writeFile(file,JSON.stringify({...reopen.value,keybindings:{quicknotes:'Ctrl+Z'}}));const damaged=new SettingsStore(file);await damaged.load();expect(damaged.warning).toContain('preserved');expect(commandBinding('quicknotes',damaged.value.keybindings)).toBe('Ctrl+Shift+M');expect((await fs.readdir(root)).some(f=>f.includes('.unreadable-'))).toBe(true);
  });
});
describe('compact shared shell',()=>{
  it('renders every workspace and mode with an accessible overflow alternative',()=>{
    const html=renderToStaticMarkup(React.createElement(ShellNavigation,{mode:'WRITE',workspace:'collections',hasProject:true,busy:false,onHome:()=>{},onMode:()=>{},onWorkspace:()=>{}}));
    expect(html).toContain('aria-label="PageHearth Home"');expect(html).toContain('title="Home"');expect(html).toContain('aria-label="Workspace"');
    for(const name of ['Editor','Corkboard','Outliner','Notebook','World Bible','Research','Collections','WRITE','PUBLISH'])expect(html).toContain(name);
    expect(html).toContain('Timeline');expect(html).not.toContain('QuickNotes');expect(html).toContain('aria-label="Theme"');
  });
  it('honestly displays non-preset zoom and includes every quick preset',()=>{
    const html=renderToStaticMarkup(React.createElement(StatusZoom,{zoom:115,onChange:()=>{}}));
    expect(html).toContain('value="115" selected=""');for(const value of zoomPresets)expect(html).toContain(`value="${value}"`);expect(html).not.toContain('<button');
  });
  it('uses single-row shell/status layout and reserved Inspector gutter without generic header leakage',()=>{
    const css=readFileSync('src/renderer/shell.css','utf8'),main=readFileSync('src/renderer/main.tsx','utf8');
    expect(css).toContain('grid-template-columns:auto minmax(0,1fr) auto');expect(css).toContain('@container(max-width:710px)');expect(css).toContain('scrollbar-gutter:stable');
    expect(main).toContain('onHome={()=>void home()}');expect(main).not.toContain('className="brand-home"');expect(main).not.toContain('>Remove Reference</button>');expect(main).not.toContain('>Reference</button>');
  });
});

it('shortcut close is outside scrolling content and Inspector separator is outside its viewport',()=>{
 const html=renderToStaticMarkup(React.createElement(KeyboardShortcuts,{bindings:{},onChange:()=>{},onClose:()=>{}}));
 expect(html.match(/aria-label="Close"/g)).toHaveLength(1);expect(html.indexOf('aria-label="Close"')).toBeLessThan(html.indexOf('shortcut-body'));expect(html).not.toContain('>Close</button>');
 const main=readFileSync('src/renderer/main.tsx','utf8'),css=readFileSync('src/renderer/shell.css','utf8');
 expect(main).not.toContain('activeReference');expect(main).toContain('/><div className="inspector-scroll">{mode');
 expect(css).toContain('.workspace>.inspector{overflow:hidden;padding:0');expect(css).toContain('.shortcut-dialog{padding:0;overflow:hidden}');expect(css).toContain('.shortcut-body{overflow:auto;min-height:0');
});
