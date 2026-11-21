import type {Project} from './model.js';
import {readScope,scopeDocuments,type ManuscriptScope} from './continuous.js';
import {safePosition,type DraftPosition} from './draft.js';
export type EditorLayout='single'|'side-by-side'|'stacked';
export type PaneDescriptor={id:string;documentId:string;scope:ManuscriptScope|null;view:'pages'|'continuous';navigator:'none'|'pages';locked:boolean;titles:boolean;position:DraftPosition;positions?:Record<string,DraftPosition>};
export type SplitWorkspace={layout:EditorLayout;active:string;ratios:{'side-by-side':number;stacked:number};panes:PaneDescriptor[]};
export const splitRatio=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?Math.max(25,Math.min(75,value)):50;
export function paneDocuments(p:Project,pane:Pick<PaneDescriptor,'documentId'|'scope'>){return pane.scope?scopeDocuments(p,pane.scope):p.documents[pane.documentId]?[pane.documentId]:[];}
export function routePane(p:Project,state:SplitWorkspace,id:string,reuse=false,preferOwner=false):string|null{
 const active=state.panes.find(x=>x.id===state.active)||state.panes[0];
 if(preferOwner&&(state.layout==='single'||!active.locked||paneDocuments(p,active).includes(id)))return active.id;
 if(reuse){const open=[active,...state.panes.filter(x=>x!==active)].find(x=>paneDocuments(p,x).includes(id));if(open)return open.id;}
 if(state.layout==='single'||!active.locked)return active.id;
 return state.panes.find(x=>!x.locked)?.id||null;
}
export function readSplit(p:Project):SplitWorkspace{
 const w=p.manifest.settings.workspace as any,raw=w.splitEditors;
 const layout:EditorLayout=raw&&['side-by-side','stacked'].includes(raw.layout)?raw.layout:'single';
 const fallback=p.manifest.nodes.find(n=>!n.trashed&&p.documents[n.id])?.id||'';
 const values=raw&&Array.isArray(raw.panes)&&raw.panes.length?raw.panes.slice(0,layout==='single'?1:2):[{documentId:w.selected,scope:w.manuscriptScope,view:w.editorView,navigator:w.navigator,titles:w.manuscriptTitles,position:w.positions?.[w.selected],positions:w.positions}];
 const validIds=values.every((v:any)=>v&&['a','b'].includes(v.id))&&new Set(values.map((v:any)=>v.id)).size===values.length;
 const panes:PaneDescriptor[]=values.map((v:any,i:number)=>{v=v&&typeof v==='object'?v:{};const scope=readScope(v.scope,p),ids=scope?scopeDocuments(p,scope):null;const documentId=ids?(ids.includes(v.documentId)?v.documentId:ids[0]||''):p.documents[v.documentId]&&!p.manifest.nodes.find(n=>n.id===v.documentId)?.trashed?v.documentId:fallback;return {id:validIds?v.id:i===0?'a':'b',documentId,scope,view:v.view==='continuous'?'continuous':'pages',navigator:v.navigator==='pages'?'pages':'none',locked:layout!=='single'&&v.locked===true,titles:v.titles!==false,positions:Object.fromEntries(Object.entries(v.positions&&typeof v.positions==='object'?v.positions:{}).filter(([id])=>!!p.documents[id]).map(([id,value])=>[id,safePosition(value as any,Number.MAX_SAFE_INTEGER)])),position:safePosition(v.position,Number.MAX_SAFE_INTEGER)};});
 if(layout!=='single'&&panes.length===1)panes.push({...structuredClone(panes[0]),id:panes[0].id==='a'?'b':'a',locked:false});
 return {layout,active:panes.some(x=>x.id===raw?.active)?raw.active:panes[0].id,ratios:{'side-by-side':splitRatio(raw?.ratios?.['side-by-side']),stacked:splitRatio(raw?.ratios?.stacked)},panes};
}
