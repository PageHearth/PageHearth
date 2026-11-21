export type Bounds={x:number;y:number;width:number;height:number};
export type WindowState={bounds:Bounds;maximized:boolean;fullscreen:boolean};
export type RecentProject = { title: string; path: string; lastOpened: string };
export type AppSettings = { updates?:{automatic:boolean;lastCheck?:number}; lastExportDirectory?:string; lastRestoreDirectory?:string; exportPreferences?:Partial<import('./exportPublication.js').ExportOptions>; version: 1; themes?:import('./themes.js').ThemePreferences; recentCommands?:import('./commands.js').CommandId[]; zoomPercent: number; favoriteFonts?:string[]; recentFonts?:string[]; keybindings?:import('./commands.js').Keybindings; lastCreateDirectory?: string; lastOpenDirectory?: string; lastTemplateExportDirectory?:string;lastTemplateImportDirectory?:string;lastManuscriptImportDirectory?:string;lastTemplateCreator?:string;recentProjects: RecentProject[]; researchKeepOnTop?:Record<string,boolean>;windowStates?:Record<string,WindowState> };
export type AppState = { settings: AppSettings; warning?: string };
export type AppCommand = {kind:'settings'|'about';returnFocusWindowId?:number} | {kind:'project-dictionary'} | {kind:'command-palette'} | {kind:'comment';anchorKind?:'range'|'caret';action:'add'|'navigate'|'selection'|'caret';id?:string;token?:string} | {kind:'create-scene';token?:string} |  {kind:'document-history';id:string;take:boolean} | { kind: 'insert-image' | 'paste-image' | 'image-properties' | 'import-report' | 'open-project' | 'new-project' | 'save-template' | 'manage-templates' | 'statistics' | 'writing-goals' | 'text-focus-off' | 'text-focus-sentence' | 'text-focus-paragraph' | 'typewriter-toggle' | 'focus-mode' | 'align-left' | 'align-center' | 'align-right' | 'editor-single' | 'editor-side-by-side' | 'editor-stacked' | 'editor-focus-other' | 'editor-lock' | 'editor-unlock' | 'editor-close-pane' | 'continuous-selection' | 'continuous-all' | 'single-document' | 'continuous-titles' | 'take-snapshot' | 'browse-history' | 'search-project' | 'home' | 'quit' | 'rebuild' | 'backup-now' | 'verify-backup' | 'restore-backup' | 'open-folder' | 'undo' | 'redo' | 'add-reference' | 'quicknotes' | 'notebook' | 'save' | 'shortcuts' | 'enter-editor' | 'indent' | 'outdent' } | {kind:'editor-view';view:'pages'|'continuous'} | {kind:'remove-reference';token:string} | {kind:'set-theme';theme:AppTheme} | { kind: 'recent' | 'open-file'; path: string } | {kind:'backup';projectId:string};
export type ZoomAction = 'in' | 'out' | 'reset';
export type AppTheme = string;
/** Stable theme identifier transported between windows; future theme packs may add IDs. */
export type ThemeId = string;
export function zoomStep(current: number, action: ZoomAction) {
  return action === 'reset' ? 100 : Math.max(50, Math.min(200, current + (action === 'in' ? 5 : -5)));
}
export function normalizeZoomPercent(value:number){
  if(!Number.isFinite(value))throw Error('Zoom percentage must be a number.');
  return Math.max(50,Math.min(200,Math.round(value)));
}
export function zoomShortcut(input: { type: string; control: boolean; alt: boolean; meta: boolean; key: string; code?: string }): ZoomAction | undefined {
  if (input.type !== 'keyDown' || !input.control || input.alt || input.meta) return;
  if (['=', '+'].includes(input.key) || ['Equal', 'NumpadAdd'].includes(input.code ?? '')) return 'in';
  if (input.key === '-' || ['Minus', 'NumpadSubtract'].includes(input.code ?? '')) return 'out';
  if (input.key === '0' || ['Digit0', 'Numpad0'].includes(input.code ?? '')) return 'reset';
}
