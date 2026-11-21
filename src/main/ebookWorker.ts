import {variantBase} from '../shared/publicationVariants.js';
import {ebookRoleStyle} from '../shared/ebookStyles.js';
import {parentPort,workerData} from 'node:worker_threads';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {verifiedAsset} from './typstPrint.js';
import {renderEpub,type EbookAsset,type EbookFont} from './epubRenderer.js';
import {loadEbookFont} from './ebookFonts.js';
import {ebookImage} from './ebookImages.js';
import {validateEpub} from './ebookValidator.js';
import type {PublicationDocument,SemanticNode,DeepReadonly} from '../shared/publicationCompiler.js';
const controller=new AbortController();parentPort!.on('message',m=>{if(m==='cancel')controller.abort();});
const check=()=>{if(controller.signal.aborted)throw Error('eBook render canceled.');};
let directory:string|undefined;
try{
 const {document,root,resources,temporary,preview=false}=workerData as {document:PublicationDocument;root:string;resources:string;temporary:string;preview?:boolean};const started=performance.now();
 if(!preview){const runtime=JSON.parse(await fs.readFile(path.join(resources,'runtime.json'),'utf8'));for(const file of runtime.files){check();const absolute=path.resolve(resources,file.path);if(!absolute.startsWith(path.resolve(resources)+path.sep))throw Error('Unsafe validator resource path.');const data=await fs.readFile(absolute);if(data.length!==file.bytes||createHash('sha256').update(data).digest('hex')!==file.sha256)throw Error('Offline validator resource integrity check failed.');}}
 const integrityDone=performance.now();
 if(!preview){await fs.mkdir(temporary,{recursive:true});directory=await fs.mkdtemp(path.join(temporary,'book-'));parentPort!.postMessage({temporary:directory});}
 const names=new Set<string>();if(document.metadata.coverAsset)names.add(document.metadata.coverAsset);const visit=(nodes:readonly DeepReadonly<SemanticNode>[])=>{for(const n of nodes){if(n.image)names.add(n.image.asset);if(n.children)visit(n.children);}};document.sections.forEach(s=>visit(s.nodes));
 const assets=new Map<string,EbookAsset>(),derivatives=new Map<string,EbookAsset>();let total=0;
 for(const name of names){check();const file=await verifiedAsset(root,name),stat=await fs.stat(file);total+=stat.size;if(stat.size>64*1024*1024||total>256*1024*1024)throw Error('eBook images exceed the safe rendering limit (64 MiB per image, 256 MiB total).');const bytes=await fs.readFile(file);const digest=createHash('sha256').update(bytes).digest('hex');let image=derivatives.get(digest);if(!image){image=ebookImage(bytes,!preview);derivatives.set(digest,image);}assets.set(name,image);}
 const imagesDone=performance.now();
 let fontBytes=0;const loadedFonts=new Map<string,EbookFont>();
 // Legacy licenseConfirmed values remain readable but are not a rendering gate.
 const loadFont=async(selected:{family:string}|undefined):Promise<EbookFont|undefined>=>{if(!selected)return;if(loadedFonts.has(selected.family))return loadedFonts.get(selected.family);const font=await loadEbookFont(selected.family,resources);if(font){fontBytes+=font.bytes.length;if(fontBytes>64*1024*1024)throw Error('Selected eBook fonts exceed the 64 MiB resource limit.');loadedFonts.set(selected.family,font);}return font;};
 const font=await loadFont(document.ebook.options?.embeddedFont),roleFonts=new Map<string,EbookFont>();
 for(const style of [...(document.ebook.options?.chapterStyle?[document.ebook.options.chapterStyle]:[]),...Object.values(document.ebook.options?.specialText||{}),...(document.specialTextVariants||[]).map(v=>variantBase(v.role,document.ebook.options?.specialText,document.specialTextVariants,v.id)),...(document.ebook.options?.regions||[]).map(r=>({...variantBase(r.role,document.ebook.options?.specialText,document.specialTextVariants,r.variantId),...r.style}))]){check();if(style?.fontPolicy==='embedded'&&style.family&&!roleFonts.has(style.family)){const f=await loadFont({family:style.family});if(f)roleFonts.set(f.family,f);}}

 const loaded=performance.now();check();const book=renderEpub(document,assets,new Date(),font,roleFonts,!preview);const rendered=performance.now();check();const timings={...book.timings,integrityMs:integrityDone-started,imagesMs:imagesDone-integrityDone,fontsMs:loaded-imagesDone,rssBytes:process.memoryUsage().rss,assetsMs:loaded-started,renderZipMs:rendered-loaded,validationMs:0,totalMs:performance.now()-started};if(preview){parentPort!.postMessage({result:{mode:'preview',projectId:document.projectId,sections:book.sections,css:book.css,images:book.images,issues:book.issues,timings}});}else{const artifactPath=path.join(directory!,'book.epub');await fs.writeFile(artifactPath,book.bytes,{flag:'wx'});const validation=[],validatorTimings:Record<string,number>={};for(const version of ['5.3.0','5.4.0'] as const){check();parentPort!.postMessage({stage:version==='5.3.0'?'epub-check-53':'epub-check-54'});const start=performance.now();validation.push(await validateEpub(resources,artifactPath,version,controller.signal));validatorTimings['epubcheck'+version+'Ms']=performance.now()-start;}check();
 parentPort!.postMessage({result:{projectId:document.projectId,artifactPath,bytes:book.bytes.length,sha256:createHash('sha256').update(book.bytes).digest('hex'),sections:book.sections,css:book.css,images:book.images,issues:book.issues,validation,timings:{...book.timings,...validatorTimings,integrityMs:integrityDone-started,imagesMs:imagesDone-integrityDone,fontsMs:loaded-imagesDone,rssBytes:process.memoryUsage().rss,assetsMs:loaded-started,renderZipMs:rendered-loaded,validationMs:performance.now()-rendered,totalMs:performance.now()-started}}});}
}catch(e){if(directory)await fs.rm(directory,{recursive:true,force:true});parentPort!.postMessage({error:e instanceof Error?e.message:String(e)});}finally{parentPort!.close();}
