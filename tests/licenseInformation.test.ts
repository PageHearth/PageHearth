import {it,expect} from 'vitest';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {LicenseInformation} from '../src/renderer/LicenseInformation';
import {openLicenseInformation} from '../src/main/licenseInformation';

it('identifies original source, public attribution, separate branding and offline source instructions',()=>{
 const html=renderToStaticMarkup(React.createElement(LicenseInformation));
 for(const text of ['Copyright © 2026 PixelFF','MPL-2.0','Third-party components retain their own licenses','branding is protected separately','Open offline licenses and source information'])expect(html).toContain(text);
 expect(html).not.toContain('does not declare');expect(html).not.toMatch(/https?:|<iframe/);
});
it('opens only the installed offline index and propagates unavailable-resource and shell errors',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'ph-legal-'));const calls:string[]=[];
 try{
  await expect(openLicenseInformation(root,async f=>{calls.push(f);return '';})).rejects.toThrow();expect(calls).toEqual([]);
  const file=path.join(root,'documentation/legal/index.html');await mkdir(path.dirname(file),{recursive:true});await writeFile(file,'offline');
  await openLicenseInformation(root,async f=>{calls.push(f);return '';});expect(calls).toEqual([file]);
  await expect(openLicenseInformation(root,async()=> 'No handler')).rejects.toThrow('No handler');
 }finally{await rm(root,{recursive:true,force:true});}
});
