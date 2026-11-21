import type {Doc,Project} from './model.js';
import {scopeDocuments} from './continuous.js';
export type TextStats={words:number;characters:number;charactersWithoutSpaces:number;paragraphs:number;sentences:number};
export const zeroStats=():TextStats=>({words:0,characters:0,charactersWithoutSpaces:0,paragraphs:0,sentences:0});
// Preserve whitespace-token word semantics, but punctuation alone is not a word.
// Dictionaries and Glossary concepts never merge visible words.
export const wordTokens=(text:string)=>text.match(/\S+/gu)?.filter(t=>/[\p{L}\p{N}]/u.test(t))||[];
export function visibleText(doc:Doc):string{
 if(doc.type==='manuscriptImage')return String(doc.attrs?.caption||'');
 if(doc.type==='hardBreak')return '\n';if(doc.text!==undefined)return doc.text;
 const children=doc.content||[];return children.map(visibleText).join(['doc','manuscriptSegment','bulletList','orderedList','taskList','listItem','taskItem','blockquote'].includes(doc.type)?'\n':'');
}
/** Blank lines, or tab/4-space indented prose lines, are unambiguous fallback boundaries.
 * Single ordinary hard breaks remain inside a paragraph. Never mutate the source. */
export function proseSections(text:string):string[]{return text.replace(/\r\n?/g,'\n').split(/\n[ \t]*\n(?:[ \t]*\n)*|\n(?=\t\S| {4,}\S)/u).filter(s=>s.trim());}
const sentenceSegmenter=new Intl.Segmenter('en',{granularity:'sentence'});
const cache=new WeakMap<Doc,TextStats>();
export function analyze(doc:Doc):TextStats{
 const cached=cache.get(doc);if(cached)return cached;
 const text=visibleText(doc),result=zeroStats();result.words=wordTokens(text).length;result.characters=Array.from(text).length;result.charactersWithoutSpaces=Array.from(text.replace(/\s/gu,'')).length;
 const visit=(n:Doc)=>{if(['paragraph','heading','codeBlock'].includes(n.type)){const parts=proseSections(visibleText(n));result.paragraphs+=parts.length;for(const part of parts)result.sentences+=Array.from(sentenceSegmenter.segment(part)).filter(s=>/[\p{L}\p{N}]/u.test(s.segment)).length;}else n.content?.forEach(visit);};visit(doc);cache.set(doc,result);return result;
}
export function sumStats(docs:Doc[]):TextStats{return docs.reduce((a,doc)=>{const b=analyze(doc);for(const k of Object.keys(a) as (keyof TextStats)[])a[k]+=b[k];return a;},zeroStats());}
export function manuscriptIds(p:Project,root?:string):string[]{
 return scopeDocuments(p,root?{kind:'roots',ids:[root]}:{kind:'all'});
}
