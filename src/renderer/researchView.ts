export const RESEARCH_ZOOM_MIN=25;
export const RESEARCH_ZOOM_MAX=400;
export const RESEARCH_ZOOM_STEP=5;
export const DEFAULT_RESEARCH_PANES={organizerWidth:190,libraryWidth:320};
export type ResearchPaneWidths=typeof DEFAULT_RESEARCH_PANES;

export function clampResearchZoom(value:number){
  return Math.max(RESEARCH_ZOOM_MIN,Math.min(RESEARCH_ZOOM_MAX,Math.round(value)));
}

export function stepResearchZoom(value:number,direction:-1|1){
  return clampResearchZoom(value+direction*RESEARCH_ZOOM_STEP);
}

export function parseResearchZoom(value:string,current:number){
  const normalized=value.trim().replace(/%$/u,'').trim();
  if(!/^\d+(?:\.\d+)?$/u.test(normalized))return current;
  return clampResearchZoom(Number(normalized));
}

export function pdfPreviewUrl(src:string,page:number,zoom:number,fit:'width'|'page'|'manual'){
  const target=fit==='width'?'page-width':fit==='page'?'page-fit':clampResearchZoom(zoom);
  return `${src}#page=${Math.max(1,Math.floor(page))}&zoom=${target}`;
}

export function clampResearchPaneWidths(value:ResearchPaneWidths,available:number):ResearchPaneWidths{
  const organizerWidth=Math.max(140,Math.min(420,Math.round(value.organizerWidth))),libraryWidth=Math.max(220,Math.min(620,Math.round(value.libraryWidth))),room=Math.max(360,Math.floor(available)-312);
  if(organizerWidth+libraryWidth<=room)return {organizerWidth,libraryWidth};
  const reducedLibrary=Math.max(220,room-organizerWidth);
  if(organizerWidth+reducedLibrary<=room)return {organizerWidth,libraryWidth:reducedLibrary};
  return {organizerWidth:Math.max(140,room-220),libraryWidth:220};
}

export function resizeResearchPane(value:ResearchPaneWidths,pane:'organizer'|'library',delta:number,available:number){
  return clampResearchPaneWidths({...value,[pane==='organizer'?'organizerWidth':'libraryWidth']:value[pane==='organizer'?'organizerWidth':'libraryWidth']+delta},available);
}
