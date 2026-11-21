import {useEffect,useState,type CSSProperties,type ReactNode} from 'react';
import type {Project} from '../shared/model';
import {builtinThemes,themeStyle} from '../shared/themes';
import {appearanceReferences,availableThemeId,resolveWorldBibleTheme,setWorldBibleTheme} from '../shared/worldBibleAppearance';
import {currentThemes,subscribeThemes} from './themeRuntime';

function useThemes(){const [,refresh]=useState(0);useEffect(()=>subscribeThemes(()=>refresh(n=>n+1)),[]);return currentThemes();}
/** A local token boundary, shared by docked and detached WorldBible. Never keyed by theme. */
export function WorldBibleThemeScope({project,category,children}:{project:Project;category?:string;children:ReactNode}){
 const preferences=useThemes(),theme=resolveWorldBibleTheme(project.author.worldBible?.appearance,category,preferences,matchMedia('(prefers-color-scheme: dark)').matches);
 return <div className="world-theme-scope" data-world-theme={theme.id} data-appearance={theme.appearance} style={{...themeStyle(theme),colorScheme:theme.appearance} as CSSProperties}>{children}</div>;
}
export function WorldBibleAppearanceSettings({project,onChange}:{project:Project;onChange:(p:Project)=>void}){
 const preferences=useThemes(),world=project.author.worldBible!,a=appearanceReferences(world.appearance),choices=[...builtinThemes,...preferences.custom];
 const categories=[['character','Characters'],['location','Locations'],['bestiary','Bestiary'],['faction','Factions'],['lore','Lore'],['glossary','Glossary'],['system','Systems / Magic'],...(world.customCategories||[]).map(c=>[c.id,c.name])];
 const selector=(category:string|undefined,label:string,value:string|undefined)=><label key={category||'default'}>{label}<select aria-label={label+' theme'} value={availableThemeId(value,preferences)||''} onChange={e=>onChange(setWorldBibleTheme(project,category,e.target.value||undefined,preferences))}><option value="">{category?'Follow World Bible':'Follow PageHearth'}</option>{choices.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>;
 return <details className="world-appearance-settings"><summary>Appearance</summary><p>These choices apply only to this project's World Bible. Missing themes follow the parent choice.</p>{selector(undefined,'World Bible',a.defaultTheme)}{categories.map(([id,label])=>selector(id,label,a.categories?.[id]))}</details>;
}
