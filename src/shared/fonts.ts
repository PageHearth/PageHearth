export type FontCatalog={families:string[];source:'installed'|'fallback';warning?:string};
export function validFontFamily(value:unknown):value is string{return typeof value==='string'&&value.length>0&&value.length<=160&&value===value.trim()&&!/[\x00-\x1f\x7f;{}<>\\,]/u.test(value);}
export function cssFontFamily(family:string){return '"'+family.replaceAll('"','\\"')+'"';}
export function normalizeFontFamilies(values:unknown):string[]{
  if(!Array.isArray(values))return [];
  const unique=new Map<string,string>();
  for(const value of values){if(typeof value!=='string')continue;const name=value.trim().replace(/\s+/gu,' ');if(!validFontFamily(name)||name.startsWith('@'))continue;const key=name.toLocaleLowerCase('en-US');const old=unique.get(key);if(!old||name<old)unique.set(key,name);}
  return [...unique.values()].sort((a,b)=>a.localeCompare(b,'en-US',{sensitivity:'base'})||a.localeCompare(b,'en-US'));
}
export const fallbackFontFamilies=normalizeFontFamilies(['Arial','Arial Narrow','Bahnschrift','Book Antiqua','Bookman Old Style','Calibri','Cambria','Candara','Century','Century Gothic','Consolas','Constantia','Corbel','Courier New','DejaVu Sans','DejaVu Serif','Franklin Gothic Medium','Garamond','Georgia','Helvetica','Impact','Liberation Sans','Liberation Serif','Lucida Console','Lucida Sans Unicode','Noto Sans','Noto Serif','Palatino Linotype','Segoe UI','Tahoma','Times New Roman','Trebuchet MS','Verdana']);

/** Application UI history: preserve recency, unlike the alphabetic catalog. */
export function recentFontFamilies(values:unknown):string[]{if(!Array.isArray(values))return [];const seen=new Set<string>(),result:string[]=[];for(const value of values){const name=normalizeFontFamilies([value])[0];if(!name)continue;const key=name.toLocaleLowerCase('en-US');if(!seen.has(key)){seen.add(key);result.push(name);}if(result.length===8)break;}return result;}
export function fontGroups(catalog:string[],favorites:string[],recent:string[],current:string|null,query:string){const key=(s:string)=>s.toLocaleLowerCase('en-US'),matches=(s:string)=>key(s).includes(key(query)),used=new Set<string>();const group=(names:string[])=>names.filter(name=>{const k=key(name);if(used.has(k)||!matches(name))return false;used.add(k);return true;});return {recent:group(recentFontFamilies(recent)),favorites:group(normalizeFontFamilies(favorites)),all:group(normalizeFontFamilies([...(current&&current!=='Mixed'?[current]:[]),...catalog]))};}
