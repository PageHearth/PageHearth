import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {Home} from '../src/renderer/Home';
import {StudioButton} from '../src/renderer/DesignFoundation';
const noop=()=>{};const props={busy:false,recents:[],onNew:noop,onOpen:noop,onRecent:noop,onRemove:noop,onRestore:noop,onRecover:noop,onTemplates:noop};
describe('Home foundation',()=>{
 it('has a literary heading, clear empty state and all existing project actions',()=>{const html=renderToStaticMarkup(createElement(Home,props));for(const label of ['Every story starts somewhere.','No recent projects yet.','New Project…','Open Project…','Restore backup…','Recover emergency JSON…','Manage Templates…'])expect(html).toContain(label);expect(html).not.toContain('https://');});
 it('renders existing metadata without loading projects and escapes content',()=>{const html=renderToStaticMarkup(createElement(Home,{...props,recents:[{title:'<Novel>',path:'C:\\Books\\A & B',lastOpened:'2026-11-06T12:00:00Z'}]}));expect(html).toContain('&lt;Novel&gt;');expect(html).toContain('A &amp; B');expect(html).toContain('Remove from list');expect(html).toContain('dateTime=');expect(html).not.toContain('No recent projects');});
 it('guards all actions while busy',()=>{const html=renderToStaticMarkup(createElement(Home,{...props,busy:true}));expect((html.match(/disabled=""/g)||[])).toHaveLength(5);});
 it.each(['primary','secondary','quiet','danger'] as const)('provides opt-in %s controls',variant=>{const html=renderToStaticMarkup(createElement(StudioButton,{variant,children:'Action'}));expect(html).toContain('type="button"');expect(html).toContain('studio-button-'+variant);});
});

import {builtinThemes,themeStyle,contrast} from '../src/shared/themes';
it('studio accents remain readable and custom themes retain their palette without new required tokens',()=>{for(const theme of builtinThemes){const css=themeStyle(theme);expect(contrast(css['--studio-accent'],theme.tokens.accentText)).toBeGreaterThanOrEqual(4.5);expect(contrast(css['--studio-accent-hover'],theme.tokens.accentText)).toBeGreaterThanOrEqual(4.5);}const custom={...builtinThemes[0],id:'custom'};expect(themeStyle(custom)['--studio-accent']).toBe(custom.tokens.accent);});
import {windowAccent} from '../src/main/windowChrome';
import {ShellNavigation} from '../src/renderer/AppShell';
import {readFileSync} from 'node:fs';
it('uses adaptive brand text and the existing emblem, not a raster brand label',()=>{const html=renderToStaticMarkup(createElement(ShellNavigation,{mode:'WRITE',workspace:'editor',hasProject:false,busy:false,onHome:noop,onMode:noop,onWorkspace:noop}));expect(html).toContain('shell-emblem');expect(html).toContain('shell-brand-name');expect(html).toContain('>PageHearth</span>');expect(html).toContain('aria-current="page"');});
it('keeps native frames and routes main/detached theme changes through the optional policy',()=>{expect(windowAccent(builtinThemes[0],'win32')).toBe(null);const main=readFileSync('src/main/main.ts','utf8');expect(main).toContain('applyWindowChrome(child,resolveTheme(');expect(main).toContain('applyWindowChrome(win,resolveTheme(');expect(main).toContain('applyWindowChrome(item.window,resolveTheme(');expect(main).not.toContain('titleBarOverlay');expect(main).not.toContain('nativeWindowChrome');});
it('only built-in themes receive decorative atmosphere; custom palettes stay flat',()=>{for(const t of builtinThemes)expect(themeStyle(t)['--home-warmth']).not.toBe('transparent');const custom={...builtinThemes[0],id:'custom'};expect(themeStyle(custom)['--home-warmth']).toBe('transparent');expect(themeStyle(custom)['--home-depth']).toBe('transparent');});
it('places tools before recent work in reading and keyboard order',()=>{const html=renderToStaticMarkup(createElement(Home,props));expect(html.indexOf('home-tools-title')).toBeLessThan(html.indexOf('home-recents-title'));});
it('shipped atmospheric extremes and translucent Tools preserve text contrast',()=>{
 const blend=(front:string,back:string,scale=1)=>{const a=front.length===9?parseInt(front.slice(7,9),16)/255*scale:scale;return '#'+[1,3,5].map(i=>Math.round(parseInt(front.slice(i,i+2),16)*a+parseInt(back.slice(i,i+2),16)*(1-a)).toString(16).padStart(2,'0')).join('');};
 for(const t of builtinThemes){const css=themeStyle(t);let backgrounds=[css['--home-base']];for(const layer of ['--home-balance','--home-depth','--home-balance','--home-warmth'] as const)backgrounds=[...backgrounds,...backgrounds.map(b=>blend(css[layer],b))];
 for(const bg of backgrounds){for(const surface of [bg,blend(t.tokens.elevatedSurface,bg,.42)])for(const fg of [t.tokens.textPrimary,css['--home-secondary'],css['--home-muted'],css['--home-link']])expect(contrast(fg,surface),`${t.id}: ${fg} on ${surface}`).toBeGreaterThanOrEqual(4.5);expect(contrast(t.tokens.focus,bg)).toBeGreaterThanOrEqual(3);}
 }
});
it('uses cheap non-interactive atmospheric paint and a lighter Tools surface',()=>{const css=readFileSync('src/renderer/home.css','utf8');expect(css).toContain('background-attachment:local');expect(css).toContain('var(--home-balance)');expect(css).toContain('var(--elevated) 42%');expect(css).not.toMatch(/backdrop-filter|filter:|animation:|url\(/);const custom={...builtinThemes[0],id:'custom'};expect(themeStyle(custom)['--home-balance']).toBe('transparent');expect(themeStyle(custom)['--home-base']).toBe(custom.tokens.appBackground);});
