export type DraftPosition = { scrollTop: number; anchor: number; head: number };
export type DraftWorkspace = { splitEditors?:import('./split.js').SplitWorkspace; manuscriptScope?:import('./continuous.js').ManuscriptScope|null; manuscriptTitles?:boolean; editorView?: 'pages'|'continuous'; selected?: string; navigator?: 'none' | 'pages'; positions?: Record<string, DraftPosition>; treeVisible?:boolean; inspectorVisible?:boolean; treeWidth?:number; inspectorWidth?:number; writeView?:'editor'|'corkboard'|'outliner'|'notebook'; collapsed?:string[]; inspectorSections?:Record<string,boolean>; corkboard?:Record<string,unknown>; outliner?:Record<string,unknown> };
export function safePosition(value: Partial<DraftPosition> | undefined, size: number): DraftPosition {
  const position = (n: unknown) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0,Math.min(size,Math.round(n))) : 0;
  return {scrollTop: typeof value?.scrollTop === 'number' && Number.isFinite(value.scrollTop) ? Math.max(0,value.scrollTop) : 0,anchor:position(value?.anchor),head:position(value?.head)};
}
// Boundaries describe rendered geometry only. They never enter ProseMirror's schema.
export function draftBoundaries(height: number, width: number, lineStarts: number[]): number[] {
  const pageHeight = Math.max(300, width * 1.42);
  const starts = [...new Set(lineStarts.filter(y=>Number.isFinite(y) && y>=0 && y<height).map(y=>Math.round(y)))].sort((a,b)=>a-b);
  const pages=[0];
  for(let target=pageHeight;target<height;){
    const line=starts.find(y=>y>=target);
    const boundary=line ?? target;
    if(boundary>=height-1)break;
    pages.push(boundary);target=boundary+pageHeight;
  }
  return pages;
}
export function activeDraftPage(boundaries: number[], top: number) {
  let page=0;for(let i=1;i<boundaries.length;i++){if(boundaries[i]>top+2)break;page=i;}return page;
}

export function resolveEditorView(saved:unknown):'pages'|'continuous'{return saved==='continuous'?'continuous':'pages';}
