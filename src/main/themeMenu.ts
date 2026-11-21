import type {MenuItemConstructorOptions} from 'electron';
import {themeChoices,type ThemeChoice} from '../shared/themeChoices.js';
import type {ThemePreferences} from '../shared/themes.js';
import type {AppCommand} from '../shared/preferences.js';
export function themeMenu(p:ThemePreferences,command:(value:AppCommand)=>void):MenuItemConstructorOptions[]{
 const model=themeChoices(p),item=(c:ThemeChoice):MenuItemConstructorOptions=>({id:'theme-'+c.id.toLowerCase(),label:c.label.replaceAll('&','&&'),type:'checkbox',checked:c.checked,click:()=>command(c.command)});
 return [...model.builtins.map(item),...(model.custom.length?[{label:'Custom',submenu:model.custom.map(item)}]:[]),{type:'separator'},{label:model.customize.label,click:()=>command(model.customize.command)}];
}
