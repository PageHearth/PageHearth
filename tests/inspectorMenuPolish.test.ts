import {it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync('src/main/main.ts','utf8');
// Execute the actual two menu definitions without booting Electron.
const entries=source.split('\n').filter(line=>/^\s*\{label:'(Tools|Help)',submenu:/.test(line));
it('places Tools before final Help in the actual menu template',()=>{
 expect(entries).toHaveLength(2);expect(entries[0]).toContain("label:'Tools'");
 expect(source).toMatch(/\{label:'Help',submenu:[^\n]+\n\s*\]\)\);/);
});
it.each([true,false])('preserves menu commands, shortcuts, updates and availability (project=%s)',open=>{
 const command=vi.fn(),send=vi.fn(),check=vi.fn(),show=vi.fn(),focus=vi.fn();
 const [tools,help]=runInNewContext('['+entries.join('\n')+']',{command,store:open?{}:null,settings:{value:{keybindings:{}}},commandBinding:()=> 'Ctrl+Shift+P',BrowserWindow:{getFocusedWindow:()=>null},win:{show,focus,webContents:{send}},updates:{check}});
 expect(tools.submenu.map((x:any)=>x.id||x.label)).toEqual(['settings','Command Palette…','Project Maintenance']);
 expect(help.submenu.map((x:any)=>x.id||x.label)).toEqual(['Check for Updates…','about','keyboard-shortcuts']);
 expect(tools.submenu[1].accelerator).toBe('Ctrl+Shift+P');expect(tools.submenu[2].submenu[0].enabled).toBe(open);
 tools.submenu[0].click();tools.submenu[1].click();tools.submenu[2].submenu[0].click();help.submenu.forEach((x:any)=>x.click());
 expect(command.mock.calls).toEqual([[{kind:'settings'}],[{kind:'rebuild'}],[{kind:'about'}],[{kind:'shortcuts'}]]);
 expect(send.mock.calls).toEqual([['app-command',{kind:'command-palette'}],['show-updates']]);expect(check).toHaveBeenCalledOnce();expect(show).toHaveBeenCalledTimes(2);expect(focus).toHaveBeenCalledTimes(2);
});
