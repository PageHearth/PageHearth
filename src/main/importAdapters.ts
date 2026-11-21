import mammoth from 'mammoth';
import {createRequire} from 'node:module';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {foreignPackage,xml,elements,IMPORT_LIMITS} from './importPackage.js';
import {htmlBlocks,paragraph,safeLink,navigationLabels} from './importConversion.js';
import {visibleText,wordTokens} from '../shared/textAnalysis.js';
import {validFontFamily} from '../shared/fonts.js';
import {hasColumnAmbiguity} from './importPdfGeometry.js';
import type {Doc} from '../shared/model.js';
import type {ImportAnalysis,ImportBlock,ImportDiagnostic,ImportFormat} from '../shared/manuscriptImport.js';
const require=createRequire(import.meta.url);
const MarkdownIt=require('markdown-it');
export async function analyzeImport(bytes:Buffer,filename:string,mtime:string,encoding?:string):Promise<ImportAnalysis>{
 const extension=path.extname(filename).slice(1).toLowerCase(),format=({markdown:'md',htm:'html'} as Record<string,string>)[extension]||extension;
 if(!['docx','txt','md','html','epub','pdf'].includes(format))throw Error('Choose DOCX, TXT, Markdown, HTML, EPUB or PDF.');if(bytes.length>IMPORT_LIMITS.source)throw Error('Source exceeds the 64 MiB analysis limit.');
 const diagnostics:ImportDiagnostic[]=[],blocks:ImportBlock[]=[];const parsers:Record<string,string>={};let selectedEncoding:string|undefined,quality:ImportAnalysis['quality'];
 const diagnostic=(code:string,message:string,severity:ImportDiagnostic['severity']='WARNING',location?:string)=>diagnostics.push({code,message,severity,...(location?{location}:{})});
 const push=(body:Doc,signals:Partial<ImportBlock>={})=>{if(body.type==='horizontalRule'&&body.attrs?.importSeparator){signals={...signals,separator:String(body.attrs.importSeparator)};body={type:'horizontalRule'};}const check=(n:Doc,depth=0)=>{if(depth>IMPORT_LIMITS.depth||(n.text?.length||0)>IMPORT_LIMITS.text)throw Error('Manuscript block exceeds safe text/depth limits.');for(const child of n.content||[])check(child,depth+1);};check(body);if(blocks.length>=IMPORT_LIMITS.blocks)throw Error('Source has too many semantic blocks.');blocks.push({id:String(blocks.length),body,location:'Block '+(blocks.length+1),...(body.type==='heading'?{heading:Number(body.attrs?.level)}:{}),...signals});};
 const decode=()=>{selectedEncoding=encoding||(bytes[0]===255&&bytes[1]===254?'utf-16le':bytes[0]===254&&bytes[1]===255?'utf-16be':'utf-8');try{const cp='€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ';return (selectedEncoding==='windows-1252'?Array.from(bytes,b=>b>=128&&b<=159?cp[b-128]:String.fromCharCode(b)).join(''):new TextDecoder(selectedEncoding,{fatal:true}).decode(bytes)).replace(/\r\n?/g,'\n');}catch{throw Error('ENCODING: This text is not valid UTF-8. Choose Older Windows text (Windows-1252) and review the sample.');}};
 if(['txt','md','html'].includes(format)){
  const source=decode();if(source.includes('\0'))throw Error('This file does not appear to contain supported text.');
  if(format==='txt'){parsers.TextDecoder=process.versions.node;for(const section of source.split(/\n[ \t]*\n+/)){push({type:'paragraph',content:section.split('\n').flatMap((line,i)=>[...(i?[{type:'hardBreak'}]:[]),...(line?[{type:'text',text:line}]:[])])});}}
  else {let html=source;if(format==='md'){parsers['markdown-it']=require('markdown-it/package.json').version;const md=new MarkdownIt({html:true,linkify:false,typographer:false});md.renderer.rules.hr=(tokens:any[],index:number)=>'<hr data-import-separator="'+md.utils.escapeHtml(source.split('\n')[tokens[index].map[0]].trim())+'">';html=md.render(source);}parsers.parse5='8.0.1';for(const b of htmlBlocks(html,diagnostics))push(b);}
 }else if(format==='docx'){
  parsers.mammoth='1.13.0';parsers.saxes='6.0.0';const files=foreignPackage(bytes);if(!files.has('word/document.xml')||!files.has('[Content_Types].xml'))throw Error('This is not a Word DOCX document.');
  let revisions=0,images=0,comments=0;for(const [name,content] of files){if(!/\.xml$|\.rels$/i.test(name))continue;const tree=xml(content);
   if(name==='word/document.xml'){revisions=elements(tree,'ins').length+elements(tree,'del').length+elements(tree,'moveFrom').length+elements(tree,'moveTo').length;revisions+=['rPrChange','pPrChange','tblPrChange','trPrChange','tcPrChange'].reduce((count,name)=>count+elements(tree,name).length,0);if(elements(tree,'pPr').some(properties=>elements(properties,'del').length))throw Error('Word contains tracked paragraph-boundary deletion. Accept changes in a copy before importing so paragraph order is unambiguous.');images=elements(tree,'drawing').length+elements(tree,'pict').length;if(elements(tree,'altChunk').length)throw Error('Word contains embedded document content that cannot be ordered safely. Save a flattened DOCX copy.');if(['cellMerge','cellDel','cellIns','conflictIns','conflictDel'].some(n=>elements(tree,n).length))throw Error('Word contains ambiguous tracked table/conflict changes. Accept changes in a copy before importing.');}
   if(name==='word/comments.xml')comments=elements(tree,'comment').length;
   if(name.endsWith('.rels'))for(const r of elements(tree,'Relationship'))if(r.attrs.TargetMode==='External'&&!r.attrs.Type?.endsWith('/hyperlink'))diagnostic('EXTERNAL_RESOURCE','External Word resources were not read.','WARNING',name);
  }
  if(revisions)diagnostic('REVISIONS',`This Word document contains ${revisions} tracked changes. Current/final text is imported; revision history is not retained.`);
  if(comments)diagnostic('COMMENTS',`This Word document contains ${comments} comments. Their text will not be imported into PageHearth.`);
  if(images)diagnostic('MEDIA',`${images} Word image objects are not imported. Keep the original source for these items.`);
  if(elements(xml(files.get('word/document.xml')!),'numPr').length)diagnostic('LIST_LAYOUT','Word list text and bullet/numbered item types are retained, but source numbering sequences and nested list layout are simplified. Review lists after import.');
  let document:any;
  // Pinned public transform hook: all signals and content come from this same tree.
  const converted=await mammoth.convertToHtml({buffer:bytes},{externalFileAccess:false,includeEmbeddedStyleMap:false,ignoreEmptyParagraphs:false,transformDocument:(root:any)=>{document=root;return {type:'document',children:[],notes:root.notes,comments:[]};}} as any);
  for(const msg of converted.messages){
   // Word's footnote rules contain no manuscript prose. Only these exact
   // Mammoth diagnostics are intentionally omitted; unknown content still warns.
   if(/^An unrecognised element was ignored: w:(separator|continuationSeparator)$/.test(msg.message))continue;
   diagnostic('DOCX_CONVERSION',msg.message);
  }
  if(!document)throw Error('Word analysis did not produce a document.');
  const notes:any[]=[];const inline=(n:any,marks:NonNullable<Doc['marks']>=[]):Doc[]=>{
   if(n.type==='text')return n.value?[{type:'text',text:n.value,marks}]:[];if(n.type==='tab'){diagnostic('TAB','Word tab characters were retained as whitespace.','INFO');return [{type:'text',text:'\t',marks}];}
   if(n.type==='break')return n.breakType==='line'?[{type:'hardBreak'}]:n.breakType==='page'?[{type:'importPageBreak'}]:[];
   if(n.type==='noteReference'){const note=document.notes.resolve(n);if(!note)throw Error('A Word footnote/endnote reference has no readable note.');notes.push(note);return [{type:'text',text:`[${n.noteType} ${n.noteId}]`,marks}];}
   if(['image','commentReference','bookmarkStart'].includes(n.type))return [];
   let next=[...marks];for(const [key,type] of [['isBold','bold'],['isItalic','italic'],['isUnderline','underline'],['isStrikethrough','strike']])if(n[key])next.push({type});
   if(n.font&&validFontFamily(n.font))next.push({type:'textStyle',attrs:{fontFamily:n.font}});if(n.fontSize>=6&&n.fontSize<=144)next.push({type:'fontSize',attrs:{points:Math.round(n.fontSize*10)/10}});
   if(n.type==='hyperlink'){const href=safeLink(n.href||'');if(href)next.push({type:'link',attrs:{href}});else diagnostic('LINK','An internal or unsafe Word link was converted to ordinary text.');}
   return (n.children||[]).flatMap((c:any)=>inline(c,next));
  };
  const hasBreak=(n:any):boolean=>n.type==='break'&&n.breakType==='page'||(n.children||[]).some(hasBreak);
  const convert=(n:any):Doc[]=>{if(n.type==='paragraph'){const level=Number((n.styleName||n.styleId||'').match(/^heading\s*([1-6])$/i)?.[1]);const content=inline(n),body:Doc={type:level?'heading':'paragraph',...(level?{attrs:{level}}:{}),content};if(['left','right','center'].includes(n.alignment))body.attrs={...body.attrs,textAlign:n.alignment};if(n.numbering)return [{type:n.numbering.isOrdered?'orderedList':'bulletList',content:[{type:'listItem',content:[body]}]}];return [body];}
   if(n.type==='table'){diagnostic('TABLE','Word tables were converted row by row; layout and merged-cell positioning are not retained.');return (n.children||[]).flatMap((row:any)=>row.children.flatMap((cell:any)=>convert(cell)));}
   return (n.children||[]).flatMap(convert);
  };
  for(const n of document.children){const pending=notes.length;for(const b of convert(n)){if(['paragraph','heading'].includes(b.type)){let content:Doc[]=[],boundary=false;for(const child of b.content||[]){if(child.type==='importPageBreak'){if(content.length)push({...b,content},{pageBreak:boundary});content=[];boundary=true;}else content.push(child);}push({...b,content},{pageBreak:boundary});}else {if(hasBreak(n))throw Error('A page break inside a list/table needs normalization in the source before import.');push(b);}}for(const note of notes.slice(pending)){diagnostic('NOTES','Footnotes/endnotes were placed after their containing paragraph as labeled text.','INFO');push(paragraph(`${note.noteType} ${note.noteId}:`));for(const part of note.body)for(const b of convert(part))push(b);}}
 }else if(format==='epub'){
  parsers.saxes='6.0.0';parsers.parse5='8.0.1';const files=foreignPackage(bytes);if(files.get('mimetype')?.toString().trim()!=='application/epub+zip')throw Error('This is not a supported EPUB.');
  const need=(name:string)=>{const value=files.get(name);if(!value)throw Error('EPUB is missing '+name);return value;};
  if(files.has('META-INF/encryption.xml')){const enc=xml(need('META-INF/encryption.xml'));const algorithms=elements(enc,'EncryptionMethod').map(e=>e.attrs.Algorithm);if(elements(enc,'CipherReference').some(r=>!/[.](ttf|otf|woff2?)$/i.test(r.attrs.URI||'')))throw Error('EPUB manuscript content is protected. Save an unprotected copy.');if(!algorithms.length||algorithms.some(a=>!['http://www.idpf.org/2008/embedding','http://ns.adobe.com/pdf/enc#RC'].includes(a)))throw Error('This EPUB is protected. Save an unprotected copy and try again.');diagnostic('FONTS','Obfuscated EPUB fonts were omitted; manuscript text remains readable.','INFO');}
  const root=elements(xml(need('META-INF/container.xml')),'rootfile')[0]?.attrs['full-path'];if(!root)throw Error('EPUB has no package document.');const pkg=xml(need(root)),items=elements(pkg,'item'),spine=elements(pkg,'itemref');if(!spine.length)throw Error('EPUB has no reading-order spine.');
  const resolve=(href:string)=>{const value=path.posix.normalize(path.posix.join(path.posix.dirname(root),decodeURIComponent(href.split('#')[0])));if(value.startsWith('../')||value.startsWith('/')||/[\\:]/.test(value))throw Error('Unsafe EPUB resource path.');return value;};
  const labels=new Map<string,string>();for(const item of items.filter(i=>i.attrs.properties?.split(' ').includes('nav'))){const nav=resolve(item.attrs.href);for(const entry of navigationLabels(need(nav).toString('utf8'))){if(/^[a-z]+:/i.test(entry.href))continue;const key=path.posix.normalize(path.posix.join(path.posix.dirname(nav),decodeURIComponent(entry.href.split('#')[0])));if(!key.startsWith('../')&&!labels.has(key))labels.set(key,entry.label);}}
  for(const ref of spine){const item=items.find(i=>i.attrs.id===ref.attrs.idref);if(!item)throw Error('EPUB spine references missing content.');if(item.attrs.properties?.split(' ').includes('nav')){diagnostic('NAV','EPUB navigation-only material was omitted.','INFO');continue;}if(item.attrs['media-type']!=='application/xhtml+xml')throw Error('EPUB contains unsupported non-text spine content.');const name=resolve(item.attrs.href),body=htmlBlocks(need(name).toString('utf8'),diagnostics);if(ref.attrs.linear==='no')diagnostic('NONLINEAR','Supplementary EPUB content is included for your review.','WARNING',name);let first=true;for(const b of body){push(b,{location:name,...(first?{spine:name,label:labels.get(name)||(b.type==='heading'?visibleText(b):undefined)}:{})});first=false;}}
 }else{
  parsers['pdfjs-dist']='6.4.299';if(!bytes.subarray(0,1024).includes(Buffer.from('%PDF-')))throw Error('This is not a PDF document.');
  const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const task=pdfjs.getDocument({data:new Uint8Array(bytes),useSystemFonts:false,disableFontFace:true,standardFontDataUrl:path.join(path.dirname(require.resolve('pdfjs-dist/package.json')),'standard_fonts').replaceAll('\\','/')+'/',stopAtErrors:true});
  try{const pdf=await task.promise;if(pdf.numPages>2000)throw Error('PDF exceeds the 2,000-page analysis limit.');let empty=0,fragments=0,replacements=0,duplicates=0,columns=0;
   for(let page=1;page<=pdf.numPages;page++){const p=await pdf.getPage(page),text=await p.getTextContent();const items=text.items.filter((v:any)=>typeof v.str==='string'&&v.str.trim()) as any[];if(!items.some(v=>v.str.trim()))empty++;if(hasColumnAmbiguity(items)){columns++;diagnostic('PDF_COLUMNS','This PDF appears to use multiple text columns. Extracted reading order may differ from the visible page.','WARNING','Page '+page);}let line='',lastY:number|undefined,lastX=0;const seen=new Set<string>();
    for(const item of items){const key=item.str+'|'+item.transform.slice(4).join(',');if(seen.has(key)){duplicates++;continue;}seen.add(key);fragments+=item.str.length<3?1:0;replacements+=(item.str.match(/\ufffd/g)||[]).length;const y=item.transform[5],x=item.transform[4];if(lastY!==undefined&&Math.abs(y-lastY)>2&&line){push(paragraph(line),{location:'Page '+page,pageBreak:!blocks.length||blocks.at(-1)?.location!=='Page '+page});line='';}if(lastY===y&&x-lastX>100)columns++;line+=(line&&x-lastX>1&&!/\s$/.test(line)&&!/^[.,;:!?\s]/.test(item.str)?' ':'')+item.str;lastY=y;lastX=x+item.width;if(item.hasEOL&&line){push(paragraph(line),{location:'Page '+page});line='';}}
    if(line)push(paragraph(line),{location:'Page '+page});p.cleanup();}
   quality=replacements>10||empty>pdf.numPages/2?'Poor':empty||columns||duplicates||fragments>100?'Caution':'Good';diagnostic('PDF_QUALITY',`PDF extraction quality: ${quality}. ${empty} pages without text; ${replacements} replacement characters; ${duplicates} duplicate overlays; ${columns} possible column gaps. Counts describe extracted text, not visual-page fidelity.`,'WARNING');
  }catch(e:any){if(e?.name==='PasswordException')throw Error('This PDF is protected. Save an unprotected copy and try again.');throw e;}finally{await task.destroy();}
 }
 if(!blocks.some(b=>visibleText(b.body).trim()))throw Error(format==='pdf'?'No usable PDF text was found. Scanned/image-only PDFs require OCR outside PageHearth.':'No usable manuscript text was found.');
 return {version:1,source:{filename,format:format as ImportFormat,bytes:bytes.length,mtime,digest:createHash('sha256').update(bytes).digest('hex')},parsers,encoding:selectedEncoding,quality,blocks,diagnostics:diagnostics.slice(0,1000),sourceWords:blocks.reduce((n,b)=>n+wordTokens(visibleText(b.body)).length,0),countingBasis:format==='pdf'?'PDF extracted text before structural mapping':'Converted semantic source text before structural mapping'};
}
