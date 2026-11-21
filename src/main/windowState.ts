import type {BrowserWindow} from 'electron';
import type {SettingsStore} from './settings.js';
import type {Bounds,WindowState} from '../shared/preferences.js';
export type {Bounds,WindowState} from '../shared/preferences.js';
export function validWindowState(value:any):value is WindowState{
  return !!value&&typeof value.maximized==='boolean'&&typeof value.fullscreen==='boolean'&&['x','y','width','height'].every(k=>Number.isFinite(value.bounds?.[k]))&&value.bounds.width>0&&value.bounds.height>0;
}
export function windowPlacement(saved:WindowState|undefined,kind:string,areas:Bounds[]){
  const defaults=kind==='main'?{width:1320,height:880,minWidth:850,minHeight:600}:kind==='goals'?{width:620,height:740,minWidth:480,minHeight:420}:kind==='research'?{width:1120,height:780,minWidth:960,minHeight:680}:{width:900,height:700,minWidth:620,minHeight:460};
  const bounds=validWindowState(saved)?saved.bounds:undefined;
  const overlap=(a:Bounds,b:Bounds)=>Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
  const area=bounds?[...areas].sort((a,b)=>overlap(bounds,b)-overlap(bounds,a))[0]:areas[0];
  const minWidth=Math.min(defaults.minWidth,area.width),minHeight=Math.min(defaults.minHeight,area.height);
  const width=Math.min(area.width,Math.max(minWidth,bounds?.width??defaults.width)),height=Math.min(area.height,Math.max(minHeight,bounds?.height??defaults.height));
  return {x:Math.round(Math.max(area.x,Math.min(bounds?.x??area.x+(area.width-width)/2,area.x+area.width-width))),y:Math.round(Math.max(area.y,Math.min(bounds?.y??area.y+(area.height-height)/2,area.y+area.height-height))),width:Math.round(width),height:Math.round(height),minWidth,minHeight};
}
/** Local application preferences only; never dirties a project or its backup. */
export class WindowStates{
  private pending:Record<string,WindowState>={};
  private writing:Promise<void>=Promise.resolve();
  private timer:ReturnType<typeof setTimeout>|undefined;
  constructor(private settings:SettingsStore){}
  bind(window:BrowserWindow,key:string,initial:Bounds,saved?:WindowState){
    let normal={x:initial.x,y:initial.y,width:initial.width,height:initial.height},maximized=saved?.maximized??false,last:string|undefined;
    const capture=()=>{
      if(window.isDestroyed()||window.isMinimized())return;
      const fullscreen=window.isFullScreen();
      if(!fullscreen)maximized=window.isMaximized();
      if(!fullscreen&&!maximized)normal=window.getNormalBounds();
      const state={bounds:{...normal},maximized,fullscreen},signature=JSON.stringify(state);if(signature===last)return;last=signature;
      this.pending[key]=state;
      if(this.timer)clearTimeout(this.timer);
      this.timer=setTimeout(()=>void this.flush().catch(()=>{this.settings.warning='Window placement could not be saved. Other project data is unaffected.'}),250);
    };
    window.on('move',capture);window.on('resize',capture);window.on('maximize',capture);window.on('unmaximize',capture);window.on('enter-full-screen',capture);window.on('leave-full-screen',capture);window.on('close',capture);
    return capture;
  }
  async flush(){
    if(this.timer){clearTimeout(this.timer);this.timer=undefined;}
    const pending=this.pending;this.pending={};if(!Object.keys(pending).length){await this.writing;return;}
    const work=this.settings.update(current=>({windowStates:Object.fromEntries(Object.entries({...current.windowStates,...pending}).slice(-100))})).then(()=>{},error=>{this.pending={...pending,...this.pending};throw error;});
    this.writing=work;await work;
  }
}
