import type {MenuItemConstructorOptions} from 'electron';
import {commandBinding,commandDescriptor,type Keybindings} from '../shared/commands.js';
import type {AppCommand} from '../shared/preferences.js';
/** Main owns project availability; renderer rechecks live mutation/composition/error state on dispatch. */
export function saveMenu(projectOpen:boolean,bindings:Keybindings,send:(command:AppCommand)=>void):MenuItemConstructorOptions {
 const descriptor=commandDescriptor('save')!;
 return {id:descriptor.id,label:descriptor.menuLabel||descriptor.label,accelerator:commandBinding(descriptor.id,bindings)||undefined,
  enabled:descriptor.context==='any'||projectOpen,click:()=>send({kind:'save'})};
}
