import {it,expect} from 'vitest';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const root='assets/branding/pagehearth/';
it('ships the approved manual mark unchanged and no embedded raster or external dependency',()=>{
 const svg=fs.readFileSync(root+'PageHearth_Mark.svg');
 expect(createHash('sha256').update(svg).digest('hex')).toBe('f3d4f24da4be956e96fc051f48c6fd2e6a3e616c4a998a216bde063a4f43fa58');
 expect(svg.toString()).not.toMatch(/<image|<filter|<script|href=|data:/);
 expect(fs.readFileSync('src/renderer/AppShell.tsx','utf8')).toContain('PageHearth_Mark.svg');
});
it.each(['App','Install','File'])('provides the %s Windows icon at all required sizes',name=>{
 const b=fs.readFileSync(root+`PageHearth_${name}_Icon.ico`);
 expect(b.readUInt16LE(2)).toBe(1);expect(b.readUInt16LE(4)).toBe(7);
 const sizes=[];for(let i=0;i<7;i++){const offset=6+i*16,size=b[offset]||256;sizes.push(size);const start=b.readUInt32LE(offset+12),length=b.readUInt32LE(offset+8);expect(start+length).toBeLessThanOrEqual(b.length);expect(b.subarray(start,start+8).toString('hex')).toBe('89504e470d0a1a0a');expect(b.readUInt32BE(start+16)).toBe(size);expect(b.readUInt32BE(start+20)).toBe(size);}
 expect(sizes).toEqual([16,24,32,48,64,128,256]);
});
it('keeps native icon resources outside ASAR and installer/shortcut configuration intact',()=>{
 const p=JSON.parse(fs.readFileSync('package.json','utf8'));
 expect(p.build.win.icon).toBe(root+'PageHearth_App_Icon.ico');
 expect(p.build.extraResources).toContainEqual({from:root+'PageHearth_App_Icon.ico',to:'branding/PageHearth_App_Icon.ico'});
 expect(p.build.nsis.installerIcon).toBe(root+'PageHearth_Install_Icon.ico');expect(p.build.nsis.uninstallerIcon).toBe(p.build.nsis.installerIcon);
 expect(p.build.nsis.createDesktopShortcut).toBe(true);expect(p.build.nsis.createStartMenuShortcut).toBe(true);
});
