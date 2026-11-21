import {useEffect,useLayoutEffect,useState,type CSSProperties} from 'react';
import {builtinThemes,resolveTheme,themeTokenGroups,themeTokenNames,themeStyle,validThemeColor,contrastWarnings,tokenLabel,type Theme,type ThemePreferences,type ThemeRequest} from '../shared/themes';
import {currentThemes,supportsWindowAccent} from './themeRuntime';
import {WindowTitleBarSetting} from './WindowTitleBarSetting';
export function ThemeSettings({onDirty}:{onDirty:(dirty:boolean)=>void}){
 const [preferences,setPreferences]=useState<ThemePreferences>(currentThemes),[draft,setDraft]=useState<Theme|null>(null),[original,setOriginal]=useState<Theme|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[discard,setDiscard]=useState(false);
 const selected=resolveTheme(preferences,typeof matchMedia==='function'&&matchMedia('(prefers-color-scheme: dark)').matches),dirty=!!draft&&JSON.stringify(draft)!==JSON.stringify(original);
 useLayoutEffect(()=>{onDirty(dirty);return()=>onDirty(false);},[dirty,onDirty]);
 useEffect(()=>{let live=true;void window.pagehearth.themes?.({action:'list'}).then(p=>{if(live&&p)setPreferences(p);}).catch(e=>setError(String(e)));const stop=window.pagehearth.onThemeState?.(s=>setPreferences(s.preferences));return()=>{live=false;stop?.();};},[]);
 async function act(request:ThemeRequest){setBusy(true);setError('');try{const p=await window.pagehearth.themes(request);setPreferences(p);return p;}catch(e){setError(String(e).replace(/^Error: /,''));return null;}finally{setBusy(false);}}
 const closeEdit=()=>{setDraft(null);setOriginal(null);setDiscard(false);};
 const begin=(t:Theme)=>{setOriginal(structuredClone(t));setDraft(structuredClone(t));setError('');};
 const change=(token:typeof themeTokenNames[number],value:string)=>setDraft(d=>d?{...d,tokens:{...d.tokens,[token]:value}}:d);
 const base=draft?builtinThemes.find(t=>t.appearance===draft.appearance)!:selected;
 const preview=draft?{...draft,tokens:Object.fromEntries(themeTokenNames.map(k=>[k,validThemeColor(k,draft.tokens[k])?draft.tokens[k]:base.tokens[k]])) as Theme['tokens']}:selected;
 const invalid=draft?themeTokenNames.filter(k=>!validThemeColor(k,draft.tokens[k])):[];
 const warnings=contrastWarnings(preview);
 return <section className="theme-settings theme-safe" style={themeStyle(builtinThemes[0]) as CSSProperties} aria-label="Appearance">
 <h3>Appearance</h3><p>Global application colors. Manuscript formatting and book output remain separate.</p>
 {!draft?<><label>Theme<select aria-label="Application theme" value={preferences.selected} disabled={busy} onChange={e=>void act({action:'select',id:e.target.value})}><option value="System">System (follow Windows)</option>{[...builtinThemes,...preferences.custom].map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
 <div className="theme-actions"><button disabled={busy} onClick={()=>void act({action:'duplicate',id:selected.id}).then(p=>{if(p)begin(p.custom.find(t=>t.id===p.selected)!);})}>Duplicate…</button><button disabled={busy||!preferences.custom.some(t=>t.id===selected.id)} onClick={()=>begin(selected)}>Customize / Rename…</button><button disabled={busy} onClick={()=>void act({action:'import'})}>Import…</button><button disabled={busy||!preferences.custom.some(t=>t.id===selected.id)} onClick={()=>void act({action:'export',id:selected.id})}>Export…</button><button disabled={busy||!preferences.custom.some(t=>t.id===selected.id)} onClick={()=>void act({action:'delete',id:selected.id})}>Delete custom theme…</button><button disabled={busy} onClick={()=>void act({action:'select',id:'System'})}>Use default theme</button></div>
 <WindowTitleBarSetting value={selected.windowTitleBar} supported={supportsWindowAccent()} readOnly onChange={()=>{}}/><p className="muted">Built-in themes are read-only. Duplicate one to customize it. Imported themes are always new copies.</p></>:<div className="theme-editor" aria-label="Theme Editor">
 <h4>Edit custom theme</h4><p>Changes preview only in the sample below. Save applies them to all windows. Cancel leaves the saved theme unchanged.</p>
 <label>Theme name<input aria-label="Theme name" maxLength={80} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
 <label>Base appearance<select value={draft.appearance} onChange={e=>setDraft({...draft,appearance:e.target.value as 'light'|'dark'})}><option value="light">Light</option><option value="dark">Dark</option></select></label>
 <WindowTitleBarSetting value={draft.windowTitleBar} supported={supportsWindowAccent()} onChange={value=>setDraft({...draft,windowTitleBar:value})}/>
 <div className="theme-preview" aria-label="Theme preview" style={themeStyle(preview) as CSSProperties}><strong>PageHearth preview</strong><p>Readable text and <a href="#" onClick={e=>e.preventDefault()}>a reference link</a>.</p><div className="theme-preview-editor">The compass pointed toward Vaelthorne. <span className="theme-preview-spelling">recieve</span><span className="theme-preview-selected"> Selected text </span></div><button className="primary" type="button">Primary action</button><span className="theme-preview-focus" tabIndex={0}>Keyboard focus</span><p className="theme-preview-warning">Warning example</p></div>
 {warnings.length>0&&<details className="theme-contrast" open><summary>Low contrast — {warnings.length} combinations</summary><p>These colors may be difficult to read. Your choices are preserved; consider adjusting the pairs below.</p><ul>{warnings.map(w=><li key={w}>{w}</li>)}</ul></details>}
 {Object.entries(themeTokenGroups).map(([group,tokens])=><details key={group} className="theme-token-group" open={group==='General'}><summary>{group}</summary>{tokens.map(token=><div className="theme-color" key={token}><label htmlFor={'theme-'+token}>{tokenLabel(token)}</label><input type="color" aria-label={tokenLabel(token)+' color picker'} value={preview.tokens[token].slice(0,7)} onChange={e=>change(token,e.target.value+(draft.tokens[token].length===9&&validThemeColor(token,draft.tokens[token])?draft.tokens[token].slice(7):''))}/><input id={'theme-'+token} aria-invalid={!validThemeColor(token,draft.tokens[token])} spellCheck={false} maxLength={9} value={draft.tokens[token]} onChange={e=>change(token,e.target.value)} /></div>)}</details>)}
 <p className="muted">Colors use #RRGGBB. Focus wash, backdrop and shadow also accept #RRGGBBAA transparency.</p>
 {invalid.length>0&&<p role="alert">Invalid colors: {invalid.map(tokenLabel).join(', ')}. Enter a valid hex color.</p>}
 <div className="theme-actions"><button className="primary" disabled={busy||!draft.name.trim()||!!invalid.length} onClick={()=>void act({action:'save',theme:draft,expected:original!}).then(p=>{if(p)closeEdit();})}>Save theme</button><button disabled={busy} onClick={()=>{if(dirty)setDiscard(true);else closeEdit();}}>Cancel</button><button disabled={busy} onClick={()=>setDraft({...draft,tokens:{...base.tokens}})}>Reset colors to base</button></div>
 {discard&&<div role="alert"><p>Discard unsaved theme changes?</p><button onClick={()=>setDiscard(false)}>Keep editing</button><button onClick={closeEdit}>Discard changes</button></div>}
 </div>}
 {error&&<p role="alert">{error}</p>}
 </section>;
}
