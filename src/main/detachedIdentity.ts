export type DetachedSurface='inspector'|'corkboard'|'outliner'|'notebook'|'character'|'research'|'collections'|'timeline'|'goals';

export function detachedWindowKey(surface:DetachedSurface,projectId:string,contextId:string,entityType?:string){
  return surface==='character'?`world:${projectId}:${entityType||'entity'}:${contextId}`:surface==='research'?`research:${projectId}`:surface;
}
