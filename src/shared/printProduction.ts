import type {PublicationDocument,PreflightIssue} from './publicationCompiler.js';
export type PrintOptions={chapterFont:string;chapterItalic?:boolean;chapterSize:number;chapterAlign:'left'|'center'|'right';chapterAbove:number;chapterBelow:number;headerLeft:'none'|'author'|'title'|'chapter';headerRight:'none'|'author'|'title'|'chapter';footer:'none'|'center'|'outside'};
export const classicPrint:PrintOptions={chapterFont:'Libertinus Serif',chapterSize:22,chapterAlign:'center',chapterAbove:36,chapterBelow:24,headerLeft:'author',headerRight:'title',footer:'center'};
export function validatePrintOptions(v:PrintOptions){if(!v||v.chapterItalic!==undefined&&typeof v.chapterItalic!=='boolean'||typeof v.chapterFont!=='string'||v.chapterFont.length>200||!['left','center','right'].includes(v.chapterAlign)||!['none','author','title','chapter'].includes(v.headerLeft)||!['none','author','title','chapter'].includes(v.headerRight)||!['none','center','outside'].includes(v.footer)||[v.chapterSize,v.chapterAbove,v.chapterBelow].some(n=>!Number.isFinite(n)||n<0||n>200)||v.chapterSize<6)throw Error('Invalid print typography settings.');}
export const trimSizes=[[5,8],[5.25,8],[5.5,8.5],[6,9],[7,10],[8,10],[8.5,11]] as const;
// KDP paperback black ink / white paper only, official rule snapshot 2026-10-31.
// https://kdp.amazon.com/en_US/help/topic/GVBQ3CMEQW3W2VL6
export const kdpInsideBands=[[150,27],[300,36],[500,45],[700,54],[828,63]] as const;
export const kdpInside=(pages:number)=>kdpInsideBands.find(([max])=>pages<=max)?.[1]??63;
export const kdpMaxPages=(width:number,height:number)=>width===612&&height===792?590:828;
export type PrintProof={id:string;projectId:string;fingerprint:string;pdf:Uint8Array;pages:number;diagnostics:PreflightIssue[];fonts:{requested:string;resolved:string;embedded:boolean;fallback:boolean}[];sections:{id:string;page:number;number:string}[];timings:Record<string,number>&{compileMs:number;generateMs:number;renderMs:number;inspectMs:number};bytes:number;sha256:string;details:string};
export function printIssue(d:PublicationDocument,code:string,message:string,blocking=false,fix='Review Print settings.'):PreflightIssue{return {severity:blocking?'error':'warning',code,message,blocking,target:'print',profile:d.print.profile,fix};}
export function printPreflight(d:PublicationDocument,pages?:number):PreflightIssue[]{
 const g=d.print,s=d.style.print,issues:PreflightIssue[]=d.preflight.filter(i=>!['profile-unqualified','assets-unverified'].includes(i.code)).map(i=>({...i,source:i.source?{...i.source,path:i.source.path?[...i.source.path]:undefined}:undefined}));
 const error=(code:string,message:string)=>issues.push(printIssue(d,code,message,true));
 if(g.width<180||g.height<252||g.width-g.margins.inside-g.margins.outside-g.gutter<144||g.height-g.margins.top-g.margins.bottom<144)error('geometry','Content area must be at least 2 × 2 inches and trim at least 2.5 × 3.5 inches.');
 if(s.sizePt<6||s.sizePt>36||s.lineHeight<1||s.lineHeight>2.5)error('typography','Body size must be 6–36 pt and line spacing 1–2.5.');
 if(g.profile==='ingram')error('ingram-unqualified','IngramSpark remains unqualified. PDF/X export is not available.');
 if(g.profile==='kdp'){
  if(!trimSizes.some(([w,h])=>g.width===w*72&&g.height===h*72))error('kdp-trim','This KDP profile supports the listed paperback trim sizes only.');
  const outside=g.bleed?27:18;
  for(const key of ['top','bottom','outside'] as const)if(g.margins[key]<outside)error('kdp-margin',`${key}: ${(g.margins[key]/72).toFixed(3)} in; KDP minimum ${(outside/72).toFixed(3)} in${g.bleed?' with bleed':''}.`);
  if(pages!==undefined){const max=kdpMaxPages(g.width,g.height);if(pages<24||pages>max)error('kdp-pages',`KDP black ink / white paper at this trim requires 24–${max} pages; actual ${pages}.`);if(g.margins.inside+g.gutter<kdpInside(pages))error('kdp-gutter',`Inside + gutter: ${((g.margins.inside+g.gutter)/72).toFixed(3)} in; required ${(kdpInside(pages)/72).toFixed(3)} in for ${pages} pages.`);}
 }
 if(!/^(en|de|fr|es|it|pt|nl|sv|da|no|fi)(-|$)/i.test(d.metadata.language))issues.push(printIssue(d,'language','Hyphenation for this book language has not been qualified. Inspect the proof.'));
 return issues;
}
export function exportFilename(title:string){let s=title.replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').replace(/[. ]+$/,'').trim().slice(0,120)||'Book';if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s))s='Book-'+s;return s+'.pdf';}
export function spreadPages(page:number,total:number){const p=Math.max(1,Math.min(total,page));return p===1?[1]:[p%2===0?p:p-1,p%2===0?p+1:p].filter(n=>n<=total);}
