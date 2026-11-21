import type {ThemeId} from '../shared/preferences.js';

export type ThemeSurface='inspector'|'corkboard'|'outliner'|'notebook'|'character'|'research'|'collections'|'timeline'|'goals';
export type ThemeTarget={surface:ThemeSurface;send:(channel:string,theme:ThemeId)=>unknown};

export class DetachedTheme{
  current:ThemeId='System';
  private overrides=new Map<ThemeSurface,ThemeId>();
  override(surface:ThemeSurface){return this.overrides.get(surface);}
  resolve(surface:ThemeSurface){return this.overrides.get(surface)??this.current;}
  set(theme:ThemeId,targets:Iterable<ThemeTarget>){
    if(typeof theme!=='string'||!/^[A-Za-z][A-Za-z0-9._-]{0,63}$/.test(theme))throw Error('Unknown theme.');
    this.current=theme;
    for(const target of targets)if(!this.overrides.has(target.surface))target.send('theme-changed',theme);
    return theme;
  }
  /** Reserved transport seam for future per-window themes; no current UI calls it. */
  setOverride(surface:ThemeSurface,theme:ThemeId|undefined,target?:ThemeTarget){
    if(theme!==undefined&&(typeof theme!=='string'||!/^[A-Za-z][A-Za-z0-9._-]{0,63}$/.test(theme)))throw Error('Unknown theme override.');
    if(theme===undefined)this.overrides.delete(surface);else this.overrides.set(surface,theme);
    const resolved=this.resolve(surface);if(target)target.send('theme-changed',resolved);return resolved;
  }
}
