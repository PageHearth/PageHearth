import type {Theme} from '../shared/themes.js';
/** Native accent coloring is a platform capability, not a portable custom frame. */
export const windowChromeCapabilities=(platform:string)=>({windowAccent:platform==='win32'});
export function windowAccent(theme:Theme,platform:string):string|null|undefined{
 if(!windowChromeCapabilities(platform).windowAccent)return undefined;
 const setting=theme.windowTitleBar;
 return setting?.mode==='theme'?theme.tokens.accent:setting?.mode==='custom'?setting.color:null;
}
export function applyWindowChrome(target:{setAccentColor:(value:string|null)=>void},theme:Theme,platform:string){
 const accent=windowAccent(theme,platform);if(accent!==undefined)target.setAccentColor(accent);
}
