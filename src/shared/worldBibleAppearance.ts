import type {Project} from './model.js';
import {builtinThemes,resolveTheme,type ThemePreferences} from './themes.js';

/** Project-local references only. Absence means inherit; palettes stay global. */
export type WorldBibleAppearance={defaultTheme?:string;categories?:Record<string,string>};
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const validId=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z][A-Za-z0-9._-]{0,63}$/.test(v);
export function appearanceReferences(raw:unknown):WorldBibleAppearance{
 if(!record(raw))return {};
 const categories=record(raw.categories)?Object.fromEntries(Object.entries(raw.categories).filter(([key,value])=>key!=='__proto__'&&key!=='constructor'&&validId(value))):{};
 return {...(validId(raw.defaultTheme)?{defaultTheme:raw.defaultTheme}:{}),categories:categories as Record<string,string>};
}
export function availableThemeId(id:unknown,p:ThemePreferences):string|undefined{
 return validId(id)&&[...builtinThemes,...p.custom].some(t=>t.id===id)?id:undefined;
}
export function resolveWorldBibleTheme(raw:unknown,category:string|undefined,p:ThemePreferences,darkSystem=false){
 const a=appearanceReferences(raw),id=(category?availableThemeId(a.categories?.[category],p):undefined)??availableThemeId(a.defaultTheme,p);
 return resolveTheme(p,darkSystem,id);
}
export function setWorldBibleTheme(project:Project,category:string|undefined,id:string|undefined,prefs:ThemePreferences):Project{
 if(id!==undefined&&!availableThemeId(id,prefs))throw Error('Choose an available theme.');
 const world=project.author.worldBible;if(!world)throw Error('World Bible is unavailable.');
 const validCategories=new Set([...world.enabledCategories,...(world.customCategories||[]).map(c=>c.id)]);
 if(category!==undefined&&!validCategories.has(category))throw Error('Category is unavailable.');
 const next=structuredClone(project),a=appearanceReferences(world.appearance);
 // Clean missing definitions only during an explicit appearance edit, never on load.
 a.defaultTheme=availableThemeId(a.defaultTheme,prefs);
 a.categories=Object.fromEntries(Object.entries(a.categories||{}).filter(([key,value])=>validCategories.has(key)&&availableThemeId(value,prefs)));
 if(category===undefined){if(id)a.defaultTheme=id;else delete a.defaultTheme;}
 else if(id)a.categories[category]=id;else delete a.categories[category];
 if(a.defaultTheme===undefined)delete a.defaultTheme;
 next.author.worldBible!.appearance=a;return next;
}
