import {it,expect} from 'vitest';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {unzipSync,strFromU8} from 'fflate';
import {createManuscriptImage} from '../src/shared/manuscriptImages.js';
import {prepareManuscriptImage,writeManuscriptImage} from '../src/main/manuscriptImageAssets.js';
import {defaultAuthor,validate,type Project} from '../src/shared/model.js';
import {compilePublication} from '../src/shared/publicationCompiler.js';
import {interchange} from '../src/main/interchange.js';
import {ebookImage} from '../src/main/ebookImages.js';
import {renderEpub} from '../src/main/epubRenderer.js';
it('renders canonical images into real EPUB/DOCX/HTML/Markdown/TXT resources',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pagehearth-image-output-'));
 try{const bytes=await fs.readFile('assets/branding/pagehearth/PageHearth_App_Icon.png'),a=await writeManuscriptImage(root,prepareManuscriptImage(bytes)),id=randomUUID(),projectId=randomUUID();
 const image=createManuscriptImage(projectId,a.asset,a.width,a.height);image.attrs={...image.attrs,alt:'QA image description',caption:'QA IMAGE caption',size:'small',alignment:'right'};
 const p:Project={manifest:{version:1,id:projectId,title:'Image QA',revision:0,nodes:[{id,parent:null,title:'One',kind:'Chapter'}],settings:{editor:{},publication:{},workspace:{}}},documents:{[id]:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Before image.'}]},image,{...structuredClone(image),attrs:{...image.attrs,id:randomUUID()}},{type:'paragraph',content:[{type:'text',text:'After image.'}]}]}},author:defaultAuthor(),recovery:[]};
 validate(p);const original=JSON.stringify(p),d=compilePublication(p,'ebook',new Set([a.asset])),epub=renderEpub(d,new Map([[a.asset,ebookImage(bytes)]]),new Date('2026-11-05T00:00:00Z')),archive=unzipSync(epub.bytes);
 expect(Object.keys(archive).filter(f=>f.startsWith('EPUB/images/'))).toHaveLength(1);const xhtml=epub.sections.map(s=>s.xhtml).join('');expect(xhtml.match(/alt="QA image description"/g)).toHaveLength(2);expect(xhtml).toContain('width:30%');expect(xhtml).toContain('margin-right:0');expect(xhtml).toContain('<figcaption>QA IMAGE caption</figcaption>');
 const html=new TextDecoder().decode((await interchange(d,'html',root)).bytes);expect(html).toContain('data:image/png;base64,');expect(html).toContain('QA IMAGE caption');expect(html).toContain('width:30%');
 const markdown=await interchange(d,'md',root);expect(Object.keys(markdown.assets)).toHaveLength(1);expect(new TextDecoder().decode(markdown.bytes)).toContain('![QA image description](');expect(new TextDecoder().decode(markdown.bytes)).not.toContain(root);
 const txt=new TextDecoder().decode((await interchange(d,'txt',root)).bytes);expect(txt).toContain('[Image: QA image description]');expect(txt).toContain('QA IMAGE caption');
 const docx=unzipSync((await interchange(d,'docx',root)).bytes);expect(Object.keys(docx).some(f=>f.startsWith('word/media/'))).toBe(true);expect(strFromU8(docx['word/document.xml'])).toContain('QA image description');expect(strFromU8(docx['word/document.xml'])).toContain('QA IMAGE caption');expect(JSON.stringify(p)).toBe(original);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
