import {expect,it} from 'vitest';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import ShellDialog from '../src/renderer/ShellDialog';
import {SUPPORT_URL} from '../src/renderer/SupportDevelopment';

it('About offers an optional text link to the repository-designated Ko-fi account',()=>{
 expect(readFileSync('.github/FUNDING.yml','utf8')).toMatch(/ko_fi:\s*pagehearth/);
 expect(SUPPORT_URL).toBe('https://ko-fi.com/pagehearth');
 const html=renderToStaticMarkup(React.createElement(ShellDialog,{kind:'about',zoom:100,onZoom:()=>{},onShortcuts:()=>{},onClose:()=>{}}));
 expect(html).toContain('Support development');
 expect(html).toContain('Contributions are completely optional.');
 expect(html).toContain(`href="${SUPPORT_URL}"`);
 expect(html).toContain('Open Ko-fi in your default browser');
 expect(html).toMatch(/<img[^>]+width="20"[^>]+height="20"[^>]+alt=""/);
 expect(html).not.toMatch(/<(iframe|img)[^>]+https:/);
});
