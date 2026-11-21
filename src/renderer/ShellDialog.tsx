import {LicenseInformation} from './LicenseInformation';
import {SupportDevelopment} from './SupportDevelopment';
import {containDialogTab} from './ModalCard';
import brandMark from '../../assets/branding/pagehearth/PageHearth_App_Icon.png';
import './globalPolish.css';
import {UpdateSettings} from './Updates';
import {builtinThemes,themeStyle} from '../shared/themes';
import type {CSSProperties,ReactNode} from 'react';
import {ThemeSettings} from './ThemeSettings';
import {useEffect,useRef,useState} from 'react';
import {StatusZoom} from './AppShell';

/** One main-owned dialog; application preferences and explicitly scoped existing project actions. */
export default function ShellDialog({kind,zoom,onZoom,onShortcuts,onClose,projectSettings}:{kind:'settings'|'about';projectSettings?:ReactNode;zoom:number;onZoom:(value:number)=>void;onShortcuts:()=>void;onClose:()=>void}){
 const [themeDirty,setThemeDirty]=useState(false),[pendingClose,setPendingClose]=useState<(()=>void)|null>(null);
 const close=(action=onClose)=>{if(themeDirty)setPendingClose(()=>action);else action();};
 const dialog=useRef<HTMLDialogElement>(null),[info,setInfo]=useState<{name:string;version:string}>(),[error,setError]=useState('');
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>{dialog.current?.close();if(previous?.isConnected)previous.focus();};},[]);
 useEffect(()=>{let active=true;if(kind==='about')void window.pagehearth.appInfo().then(value=>{if(active)setInfo(value);}).catch(e=>{if(active)setError(String(e));});return()=>{active=false;};},[kind]);
 return <dialog onKeyDown={containDialogTab} ref={dialog} className="shell-dialog" aria-labelledby="shell-dialog-title" onCancel={e=>{e.preventDefault();close();}}>
  <header><h2 id="shell-dialog-title">{kind==='settings'?'Settings':'About PageHearth'}</h2><button autoFocus title="Close" aria-label="Close" onClick={()=>close()}>×</button></header>
  <div className="shell-dialog-body">{kind==='settings'?<><p className="settings-intro">Preferences for this computer. Shared across projects. Changes apply immediately unless a Save button is shown.</p><ThemeSettings onDirty={setThemeDirty}/><section className="settings-group" aria-label="Application"><h3>Application</h3><UpdateSettings onCheck={()=>close(()=>{onClose();setTimeout(()=>window.dispatchEvent(new Event('pagehearth-show-updates')),0);})}/><div className="settings-zoom">Application zoom<StatusZoom zoom={zoom} onChange={onZoom}/></div><p><button onClick={()=>close(onShortcuts)}>Keyboard Shortcuts…</button></p></section><section className="settings-group" aria-label="Writing"><h3>Writing</h3><p>Use the WRITE toolbar to choose font, size and alignment for selected text. These controls format manuscript content; Book Style in PUBLISH controls publication typography.</p></section><section className="settings-group" aria-label="Projects and storage"><h3>Projects and storage</h3><p>New Project creates a project folder inside the location you choose. The next creation dialog remembers that location. Choosing another location does not move existing projects.</p>{projectSettings||<p>Open a project to manage its backup folder, daily backups and recovery tools.</p>}</section></>:<><div className="about-identity"><img src={brandMark} alt=""/><div><h3>PageHearth</h3><p role="status">{info?`Version ${info.version}`:'Loading version…'}</p></div></div><p>A local-first writing and publishing studio for authors.</p><p>Your writing stays in your projects on your computer. No account or AI service is required.</p><SupportDevelopment/><LicenseInformation/><UpdateSettings compact onCheck={()=>close(()=>{onClose();setTimeout(()=>window.dispatchEvent(new Event('pagehearth-show-updates')),0);})}/>{error&&<div role="alert"><p>Version information could not be loaded. Close and reopen About to retry.</p><details><summary>Technical details</summary><pre>{error}</pre></details></div>}</>}
 {pendingClose&&<div role="alert" className="theme-safe" style={themeStyle(builtinThemes[0]) as CSSProperties}><p>Discard unsaved theme changes and close?</p><button onClick={()=>setPendingClose(null)}>Keep editing</button><button onClick={()=>pendingClose()}>Discard and close</button></div>}
 </div></dialog>;
}
