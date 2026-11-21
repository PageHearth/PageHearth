import type {ThemePreferences} from './themes.js';
import type {AppCommand} from './preferences.js';
export type ThemeChoice={id:string;label:string;checked:boolean;command:AppCommand};
/** Selection-only projection of canonical preferences; no independent registry. */
export function themeChoices(p:ThemePreferences){
 const choice=(id:string,label:string):ThemeChoice=>({id,label,checked:p.selected===id,command:{kind:'set-theme',theme:id}});
 return {builtins:['Light','Dark','Parchment','System'].map(id=>choice(id,id)),custom:p.custom.map(t=>choice(t.id,t.name)),customize:{label:'Customize Themes…',command:{kind:'settings'} as AppCommand}};
}
