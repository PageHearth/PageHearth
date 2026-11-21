import {parse} from 'parse5';
import type {Doc} from '../shared/model.js';
import type {ImportDiagnostic} from '../shared/manuscriptImport.js';
import {validFontFamily} from '../shared/fonts.js';
import {IMPORT_LIMITS} from './importPackage.js';
export const paragraph=(text=''):Doc=>({type:'paragraph',content:text?[{type:'text',text}]:[]});
export const safeLink=(href:string)=>{try{const u=new URL(href);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}};
export function htmlBlocks(source:string,diagnostics:ImportDiagnostic[]):Doc[]{
 const root=parse(source) as any;let count=0;const warned=new Set<string>();const warn=(code:string,message:string)=>{if(!warned.has(code)){warned.add(code);diagnostics.push({code,severity:'WARNING',message});}};
 const inline=(n:any,marks:NonNullable<Doc['marks']>=[],depth=0):Doc[]=>{
  if(depth>IMPORT_LIMITS.depth||++count>500000)throw Error('HTML structure exceeds safe limits.');if(n.nodeName==='#text')return n.value?[{type:'text',text:n.value,marks}]:[];
  const tag=n.tagName||'',attrs=Object.fromEntries((n.attrs||[]).map((a:any)=>[a.name,a.value]));
  if(tag==='head'&&!(n.childNodes||[]).length)return [];
  if(['script','style','iframe','object','embed','head','nav','template','svg'].includes(tag)||'hidden'in attrs||/display\s*:\s*none|visibility\s*:\s*hidden/i.test(attrs.style||'')){warn('HTML_OMITTED','Scripts, navigation, hidden content or unsupported active elements were omitted.');return [];}
  if(['img','video','audio','canvas'].includes(tag)){warn('MEDIA','Images and media are not imported into manuscript text. Keep the original source for these items.');return [];}
  let next=[...marks];const simple:Record<string,string>={b:'bold',strong:'bold',i:'italic',em:'italic',u:'underline',s:'strike',del:'strike',code:'code'};if(simple[tag])next.push({type:simple[tag]});
  if(tag==='a'){const href=safeLink(attrs.href||'');if(href)next.push({type:'link',attrs:{href}});else warn('LINK','Internal or unsafe links were converted to ordinary text.');}
  const font=(attrs.style||'').match(/(?:^|;)\s*font-family\s*:\s*([^;]+)/i)?.[1]?.replace(/^['"]|['"]$/g,'').trim();if(font&&validFontFamily(font))next.push({type:'textStyle',attrs:{fontFamily:font}});
  const points=Number((attrs.style||'').match(/(?:^|;)\s*font-size\s*:\s*([\d.]+)pt/i)?.[1]);if(points>=6&&points<=144)next.push({type:'fontSize',attrs:{points:Math.round(points*10)/10}});
  if(tag==='br')return [{type:'hardBreak'}];if(tag==='hr')return [{type:'horizontalRule',...(attrs['data-import-separator']?{attrs:{importSeparator:attrs['data-import-separator']}}:{})}];
  // HTML pretty-printing (including markdown-it) places newline text between
  // <li> elements. It is layout whitespace, not legal list-container content.
  const children=(n.childNodes||[]).filter((c:any)=>!(['ul','ol'].includes(tag)&&c.nodeName==='#text'&&!c.value.trim())).flatMap((c:any)=>inline(c,next,depth+1));
  if(tag==='table'){warn('TABLE','Tables were converted to readable row and cell text; table layout is not retained.');}
  if(['td','th'].includes(tag))return [...children,{type:'text',text:' | '}];if(tag==='tr')return [{type:'paragraph',content:[{type:'text',text:textOf(children)}].filter(c=>c.text)}];
  if(/^h[1-6]$/.test(tag))return [{type:'heading',attrs:{level:Number(tag[1])},content:children.filter((c:Doc)=>['text','hardBreak'].includes(c.type))}];
  const blocks:Record<string,string>={p:'paragraph',blockquote:'blockquote',ul:'bulletList',ol:'orderedList',li:'listItem',pre:'codeBlock'};
  if(blocks[tag]){const type=blocks[tag],align=(attrs.style||'').match(/text-align\s*:\s*(left|center|right)/i)?.[1];let content=children;if(type==='codeBlock')content=[{type:'text',text:textOf(children)}].filter(c=>c.text);else if(['paragraph'].includes(type))content=children.filter((c:Doc)=>['text','hardBreak'].includes(c.type));else if(type==='listItem'||type==='blockquote'){content=wrap(children);if(type==='listItem'&&content[0]?.type!=='paragraph')content.unshift(paragraph());}return [{type,content,...(align?{attrs:{textAlign:align}}:{})}];}
  return children;
 };
 return wrap(inline(root));
}
function textOf(nodes:Doc[]):string{return nodes.map(n=>n.text??(n.type==='hardBreak'?'\n':textOf(n.content||[])+(['paragraph','heading','listItem'].includes(n.type)?'\n':''))).join('');}
export function wrap(nodes:Doc[]):Doc[]{const out:Doc[]=[];let run:Doc[]=[];const flush=()=>{if(run.some(n=>n.text?.trim()||n.type==='hardBreak'))out.push({type:'paragraph',content:run});run=[];};for(const n of nodes){if(n.type==='text'||n.type==='hardBreak')run.push(n);else{flush();out.push(n);}}flush();return out;}
export function navigationLabels(source:string):{href:string;label:string}[]{const result:{href:string;label:string}[]=[];let count=0;const text=(n:any):string=>n.nodeName==='#text'?n.value:(n.childNodes||[]).map(text).join('');const visit=(n:any,depth=0)=>{if(depth>IMPORT_LIMITS.depth||++count>500000)throw Error('EPUB navigation is too complex.');if(n.tagName==='a'){const href=n.attrs?.find((a:any)=>a.name==='href')?.value,label=text(n).trim();if(href&&label)result.push({href,label:label.slice(0,500)});}for(const child of n.childNodes||[])visit(child,depth+1);};visit(parse(source));return result;}
