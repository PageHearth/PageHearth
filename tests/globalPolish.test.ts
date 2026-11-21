import {describe,it,expect} from 'vitest';
import {defaultPublication,validatePublication} from '../src/shared/publication';
import {adoptPublicationStyle,publicationRenderPlan} from '../src/shared/publicationStyleAdapter';
import {bookPresets,applyBookPreset,presetCustomized,presetSnapshot,restoreBookPreset} from '../src/shared/bookPresets';
import {epubFallbackFonts} from '../src/shared/epubFallbackFonts';
import {renderToStaticMarkup} from 'react-dom/server';
import React from 'react';
import BookPresets from '../src/renderer/BookPresets';
import PublicationPreflight from '../src/renderer/PublicationPreflight';
import {readFileSync} from 'node:fs';
const classic=()=>adoptPublicationStyle(defaultPublication('Test'),{});
describe('explicit Book Style starting presets',()=>{
 it('leaves legacy Classic and ordinary reads unchanged',()=>{const p=defaultPublication('Old'),before=JSON.stringify(p);expect(presetCustomized(p)).toBeUndefined();expect(JSON.stringify(p)).toBe(before);expect(()=>applyBookPreset(p,'modern')).toThrow('Review');});
 it('retains Classic rendered defaults',()=>{const p=classic();expect(presetCustomized(p)).toBe(false);const a=publicationRenderPlan(p),b=publicationRenderPlan(applyBookPreset(p,'classic'));for(const k of Object.keys(a.style.print) as (keyof typeof a.style.print)[]){if(typeof a.style.print[k]==='number')expect(b.style.print[k]).toBeCloseTo(a.style.print[k] as number,6);else expect(b.style.print[k]).toEqual(a.style.print[k]);}expect(b.production).toEqual({...a.production,chapterItalic:false});});
 it.each([
  ['classic',11,1.4,12,0,'justify',22,36,24,false],
  ['modern',11.5,1.5,0,8.8,'left',17.6,16.5,19.8,false],
  ['literary',11,1.5,16.5,0,'justify',29.7,55,33,true],
  ['compact',11,1.2,9.9,0,'justify',17.6,16.5,12.1,false],
  ['spacious',12,1.65,13.75,2.75,'justify',26.4,44,30.8,false],
 ] as const)('%s projects its differentiated values into the Print renderer',(id,size,line,indent,space,align,heading,above,below,italic)=>{
  const p=publicationRenderPlan(applyBookPreset(classic(),id));
  expect(p.style.print.font).toBe('serif');expect(p.style.print.sizePt).toBeCloseTo(size);expect(p.style.print.lineHeight).toBe(line);expect(p.style.print.indentPt).toBeCloseTo(indent);expect(p.style.print.paragraphSpacePt).toBeCloseTo(space);expect(p.style.print.alignment).toBe(align);
  expect(p.production!.chapterFont).toBe('serif');expect(p.production!.chapterSize).toBeCloseTo(heading);expect(p.production!.chapterAbove).toBeCloseTo(above);expect(p.production!.chapterBelow).toBeCloseTo(below);expect(p.production!.chapterItalic).toBe(italic);expect(p.production!.chapterAlign).toBe(id==='modern'?'left':'center');
 });
 it('does not silently update previously saved starting values',()=>{const p=applyBookPreset(classic(),'literary');p.bookStyle!.body.lineHeight=1.45;p.bookStyle!.chapters={family:'Libertinus Serif',size:1.9,alignment:'center',italic:false,spaceAbove:4,spaceBelow:2.5};const prior=JSON.stringify(p);expect(presetCustomized(p)).toBe(true);publicationRenderPlan(p);expect(JSON.stringify(p)).toBe(prior);expect(restoreBookPreset(applyBookPreset(p,'modern'),p,presetSnapshot(applyBookPreset(p,'modern')))).toEqual(p);});
 it('offers descriptions before applying, without introducing font dependencies',()=>{const p=classic(),html=renderToStaticMarkup(React.createElement(BookPresets,{plan:p,onChange:()=>{}}));expect(html).toContain('Compare starting styles');for(const preset of bookPresets)expect(html).toContain(preset.description);for(const preset of bookPresets){const next=publicationRenderPlan(applyBookPreset(p,preset.id));expect(next.ebook.options!.embeddedFont).toBeUndefined();expect(next.ebook.options!.chapterStyle!.fontPolicy).toBe('body');}});
 it.each(bookPresets)('$name applies supported values, persists identity and leaves non-style data untouched',preset=>{const p=classic();p.bookStyle!.roles.letter={italic:true};p.bookStyle!.variants.v={family:'Ink Free'};p.bookStyle!.passages.p={lineHeight:1.8};const before=JSON.stringify(p),next=applyBookPreset(p,preset.id);validatePublication(next);expect(JSON.stringify(p)).toBe(before);expect(next.bookStyle!.body.lineHeight).toBe(preset.line);expect(next.style.name).toBe(preset.name);expect(presetCustomized(next)).toBe(false);expect(next.bookStyle!.roles).toEqual(p.bookStyle!.roles);expect(next.bookStyle!.variants).toEqual(p.bookStyle!.variants);expect(next.bookStyle!.passages).toEqual(p.bookStyle!.passages);expect(next.print).toEqual(p.print);expect(next.pages).toEqual(p.pages);expect(next.ebook).toEqual(p.ebook);const reopened=JSON.parse(JSON.stringify(next));validatePublication(reopened);expect(presetCustomized(reopened)).toBe(false);expect(publicationRenderPlan(reopened).style.print.lineHeight).toBe(preset.line);});
 it('detects real custom changes rather than project existence',()=>{const p=applyBookPreset(classic(),'modern');p.bookStyle!.body.lineHeight=1.6;expect(presetCustomized(p)).toBe(true);});
 it('restores previous style without erasing later unrelated changes',()=>{const p=classic();p.bookStyle!.body.family='Georgia';const next=applyBookPreset(p,'compact'),key=presetSnapshot(next);next.metadata.subtitle='Later';next.bookStyle!.roles.letter={family:'Arial'};const restored=restoreBookPreset(next,p,key);expect(restored.bookStyle!.body).toEqual(p.bookStyle!.body);expect(restored.metadata.subtitle).toBe('Later');expect(restored.bookStyle!.roles.letter!.family).toBe('Arial');});
 it('rejects stale restore and unknown presets',()=>{const p=classic(),next=applyBookPreset(p,'spacious'),key=presetSnapshot(next);next.bookStyle!.chapters.size=3;expect(()=>restoreBookPreset(next,p,key)).toThrow('changed');expect(()=>applyBookPreset(p,'unknown')).toThrow();});
 it('renders five real options and clear scope without changing project state',()=>{const p=classic(),before=JSON.stringify(p),html=renderToStaticMarkup(React.createElement(BookPresets,{plan:p,onChange:()=>{throw Error('render mutation');}}));for(const preset of bookPresets)expect(html).toContain(preset.name);expect(html).toContain('Special Text, scene breaks');expect(JSON.stringify(p)).toBe(before);});
});
describe('EPUB fallback explanations',()=>{
 const warn=(message:string)=>({code:'font-unavailable',message,fix:'Choose a compatible font.',severity:'warning' as const,blocking:false,target:'ebook' as const,profile:'reflowable'});
 it('deduplicates real names, preserves known chapter usage and does not invent body usage',()=>{const fonts=epubFallbackFonts([warn('Ink Free: cannot be embedded in EPUB. A reader fallback will be used.'),warn('Chapter font Ink Free cannot be embedded in EPUB; using body fallback.'),warn('Georgia: cannot be embedded in EPUB. A reader fallback will be used.')]);expect(fonts.map(f=>f.name)).toEqual(['Ink Free','Georgia']);expect(fonts[0].chapter).toBe(true);expect(fonts[1].chapter).toBe(false);});
 it('uses plural wording and retains underlying diagnostics',()=>{const issues=[warn('One: cannot be embedded in EPUB.'),warn('Two: cannot be embedded in EPUB.')],html=renderToStaticMarkup(React.createElement(PublicationPreflight,{issues}));expect(html).toContain('2 fonts cannot be embedded in EPUB');expect(html).toContain('One');expect(html).toContain('Two');expect(html).toContain('Technical details');expect(html).toContain('depends on the reader');});
 it('does not reclassify blocking errors or unrelated warnings',()=>{expect(epubFallbackFonts([{...warn('Blocked'),blocking:true},{...warn('Other'),code:'missing-image'}])).toEqual([]);});
});
it('keeps actual runtime version and existing preference stores',()=>{const main=readFileSync('src/main/main.ts','utf8'),ui=readFileSync('src/renderer/ShellDialog.tsx','utf8');expect(main).toContain('version:app.getVersion()');expect(ui).toContain('info.version');expect(ui).not.toContain('0.1.2');expect(ui).toContain('onDirty={setThemeDirty}');expect(ui).toContain('projectSettings');});
