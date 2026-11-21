export type WorkspaceId='editor'|'corkboard'|'outliner'|'notebook'|'world-bible'|'research'|'collections'|'timeline';
export type WorkspaceDescriptor={id:WorkspaceId;label:string;shortcut?:string;contextual:boolean};
export const workspaceRegistry:WorkspaceDescriptor[]=[
  {id:'editor',label:'Editor',contextual:true},
  {id:'corkboard',label:'Corkboard',contextual:true},
  {id:'outliner',label:'Outliner',contextual:false},
  {id:'timeline',label:'Timeline',contextual:false},
  {id:'notebook',label:'Notebook',contextual:false},
  {id:'world-bible',label:'World Bible',contextual:false},
  {id:'research',label:'Research',contextual:false},
  {id:'collections',label:'Collections',contextual:false},
];
// Future canonical subsystems may register recognized columns here after their
// shared data model exists. The Outliner never invents shadow entity fields.
export const outlinerColumnRegistry=[
  {id:'summary',label:'Summary',group:'Writing'},
  {id:'status',label:'Status',group:'Tracking'},
  {id:'words',label:'Words',group:'Writing'},
  {id:'tags',label:'Tags',group:'Tracking'},
  {id:'inspectorNote',label:'Inspector Note',group:'Writing'},
] as const;
export type BuiltInOutlinerColumnId=typeof outlinerColumnRegistry[number]['id'];
export function normalizeColumnOrder(defaults:string[],saved:unknown){const allowed=new Set(defaults),result=Array.isArray(saved)?saved.filter((id):id is string=>typeof id==='string'&&allowed.has(id)):[];return [...new Set([...result,...defaults])];}
export function visibleColumnOrder(defaults:string[],saved:unknown,selected:string[]){const chosen=new Set(selected);return normalizeColumnOrder(defaults,saved).filter(id=>chosen.has(id));}
export function moveVisibleColumn(order:string[],visible:string[],id:string,direction:-1|1){const at=visible.indexOf(id),target=visible[at+direction];if(at<0||!target)return order;const next=[...order],from=next.indexOf(id),to=next.indexOf(target);if(from<0||to<0)return order;[next[from],next[to]]=[next[to],next[from]];return next;}
export function workspace(id:string){const found=workspaceRegistry.find(w=>w.id===id);if(!found)throw Error('Unknown workspace.');return found;}
export function detachedErrorMessage(error:unknown){const message=String(error);if(/outdated|older project revision|too old|conflicts with newer|revision/i.test(message))return 'This detached workspace conflicts with a newer saved project revision. Its unsaved Author Workspace state remains protected. Retry only after reviewing the conflict, or save a recovery copy and refresh this window; PageHearth will not overwrite newer data.';return message;}
