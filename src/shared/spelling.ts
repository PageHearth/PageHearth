import type {AuthorState,Project} from './model.js';

export type ProjectDictionary={version:1;entries:{spelling:string;caseSensitive?:boolean}[]};
export type VocabularySource={type:'manual'|'glossary'|'series-dictionary'|'series-glossary';id:string;spelling:string;caseSensitive?:boolean};
export type VocabularyEntry={key:string;spelling:string;sources:readonly VocabularySource[]};
export type VocabularySnapshot={projectId:string;entries:readonly VocabularyEntry[]};
export type SpellingToken={word:string;key:string;from:number;to:number};
export const normalizeSpelling=(text:string)=>text.trim().normalize('NFC').replaceAll('’',"'");
export function spellingTokens(text:string,offset=0):SpellingToken[]{return [...text.matchAll(/[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*/gu)].map(m=>({word:m[0],key:normalizeSpelling(m[0]),from:offset+m.index!,to:offset+m.index!+m[0].length}));}
export function validSpelling(value:unknown):value is string{return typeof value==='string'&&value.length<=256&&value===value.trim()&&value===value.normalize('NFC')&&!!value&&!/[\p{Cc}\p{Cf}]/u.test(value)&&spellingTokens(value).length>0;}
export function validateProjectDictionary(value:unknown){
 if(value===undefined)return;
 const d=value as ProjectDictionary;
 if(!d||Array.isArray(d)||d.version!==1||Object.keys(d).some(k=>!['version','entries'].includes(k))||!Array.isArray(d.entries)||d.entries.length>100000)throw Error('Unsupported or damaged Project Dictionary.');
 const seen=new Set<string>();for(const entry of d.entries){if(!entry||Object.keys(entry).some(k=>!['spelling','caseSensitive'].includes(k))||(entry.caseSensitive!==undefined&&typeof entry.caseSensitive!=='boolean')||!validSpelling(entry.spelling))throw Error('Invalid Project Dictionary spelling.');const key=normalizeSpelling(entry.spelling);if(seen.has(key))throw Error('Duplicate Project Dictionary spelling.');seen.add(key);}
}
export function changeDictionary(project:Project,spelling:string,action:'add'|'remove'|'case',caseSensitive=false):Project{
 const display=spelling.trim().normalize('NFC');if(!validSpelling(display))throw Error('Enter a word or short phrase (up to 256 characters).');
 const entries=project.author.projectDictionary?.entries||[],key=normalizeSpelling(display),exists=entries.some(e=>normalizeSpelling(e.spelling)===key);
 if(action==='case'&&!exists)return project;if(action!=='case'&&(action==='add')===exists)return project;
 const next=action==='case'?entries.map(e=>normalizeSpelling(e.spelling)===key?{...e,caseSensitive}:e):action==='add'?[...entries,{spelling:display,caseSensitive}]:entries.filter(e=>normalizeSpelling(e.spelling)!==key);
 const dictionary:ProjectDictionary={version:1,entries:next};validateProjectDictionary(dictionary);
 return {...project,author:{...project.author,projectDictionary:dictionary}};
}
/** A phrase approves its constituent spelling tokens, retaining the complete phrase and every source. */
export function resolveVocabulary(projectId:string,author:AuthorState):VocabularySnapshot{
 const values=new Map<string,{key:string;spelling:string;sources:VocabularySource[]}>();
 const add=(source:VocabularySource)=>{for(const token of spellingTokens(source.spelling)){const entry=values.get(token.key)||{key:token.key,spelling:token.word,sources:[]};if(!entry.sources.some(s=>s.type===source.type&&s.id===source.id&&s.spelling===source.spelling))entry.sources.push(Object.freeze({...source}));values.set(token.key,entry);}};
 for(const entry of author.projectDictionary?.entries||[])add({type:'manual',id:normalizeSpelling(entry.spelling),spelling:entry.spelling,caseSensitive:entry.caseSensitive===true});
 for(const entity of author.worldBible?.entities||[])if(entity.type==='glossary'&&!entity.trashed)for(const spelling of [entity.name,...entity.aliases])add({type:'glossary',id:entity.id,spelling,caseSensitive:entity.spellingCaseSensitive===true});
 return Object.freeze({projectId,entries:Object.freeze([...values.values()].map(e=>Object.freeze({...e,sources:Object.freeze(e.sources)})))});
}

/** Backend-independent contract; no engine flags belong in canonical project data. */
export interface SpellEngine{initialize():Promise<void>;check(words:string[]):Promise<boolean[]>;suggest(word:string,limit:number):Promise<string[]>;dispose():void;}

/** Locale-independent matching; exact variants remain distinct, any approving source wins. */
export const foldSpelling=(word:string)=>normalizeSpelling(word).toLowerCase();
export function vocabularyRules(snapshot:VocabularySnapshot){
 const rules=new Map<string,{insensitive:boolean;exact:Set<string>}>();
 for(const entry of snapshot.entries){const key=foldSpelling(entry.key),rule=rules.get(key)||{insensitive:false,exact:new Set<string>()};for(const source of entry.sources){if(source.caseSensitive)rule.exact.add(normalizeSpelling(entry.key));else rule.insensitive=true;}rules.set(key,rule);}
 return rules;
}
export function vocabularyApproval(rules:ReturnType<typeof vocabularyRules>,word:string):boolean|undefined{const rule=rules.get(foldSpelling(word));return rule?rule.insensitive||rule.exact.has(normalizeSpelling(word)):undefined;}
