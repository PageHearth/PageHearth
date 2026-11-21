import {it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {saveMenu} from '../src/main/saveMenu';
import {commandDescriptor,commandBinding,commandForInput} from '../src/shared/commands';
it('File contains the canonical Save adapter',()=>{const source=readFileSync('src/main/main.ts','utf8');expect(source).toMatch(/label:'File',submenu:\[[\s\S]*?saveMenu\(!!store,settings.value.keybindings\|\|{},command\)/);});
it('uses menu label, canonical ID and effective accelerator without changing Palette label',()=>{const item=saveMenu(true,{},()=>{});expect(item.id).toBe('save');expect(item.label).toBe('Save');expect(item.accelerator).toBe(commandBinding('save'));expect(item.accelerator).toBe('Ctrl+S');expect(commandDescriptor('save')?.label).toBe('Save Project');});
it('dispatches exactly one canonical command per click',()=>{const send=vi.fn();const item=saveMenu(true,{},send);(item.click as Function)();expect(send.mock.calls).toEqual([[{kind:'save'}]]);expect(commandForInput({key:'s',control:true,shift:false,alt:false,meta:false})).toBe(item.id);});
it('reflects project availability without treating an error banner as menu busy state',()=>{expect(saveMenu(false,{},()=>{}).enabled).toBe(false);expect(saveMenu(true,{},()=>{}).enabled).toBe(true);});
it('prevents duplicate native accelerator delivery through the existing before-input handler',()=>{const source=readFileSync('src/main/main.ts','utf8');expect(source).toContain("id==='save'){event.preventDefault();if(store)command({kind:id});}");});
