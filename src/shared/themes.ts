/** Global application-only theme data. No CSS, URLs, resources or project fields. */
export const themeTokenGroups={
 General:['appBackground','surface','elevatedSurface','border','subtleBorder','sidebarBackground','toolbarBackground','hoverSurface','activeSurface'],
 Text:['textPrimary','textSecondary','textMuted','link'],
 Editor:['editorBackground','editorText','selection','selectionText','spellingUnderline','focusWash'],
 Interactive:['accent','accentHover','accentText','focus','inputBackground','scrollbarThumb','scrollbarTrack'],
 Status:['success','warning','danger','errorBackground'],
 Overlays:['modalBackdrop','shadow'],
} as const;
export type ThemeToken=typeof themeTokenGroups[keyof typeof themeTokenGroups][number];
export type ThemeTokens=Record<ThemeToken,string>;
export type WindowTitleBar={mode:'system'}|{mode:'theme'}|{mode:'custom';color:string};
export type Theme={windowTitleBar?:WindowTitleBar;version:1;id:string;name:string;appearance:'light'|'dark';tokens:ThemeTokens};
export type ThemePreferences={selected:string;custom:Theme[]};
export type ThemeSnapshot={capabilities?:{windowAccent:boolean};preferences:ThemePreferences;override?:string;legacyMigration?:boolean};
export type ThemeRequest={action:'list'}|{action:'select';id:string}|{action:'migrate';id:string}|{action:'duplicate';id:string}|{action:'save';theme:Theme;expected:Theme}|{action:'delete';id:string}|{action:'import'}|{action:'export';id:string};
export const themeTokenNames=Object.values(themeTokenGroups).flat() as ThemeToken[];
const alphaTokens=new Set<ThemeToken>(['modalBackdrop','shadow','focusWash']);
export function validThemeColor(token:ThemeToken,value:unknown):value is string{return typeof value==='string'&&(alphaTokens.has(token)?/^#[\da-f]{6}([\da-f]{2})?$/i:/^#[\da-f]{6}$/i).test(value);}
const light:ThemeTokens={appBackground:'#eceef0',surface:'#f8f8f7',elevatedSurface:'#ffffff',border:'#89939d',subtleBorder:'#d7dbde',sidebarBackground:'#f8f8f7',toolbarBackground:'#e9eced',hoverSurface:'#e3e8eb',activeSurface:'#d9eef1',textPrimary:'#292c32',textSecondary:'#4f5a64',textMuted:'#626d78',link:'#006e83',editorBackground:'#fffdf8',editorText:'#292c32',selection:'#b9dfe6',selectionText:'#162d33',spellingUnderline:'#b92b32',focusWash:'#e1ab3021',accent:'#007a91',accentHover:'#006477',accentText:'#ffffff',focus:'#007a91',inputBackground:'#fffdf8',scrollbarThumb:'#687582',scrollbarTrack:'#eceef0',success:'#23633d',warning:'#805400',danger:'#9b3030',errorBackground:'#fff0e9',modalBackdrop:'#00000088',shadow:'#00000033'};
const dark:ThemeTokens={appBackground:'#1e2329',surface:'#24292f',elevatedSurface:'#30353b',border:'#788692',subtleBorder:'#414a53',sidebarBackground:'#24292f',toolbarBackground:'#1e2329',hoverSurface:'#343e48',activeSurface:'#244851',textPrimary:'#e4e6e8',textSecondary:'#c4cbd1',textMuted:'#aab4bf',link:'#72cedb',editorBackground:'#30353b',editorText:'#e4e6e8',selection:'#315d69',selectionText:'#ffffff',spellingUnderline:'#ff858c',focusWash:'#eaaf3829',accent:'#72cedb',accentHover:'#96deea',accentText:'#1e2329',focus:'#72cedb',inputBackground:'#30353b',scrollbarThumb:'#aab4bf',scrollbarTrack:'#1e2329',success:'#8dd5a6',warning:'#f0c66d',danger:'#ffaaa0',errorBackground:'#412a2b',modalBackdrop:'#00000099',shadow:'#00000066'};
const parchment:ThemeTokens={appBackground:'#ded4bf',surface:'#e9dfca',elevatedSurface:'#f5ecd8',border:'#91836c',subtleBorder:'#cfc2a9',sidebarBackground:'#e5dac4',toolbarBackground:'#e1d5be',hoverSurface:'#d9cdb5',activeSurface:'#cbdcce',textPrimary:'#342e26',textSecondary:'#554a3c',textMuted:'#655947',link:'#006777',editorBackground:'#f2e7cf',editorText:'#342e26',selection:'#b7d2cc',selectionText:'#233b36',spellingUnderline:'#a52b49',focusWash:'#a5782421',accent:'#006d7b',accentHover:'#005763',accentText:'#fffaf0',focus:'#006777',inputBackground:'#f5ecd8',scrollbarThumb:'#776a55',scrollbarTrack:'#ded4bf',success:'#305e39',warning:'#765000',danger:'#91333b',errorBackground:'#f3dbca',modalBackdrop:'#241c1688',shadow:'#34271933'};
export const builtinThemes:readonly Theme[]=Object.freeze([{version:1 as const,id:'Light',name:'PageHearth Light',appearance:'light' as const,tokens:Object.freeze(light)},{version:1 as const,id:'Dark',name:'PageHearth Dark',appearance:'dark' as const,tokens:Object.freeze(dark)},{version:1 as const,id:'Parchment',name:'Parchment',appearance:'light' as const,tokens:Object.freeze(parchment)}].map(t=>Object.freeze(t)));
export const defaultThemes=():ThemePreferences=>({selected:'System',custom:[]});
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function keys(v:Record<string,unknown>,allowed:readonly string[]){for(const k of Object.keys(v))if(!allowed.includes(k))throw Error('Unknown theme field: '+k);}
export function readWindowTitleBar(raw:unknown):WindowTitleBar{
 if(!object(raw))throw Error('Invalid window title bar setting.');
 if(raw.mode==='system'||raw.mode==='theme'){keys(raw,['mode']);return {mode:raw.mode};}
 if(raw.mode==='custom'){keys(raw,['mode','color']);if(typeof raw.color==='string'&&/^#[0-9a-f]{6}$/i.test(raw.color))return {mode:'custom',color:raw.color.toLowerCase()};}
 throw Error('Choose Follow Windows, Use theme accent, or a valid custom title-bar color.');
}
export function readTheme(raw:unknown,strict=true):Theme{
 if(!object(raw))throw Error('Malformed theme file.');keys(raw,['version','id','name','appearance','tokens','windowTitleBar']);
 if(raw.version!==1)throw Error('Unsupported theme version.');
 if(typeof raw.id!=='string'||!/^[A-Za-z][A-Za-z0-9._-]{0,63}$/.test(raw.id))throw Error('Invalid theme identity.');
 if(typeof raw.name!=='string'||!raw.name.trim()||raw.name.length>80||/[\x00-\x1f<>]/.test(raw.name))throw Error('Invalid theme name.');
 if(raw.appearance!=='light'&&raw.appearance!=='dark')throw Error('Invalid theme appearance.');
 if(!object(raw.tokens))throw Error('Malformed theme colors.');keys(raw.tokens,themeTokenNames);
 const tokens={...(raw.appearance==='dark'?dark:light)};
 for(const key of themeTokenNames){if(raw.tokens[key]===undefined)continue;if(validThemeColor(key,raw.tokens[key]))tokens[key]=raw.tokens[key].toLowerCase();else if(strict)throw Error('Invalid color: '+tokenLabel(key));}
 let windowTitleBar:WindowTitleBar|undefined;if(raw.windowTitleBar!==undefined){try{windowTitleBar=readWindowTitleBar(raw.windowTitleBar);}catch(e){if(strict)throw e;}}
 return {version:1,id:raw.id,name:raw.name.trim(),appearance:raw.appearance,tokens,...(windowTitleBar?{windowTitleBar}:{})};
}
export function loadThemes(raw:unknown):{preferences:ThemePreferences;warning?:string}{
 if(raw===undefined)return {preferences:defaultThemes()};
 try{if(!object(raw)||!Array.isArray(raw.custom)||raw.custom.length>100)throw Error();keys(raw,['selected','custom']);const custom=raw.custom.map(v=>readTheme(v,false));if(custom.some(t=>['System',...builtinThemes.map(t=>t.id)].includes(t.id))||new Set(custom.map(t=>t.id)).size!==custom.length)throw Error();const ids=['System',...builtinThemes.map(t=>t.id),...custom.map(t=>t.id)];const selected=typeof raw.selected==='string'&&ids.includes(raw.selected)?raw.selected:'System';return {preferences:{selected,custom},warning:JSON.stringify(raw)!==JSON.stringify({selected,custom})?'Some appearance preferences were restored to safe defaults.':undefined};}catch{return {preferences:defaultThemes(),warning:'Appearance preferences could not be read. The default theme is in use.'};}
}
export function resolveTheme(p:ThemePreferences,darkSystem=false,override?:string):Theme{const id=override??p.selected;return builtinThemes.find(t=>t.id===id)||p.custom.find(t=>t.id===id)||builtinThemes[darkSystem?1:0];}
export function tokenLabel(name:string){return name.replace(/([a-z])([A-Z])/g,(_,a,b)=>a+' '+b.toLowerCase()).replace(/^./,c=>c.toUpperCase());}
export function uniqueThemeName(name:string,custom:Theme[]){let n=name.slice(0,80),i=2;while([...builtinThemes,...custom].some(t=>t.name.toLowerCase()===n.toLowerCase()))n=name.slice(0,68)+' ('+(i++)+')';return n;}
export function importTheme(text:string,p:ThemePreferences,id:string):Theme{if(text.length>65536)throw Error('Theme file is too large (maximum 64 KiB).');const t=readTheme(JSON.parse(text));return {...t,id,name:uniqueThemeName(t.name,p.custom)};}
export function exportTheme(t:Theme){return JSON.stringify(readTheme(t),null,2)+'\n';}
export const themeVariables:Record<ThemeToken,string>={appBackground:'--app-background',surface:'--panel',elevatedSurface:'--elevated',border:'--border',subtleBorder:'--line',sidebarBackground:'--sidebar-background',toolbarBackground:'--canvas',hoverSurface:'--hover-surface',activeSurface:'--active-surface',textPrimary:'--text',textSecondary:'--text-secondary',textMuted:'--muted',link:'--link',editorBackground:'--page',editorText:'--editor-text',selection:'--selection',selectionText:'--selection-text',spellingUnderline:'--spelling-underline',focusWash:'--text-focus-warm',accent:'--accent',accentHover:'--accent-hover',accentText:'--primary-text',focus:'--focus',inputBackground:'--input-background',scrollbarThumb:'--scrollbar-thumb',scrollbarTrack:'--scrollbar-track',success:'--success',warning:'--warning',danger:'--danger',errorBackground:'--error-background',modalBackdrop:'--modal-backdrop',shadow:'--shadow'};
/** Opt-in studio accents: bundled palettes use restrained ember; custom themes keep their chosen accent.
 * Derived CSS only: no required theme-file tokens or migration, and no restyling of legacy workspaces. */
export function themeStyle(t:Theme){
 const studio=builtinThemes.includes(t)?({Light:['#985022','#7d3e18'],Dark:['#e9aa76','#f2bd91'],Parchment:['#88441b','#6f3515']} as Record<string,string[]>)[t.id]:undefined;
 // Derived Home paint only. Custom palettes remain authoritative and undecorated.
 const atmosphere=studio?({Light:['#fffdf8','#c9a06650','#6b859b20','#575e680c'],Dark:['#191d22','#a66b414a','#52667e1c','#00000026'],Parchment:['#f5ecd8','#b3833944','#81674b1c','#6147230c']} as Record<string,string[]>)[t.id]:undefined;
 return {...Object.fromEntries(themeTokenNames.map(k=>[themeVariables[k],t.tokens[k]])),'--studio-accent':studio?.[0]??t.tokens.accent,'--studio-accent-hover':studio?.[1]??t.tokens.accentHover,'--home-base':atmosphere?.[0]??t.tokens.appBackground,'--home-warmth':atmosphere?.[1]??'transparent','--home-balance':atmosphere?.[2]??'transparent','--home-depth':atmosphere?.[3]??'transparent','--home-secondary':studio&&t.id==='Light'?'#424d57':studio&&t.id==='Parchment'?'#4c402e':t.tokens.textSecondary,'--home-muted':studio&&t.id==='Light'?'#48535d':studio&&t.id==='Parchment'?'#51432f':t.tokens.textMuted,'--home-link':studio&&t.id==='Light'?'#005c70':studio&&t.id==='Parchment'?'#004b58':t.tokens.link};
}
export function contrast(a:string,b:string){const luminance=(s:string)=>{const c=[1,3,5].map(i=>parseInt(s.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function contrastWarnings(t:Theme){const pairs:[ThemeToken,ThemeToken,number][]=[['textPrimary','appBackground',4.5],['textPrimary','surface',4.5],['textPrimary','elevatedSurface',4.5],['textPrimary','inputBackground',4.5],['textSecondary','surface',4.5],['textMuted','surface',4.5],['editorText','editorBackground',4.5],['accentText','accent',4.5],['accentText','accentHover',4.5],['selectionText','selection',4.5],['textPrimary','activeSurface',4.5],['textPrimary','hoverSurface',4.5],['link','editorBackground',4.5],['danger','surface',4.5],['danger','errorBackground',4.5],['warning','surface',4.5],['success','surface',4.5],['focus','surface',3],['focus','editorBackground',3],['spellingUnderline','editorBackground',3],['scrollbarThumb','scrollbarTrack',3]];return pairs.filter(([a,b,min])=>contrast(t.tokens[a],t.tokens[b])<min).map(([a,b,min])=>`${tokenLabel(a)} against ${tokenLabel(b)}: ${contrast(t.tokens[a],t.tokens[b]).toFixed(2)}:1 (recommended ${min}:1).`);}
