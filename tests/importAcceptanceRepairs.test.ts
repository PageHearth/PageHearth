import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {zipSync,strToU8} from 'fflate';
import {analyzeImport} from '../src/main/importAdapters';
import {canonicalImportDocument,importSchema} from '../src/main/importSchema';
import {hasColumnAmbiguity} from '../src/main/importPdfGeometry';
import {visibleText} from '../src/shared/textAnalysis';
import type {Doc} from '../src/shared/model';
const fixture=(name:string)=>readFileSync(new URL('./fixtures/manuscript-import/'+name,import.meta.url));
const tree=(n:Doc):Doc[]=>[n,...(n.content||[]).flatMap(tree)];
const canonical=async(bytes:Buffer,name:string)=>{
 const a=await analyzeImport(bytes,name,'2026-10-14');
 const doc=canonicalImportDocument({type:'doc',content:a.blocks.map(b=>b.body)});
 importSchema.nodeFromJSON(doc).check();
 for(const list of tree(doc).filter(n=>['bulletList','orderedList'].includes(n.type)))expect(list.content?.every(n=>n.type==='listItem')).toBe(true);
 return {a,doc,text:visibleText(doc)};
};
it.each([
 ['simple','- Alpha',['Alpha']],
 ['multiple','- Alpha\n- Beta',['Alpha','Beta']],
 ['ordered','1. Alpha\n2. Beta',['Alpha','Beta']],
 ['nested bullets','- Alpha\n  - Beta\n  - Gamma',['Alpha','Beta','Gamma']],
 ['mixed nesting','1. Alpha\n   - Beta\n     1. Gamma',['Alpha','Beta','Gamma']],
 ['loose','- Alpha\n\n  Second paragraph.\n\n- Beta',['Alpha','Second paragraph.','Beta']],
 ['marks and links','- **Alpha** *Beta* [Gamma](https://example.com) `Delta`',['Alpha','Beta','Gamma','Delta']],
 ['adjacent prose and code','Before\n\n- Alpha\n- Beta\n\nAfter\n\n```\nconst gamma = 1;\n```',['Before','Alpha','Beta','After','const gamma = 1;']],
] as const)('Markdown %s has legal canonical lists and retained text',async(_label,source,expected)=>{
 const {doc,text}=await canonical(Buffer.from(source),'book.md');let at=-1;for(const word of expected){const next=text.indexOf(word,at+1);expect(next).toBeGreaterThan(at);at=next;}
 if(source.includes('**')){const marks=tree(doc).flatMap(n=>n.marks||[]);expect(marks.map(m=>m.type)).toEqual(expect.arrayContaining(['bold','italic','link','code']));}
 if(_label==='nested bullets')expect(tree(doc).filter(n=>n.type==='bulletList')).toHaveLength(2);
 if(_label==='mixed nesting')expect(tree(doc).filter(n=>['bulletList','orderedList'].includes(n.type))).toHaveLength(3);
 if(source.includes('Second paragraph'))expect(tree(doc).find(n=>n.type==='listItem')?.content?.filter(n=>n.type==='paragraph')).toHaveLength(2);
});
it('full Greywater Markdown validates without stripping lists/code/quote or inferring references',async()=>{
 const {doc,text}=await canonical(fixture('greywater_markdown.md'),'renamed.md');
 expect(tree(doc).map(n=>n.type)).toEqual(expect.arrayContaining(['bulletList','listItem','blockquote','codeBlock','heading']));
 for(const phrase of ['Brass key','Blue lantern','Three bells','[[Mina]]','BELL_SEQUENCE'])expect(text).toContain(phrase);
 expect(text).not.toContain('window.__PAGEHEARTH');expect(JSON.stringify(doc)).not.toContain('entityReference');
});
it('special Word file omits only non-content separator warnings and preserves useful diagnostics/text',async()=>{
 const {a,text}=await canonical(fixture('greywater_special_content.docx'),'special.docx');
 expect(a.diagnostics.map(d=>d.code)).toEqual(expect.arrayContaining(['REVISIONS','COMMENTS','MEDIA','NOTES','TABLE']));
 expect(JSON.stringify(a.diagnostics)).not.toMatch(/w:(separator|continuationSeparator)/);
 for(const phrase of ['The lamp was blue before the storm.','three-pronged wave','05:42','First bell heard','No rope movement'])expect(text).toContain(phrase);
 expect(text).not.toContain('The lamp was green before the storm.');
});
it('unrecognized Word content is still reported rather than blanket-suppressed',async()=>{
 const bytes=Buffer.from(zipSync(Object.fromEntries(Object.entries({'[Content_Types].xml':'<Types/>','word/document.xml':'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Kept prose</w:t></w:r><w:unknownContent/></w:p></w:body></w:document>'}).map(([k,v])=>[k,strToU8(v)]))));
 const a=await analyzeImport(bytes,'unknown.docx','now');expect(a.diagnostics.some(d=>d.code==='DOCX_CONVERSION'&&d.message.includes('unknownContent'))).toBe(true);
});
const item=(x:number,y:number,width=200)=>({str:'Readable line',transform:[1,0,0,12,x,y],width,height:12});
it('geometry detects sustained columns irrespective of content-stream order',()=>{
 const left=[item(40,700),item(40,680),item(40,660)],right=[item(300,700),item(300,680),item(300,660)];
 expect(hasColumnAmbiguity([...right,...left])).toBe(true);expect(hasColumnAmbiguity([...left,...right])).toBe(true);
});
it.each(['normal','centered heading','indentation','sparse'] as const)('%s geometry is not falsely treated as columns',kind=>{
 const body=[item(40,700,460),item(40,680,460),item(40,660,410)];
 const input=kind==='centered heading'?[item(190,740,160),...body]:kind==='indentation'?[item(65,720,430),...body]:kind==='sparse'?[item(40,700),item(300,700)]:body;
 expect(hasColumnAmbiguity(input)).toBe(false);
});
it('Greywater columns rates Caution with human-readable explanation even under a neutral filename',async()=>{
 const {a,text}=await canonical(fixture('greywater_pdf_caution_columns.pdf'),'neutral.pdf');expect(a.quality).toBe('Caution');
 expect(a.diagnostics.some(d=>d.code==='PDF_COLUMNS'&&/columns.*reading order/i.test(d.message))).toBe(true);
 expect(text).toContain('Right column drawn first in PDF content stream.');expect(text).toContain('Human reading order should still be left column then right.');
});
it('Greywater single-column PDF remains Good',async()=>{expect((await canonical(fixture('greywater_pdf_good.pdf'),'good.pdf')).a.quality).toBe('Good');});
it('Greywater scanned PDF still blocks without OCR',async()=>{await expect(analyzeImport(fixture('greywater_pdf_scanned_image_only.pdf'),'scan.pdf','now')).rejects.toThrow('OCR');});
