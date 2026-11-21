import {defaultThemes,resolveTheme,themeStyle,type ThemeSnapshot,type ThemePreferences} from '../shared/themes';
const listeners=new Set<()=>void>();
export function subscribeThemes(listener:()=>void){listeners.add(listener);return ()=>{listeners.delete(listener);};}
let snapshot:ThemeSnapshot={preferences:defaultThemes()},native=false;
export function applyThemeSnapshot(next:ThemeSnapshot){
 snapshot=next;const theme=resolveTheme(next.preferences,matchMedia('(prefers-color-scheme: dark)').matches,next.override),root=document.documentElement;
 root.dataset.theme=next.override??next.preferences.selected;root.dataset.appearance=theme.appearance;root.style.colorScheme=theme.appearance;
 for(const [key,value] of Object.entries(themeStyle(theme)))root.style.setProperty(key,value);
 for(const listener of listeners)listener();
}
/** One renderer subscription; only CSS tokens change, not canonical React/editor state. */
export function startThemeRuntime(){
 try{const state=window.pagehearth.themeSnapshot?.();if(state?.preferences){snapshot=state;native=true;}}catch{/* Browser fixtures/older profiles use canonical defaults. */}
 applyThemeSnapshot(snapshot);
 const stop=window.pagehearth.onThemeState?.(applyThemeSnapshot);const media=matchMedia('(prefers-color-scheme: dark)'),changed=()=>applyThemeSnapshot(snapshot);media.addEventListener('change',changed);
 if(native&&snapshot.legacyMigration&&!new URLSearchParams(location.search).has('detached')){const id=localStorage.getItem('pagehearth-theme')||localStorage.getItem('storyloom-theme')||'System';void window.pagehearth.themes({action:'migrate',id:['Light','Dark','System'].includes(id)?id:'System'}).catch(()=>{});}
 return ()=>{stop?.();media.removeEventListener('change',changed);};
}
export async function selectApplicationTheme(id:string){await window.pagehearth.theme(id);if(!native)applyThemeSnapshot({preferences:{...snapshot.preferences,selected:id}});}
export function currentThemes():ThemePreferences{return snapshot.preferences;}

export function supportsWindowAccent(){return snapshot.capabilities?.windowAccent===true;}
