import type {PublicationDocument} from './publicationCompiler.js';
/** Output-scope numbering without changing canonical manuscript titles. */
export function publicationTitles(document:PublicationDocument){
 let chapter=0;const titles=new Map<string,string>();
 for(const section of document.sections){if(section.kind==='chapter')chapter++;titles.set(section.id,section.kind==='chapter'&&document.style.shared.chapterHeading==='number-title'?`${chapter}. ${section.title}`:section.title);}
 return titles;
}
