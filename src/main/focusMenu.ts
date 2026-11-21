import type {MenuItemConstructorOptions} from 'electron';
import type {FocusPreferences} from '../shared/focus.js';
import type {AppCommand} from '../shared/preferences.js';
/** A read-only reflection of renderer workspace preferences, never a second preference owner. */
export function focusMenu(state:FocusPreferences,enabled:boolean,send:(command:AppCommand)=>void):MenuItemConstructorOptions[]{
 return [{label:'Text Focus',submenu:(['off','sentence','paragraph'] as const).map(text=>({id:'text-focus-'+text,label:text[0].toUpperCase()+text.slice(1),type:'radio',checked:state.text===text,enabled,click:()=>send({kind:`text-focus-${text}`})}))},
 {id:'typewriter-toggle',label:'Typewriter Scrolling',type:'checkbox',checked:state.typewriter,enabled,click:()=>send({kind:'typewriter-toggle'})}];
}
