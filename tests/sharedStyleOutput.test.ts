import {it,expect} from 'vitest';
import {unzipSync,strFromU8} from 'fflate';
import fixture from './fixtures/special-text-variants.json';
import type {Project} from '../src/shared/model';
import {createVariant} from '../src/shared/publicationVariants';
import {ebookRegions,setEbookRegionVariant} from '../src/shared/ebookRegions';
import {compilePublication} from '../src/shared/publicationCompiler';
import {adoptPublicationStyle} from '../src/shared/publicationStyleAdapter';
import {inspectStyleMigration} from '../src/shared/publicationStyle';
import {printRegionStyles} from '../src/shared/printVariants';
import {interchange} from '../src/main/interchange';
import {renderEpub} from '../src/main/epubRenderer';
import {groupedPublicationIssues} from '../src/shared/publicationPreflight';
import {validatePublication} from '../src/shared/publication';
import {Store} from '../src/main/storage';
import {restoreBackup} from '../src/main/archive';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import BookStyleControls from '../src/renderer/BookStyleControls';

function shared(){let p=structuredClone(fixture) as Project;const first=createVariant(p,'letter','Hush Handwriting');p=first.project;const second=createVariant(p,'letter','Mina Handwriting');p=second.project;const regions=ebookRegions(compilePublication(p,'print')).filter(r=>r.role==='letter');for(const [i,r] of regions.entries())p=setEbookRegionVariant(p,r.key,i===1?second.id:first.id);const plan=p.author.publication!;
 p.author.publication=adoptPublicationStyle(plan,Object.fromEntries(inspectStyleMigration(plan).conflicts.map(c=>[c.id,{use:'print' as const}])));
 const s=p.author.publication.bookStyle!;s.body.family='Libertinus Serif';s.roles.poem={family:'Georgia',paragraphSpace:.8};s.roles.document={family:'Arial'};s.variants[first.id]={family:'Ink Free',italic:false};s.variants[second.id]={family:'Georgia',italic:false};s.ebookPermissions['variants/'+first.id]={licenseConfirmed:true};s.ebookPermissions['variants/'+second.id]={licenseConfirmed:true};return {p,first:first.id,second:second.id};}
it('one variant choice drives Print, EPUB, DOCX and HTML without changing manuscript or source branches',async()=>{
 const {p,first,second}=shared(),before=JSON.stringify(p),print=compilePublication(p,'print');
 expect(printRegionStyles(print).filter(x=>x.region.role==='letter').map(x=>x.style.font)).toEqual(['Ink Free','Georgia','Ink Free']);
 const ebook=compilePublication(p,'ebook');expect(ebook.specialTextVariants?.filter(v=>v.id===first||v.id===second).map(v=>v.treatments.ebook.family)).toEqual(['Ink Free','Georgia']);
 const word=await interchange(compilePublication(p,'editorial'),'docx','.'),zip=unzipSync(word.bytes),xml=strFromU8(zip['word/document.xml']);
 expect(xml).toContain('Ink Free');expect(xml).toContain('Georgia');expect(strFromU8(zip['word/styles.xml'])).toContain('Libertinus Serif');
 const html=new TextDecoder().decode((await interchange(compilePublication(p,'genericText'),'html','.')).bytes);expect(html).toContain('Ink Free');expect(html).toContain('Georgia');expect(html).toContain('Libertinus Serif');expect(html).not.toContain('<script');
 expect(JSON.stringify(p)).toBe(before);
});
it('EPUB keeps named intent, warns when resource bytes are unavailable, and deduplicates resources',()=>{
 const {p,first}=shared(),font={family:'Ink Free',bytes:new Uint8Array([0,1,2,3]),format:'ttf' as const},book=renderEpub(compilePublication(p,'ebook'),new Map(),new Date(),undefined,new Map([['Ink Free',font]]));
 expect(book.css).toContain('@font-face');expect(Object.keys(unzipSync(book.bytes)).filter(k=>k.startsWith('EPUB/fonts/'))).toHaveLength(1);
 p.author.publication!.bookStyle!.ebookPermissions['variants/'+first].licenseConfirmed=false;
 const unavailable=renderEpub(compilePublication(p,'ebook'),new Map());expect(unavailable.issues.some(i=>i.code==='font-unavailable'&&i.message.includes('Ink Free'))).toBe(true);
 expect(p.author.publication!.bookStyle!.variants[first].family).toBe('Ink Free');
});
it('Markdown/TXT deliberately omit preferred font names and disclose lossiness',async()=>{
 const {p}=shared();for(const format of ['md','txt'] as const){const out=await interchange(compilePublication(p,'genericText'),format,'.');expect(new TextDecoder().decode(out.bytes)).not.toContain('Ink Free');expect(out.notes.some(n=>n.includes('Typography is omitted'))).toBe(true);}
});
it('grouping is presentation only and retains distinct blocking severity',()=>{
 const issue={code:'font-unavailable',message:'Ink Free: fallback',fix:'Review font permission',target:'ebook' as const,profile:'generic',blocking:false,severity:'warning' as const};const issues=[issue,{...issue},{...issue,blocking:true,severity:'error' as const}];
 expect(groupedPublicationIssues(issues).map(g=>g.count)).toEqual([2,1]);expect(issues).toHaveLength(3);
});
it('canonical shared style validates after serialization and unknown shared versions are rejected',()=>{
 const {p}=shared(),plan=JSON.parse(JSON.stringify(p.author.publication));expect(()=>validatePublication(plan)).not.toThrow();plan.bookStyle.version=2;expect(()=>validatePublication(plan)).toThrow();
});
it('unified controls expose one shared style and no Print/eBook synchronization ceremony',()=>{
 const {p}=shared(),html=renderToStaticMarkup(createElement(BookStyleControls,{project:p,onChange:()=>{}}));
 expect(html).toContain('Book Style');expect(html).toContain('Hush Handwriting');expect(html).toContain('Selected Special Text');expect(html).not.toContain('Use eBook font for Print');expect(html).not.toContain('Print treatment');
});
it('legacy conflicting fonts require explicit one-time choices in the style surface',()=>{
 const {p}=shared();delete p.author.publication!.bookStyle;p.author.publication!.version=1;
 const v=p.author.publication!.specialTextVariants![0];v.treatments={ebook:{family:'Ink Free'},print:{font:'Georgia'}};
 const html=renderToStaticMarkup(createElement(BookStyleControls,{project:p,onChange:()=>{}}));
 expect(html).toContain('Needs style reconciliation');expect(html).toContain('Use Print');expect(html).toContain('Use eBook');expect(html).toContain('Choose another value');expect(html).toContain('disabled=""');
});
it('shared styles survive protected author staging, restart and verified restore without Activity or prose mutation',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ph-shared-style-'));let store=new Store(root),restored:Store|undefined;
 try{await store.create('Shared design');const {p}=shared();p.manifest.id=store.project.manifest.id;p.manifest.nodes.push(...store.project.manifest.nodes);Object.assign(p.documents,store.project.documents);
  const prose=structuredClone(p.documents),activity=await store.writing.read();await store.stageAuthor(p.author,store.project.author);await store.commit(p);const backup=await store.backup();await store.release();store=new Store(root);await store.open();
  expect(store.project.author.publication).toEqual(p.author.publication);expect(store.project.documents).toEqual(prose);expect(await store.writing.read()).toEqual(activity);
  restored=new Store(await restoreBackup(backup,root));await restored.open();expect(restored.project.author.publication).toEqual(p.author.publication);expect(restored.project.documents).toEqual(prose);
 }finally{await restored?.release();await store.release();await fs.rm(root,{recursive:true,force:true});}
});
