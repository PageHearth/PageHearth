/** Application commands only. Editor-owned shortcuts keep their existing handlers. */
const existingCommands = [
  ...([['new-project','New Project'],['save-template','Save as Project Template'],['manage-templates','Manage Templates']] as const).map(([id,label])=>({id,label,shortcut:'',configurable:false,group:'Project'})),
  ...([['text-focus-off','Text Focus: Off'],['text-focus-sentence','Text Focus: Sentence'],['text-focus-paragraph','Text Focus: Paragraph'],['typewriter-toggle','Toggle Typewriter Scrolling']] as const).map(([id,label])=>({id,label,shortcut:'',configurable:false,group:'Focus'})),
  {id:'focus-mode',label:'Focus Mode',shortcut:'F8',configurable:false,group:'View'},
  ...([['align-left','Align Left'],['align-center','Align Center'],['align-right','Align Right']] as const).map(([id,label])=>({id,label,shortcut:'',configurable:false,group:'Format'})),
  ...([['editor-single','Use Single Editor'],['editor-side-by-side','Split Editor Side by Side'],['editor-stacked','Split Editor Stacked'],['editor-focus-other','Focus Other Editor Pane'],['editor-lock','Lock Active Editor Pane'],['editor-unlock','Unlock Active Editor Pane'],['editor-close-pane','Close Active Editor Pane']] as const).map(([id,label])=>({id,label,shortcut:'',configurable:false,group:'Editor Layout'})),
  {id:'continuous-selection',label:'Open Selection as Continuous Manuscript',shortcut:'',configurable:false,group:'Manuscript'},
  {id:'continuous-all',label:'Open Entire Manuscript Continuously',shortcut:'',configurable:false,group:'Manuscript'},
  {id:'single-document',label:'Return to Single Document',shortcut:'',configurable:false,group:'Manuscript'},
  {id:'take-snapshot',label:'Take Snapshot',shortcut:'',configurable:false,group:'History'},
  {id:'browse-history',label:'Browse History',shortcut:'',configurable:false,group:'History'},
  {id:'search-project',label:'Search Project',shortcut:'Ctrl+Shift+F',configurable:false,group:'Navigation'},
  {id:'quicknotes',label:'QuickNotes',shortcut:'Ctrl+Shift+M',configurable:true,group:'Capture'},
  {id:'notebook',label:'Open Notebook',shortcut:'Ctrl+Alt+N',configurable:true,group:'Navigation'},
  {id:'save',label:'Save Project',menuLabel:'Save',shortcut:'Ctrl+S',configurable:false,group:'General'},
  {id:'zoom-in',label:'Zoom In',shortcut:'Ctrl+=',configurable:false,group:'Zoom'},
  {id:'zoom-out',label:'Zoom Out',shortcut:'Ctrl+-',configurable:false,group:'Zoom'},
  {id:'zoom-reset',label:'Reset Zoom to 100%',shortcut:'Ctrl+0',configurable:false,group:'Zoom'},
] as const;
const extraCommands=[
 ['insert-image','Insert Image…','Manuscript','manuscript'],['paste-image','Paste Image','Manuscript','manuscript'],['image-properties','Image properties…','Manuscript','manuscript'],
 ['settings','Settings','Tools','any'],['about','About PageHearth','Help','any'],
 ['corkboard-new','New Planning Card','Planning','project'],['corkboard-clear','Clear Corkboard…','Planning','project'],['notebook-new','New Notebook Note','Planning','project'],['notebook-undo','Undo Notebook Edit','Edit','project'],['notebook-redo','Redo Notebook Edit','Edit','project'],['outliner-undo','Undo Outliner Structural Move','Planning','project'],['outliner-redo','Redo Outliner Structural Move','Planning','project'],['timeline-new','Create Timeline Event','Planning','project'],['collection-new','Create Collection','Planning','project'],
 ['command-palette','Command Palette','Tools','any'],['open-project','Open Project','Project','any'],['home','Close Project','Project','project'],['undo','Undo Manuscript Edit','Edit','manuscript'],['redo','Redo Manuscript Edit','Edit','manuscript'],
 ['enter-editor','Enter Editor','Manuscript','project'],['create-scene','Create Scene from Selection','Manuscript','selection'],['continuous-titles','Toggle Document Titles','View','manuscript'],['indent','First-line Indent','Format','manuscript'],['outdent','First-line Outdent','Format','manuscript'],
 ['bold','Bold','Format','manuscript'],['italic','Italic','Format','manuscript'],['underline','Underline','Format','manuscript'],['heading','Toggle Heading','Format','manuscript'],['list','Toggle Bullet List','Format','manuscript'],
 ['view-pages','Page View','View','manuscript'],['view-continuous','Continuous View','View','manuscript'],['tree-toggle','Toggle Story Tree','View','project'],['inspector-toggle','Toggle Inspector','View','project'],['draft-pages','Toggle Draft Pages','View','manuscript'],
 ['theme-light','Use Light Theme','View','any'],['theme-dark','Use Dark Theme','View','any'],['theme-parchment','Use Parchment Theme','View','any'],['theme-system','Use System Theme','View','any'],['rebuild','Rebuild Project Index','Tools','project'],['shortcuts','Keyboard Shortcuts','Tools','any'],['backup-now','Back Up Now','Tools','project'],['verify-backup','Verify Backup','Tools','any'],['restore-backup','Restore Backup from ZIP…','Tools','any'],
 ['revision-off','Revision Off','Revision','manuscript'],['revision-1','Use Revision 1','Revision','manuscript'],['revision-2','Use Revision 2','Revision','manuscript'],['revision-3','Use Revision 3','Revision','manuscript'],['revision-4','Use Revision 4','Revision','manuscript'],['revision-5','Use Revision 5','Revision','manuscript'],
 ['revision-visible','Toggle Revision Marks','Revision','manuscript'],['revision-mark','Mark Selection as Current Revision','Revision','selection'],['revision-remove','Remove Revision Mark from Selection','Revision','selection'],['revision-previous','Previous Revision','Revision','manuscript'],['revision-next','Next Revision','Revision','manuscript'],['revision-manage','Manage Revision Passes','Revision','manuscript'],['revision-clear','Clear Revision Pass…','Revision','manuscript'],
 ['comment-add','Add Comment','Comments','selection'],['comment-caret','Add Comment Here','Comments','manuscript'],['find-manuscript','Find in Manuscript','Edit','manuscript'],['statistics','Project Statistics','Tools','project'],['writing-goals','Writing Goals','Tools','project'],['import-manuscript','Import Existing Manuscript','Project','any'],['import-report','Import Report','Project','project'],
 ['open-corkboard','Open Corkboard','Planning','project'],['open-outliner','Open Outliner','Planning','project'],['open-timeline','Open Timeline','Planning','project'],['open-world-bible','Open World Bible','Worldbuilding','project'],['open-research','Open Research','Worldbuilding','project'],['open-collections','Open Collections','Planning','project'],['publish','Enter PUBLISH','View','project'],['write','Return to WRITE','View','project']
] as const;
export type CommandId=typeof existingCommands[number]['id']|typeof extraCommands[number][0];
export type CommandResult={status:'completed'|'opened'|'canceled'|'failed'}|{status:'refused';reason:string};
export type CommandContextRule='any'|'project'|'manuscript'|'selection';
export type CommandDescriptor={id:CommandId;label:string;menuLabel?:string;group:string;shortcut:string;configurable:boolean;keywords:string[];palette:'normal'|'search-only'|'hidden';safety:'normal'|'sensitive'|'destructive';context:CommandContextRule};
const manuscriptIds=new Set<string>(['focus-mode','text-focus-off','text-focus-sentence','text-focus-paragraph','typewriter-toggle','align-left','align-center','align-right','editor-focus-other','editor-lock','editor-unlock','editor-close-pane','take-snapshot','browse-history']);
export const appCommands:CommandDescriptor[]=[...existingCommands.map(c=>({...c,group:({'Focus':'View','Editor Layout':'View','Zoom':'View','Navigation':'Tools','Capture':'Planning','General':'Project'} as Record<string,string>)[c.group]||c.group,keywords:[],palette:'normal' as const,safety:'normal' as const,context:(manuscriptIds.has(c.id)?'manuscript':['new-project','manage-templates','zoom-in','zoom-out','zoom-reset'].includes(c.id)?'any':'project') as CommandContextRule})),...extraCommands.map(([id,label,group,context])=>({id,label,group,context,shortcut:id==='command-palette'?'Ctrl+Shift+P':id==='undo'?'Ctrl+Z':id==='redo'?'Ctrl+Y':id==='find-manuscript'?'Ctrl+F':['bold','italic','underline'].includes(id)?'Ctrl+'+({bold:'B',italic:'I',underline:'U'} as Record<string,string>)[id]:'',configurable:id==='command-palette',keywords:id==='statistics'?['stats']:[],palette:(id==='command-palette'?'hidden':['revision-clear','corkboard-clear','restore-backup'].includes(id)?'search-only':'normal') as CommandDescriptor['palette'],safety:(['revision-clear','corkboard-clear'].includes(id)?'destructive':['restore-backup','rebuild'].includes(id)?'sensitive':'normal') as CommandDescriptor['safety']}))];
export const commandDescriptor=(id:string)=>appCommands.find(c=>c.id===id);
export function cleanRecent(value:unknown):CommandId[]{return Array.isArray(value)?[...new Set(value.filter((id):id is CommandId=>typeof id==='string'&&!!appCommands.find(c=>c.id===id&&c.palette!=='hidden'&&c.safety!=='destructive')))].slice(0,8):[];}
export function recordRecent(value:unknown,id:CommandId,result:CommandResult){return ['completed','opened'].includes(result.status)?cleanRecent([id,...cleanRecent(value)]):cleanRecent(value);}
export type Keybindings=Partial<Record<CommandId,string>>;
export const fixedShortcuts=[
  ['Undo','Ctrl+Z'],['Redo','Ctrl+Y'],['Bold','Ctrl+B'],['Italic','Ctrl+I'],['Underline','Ctrl+U'],
  ['Cut','Ctrl+X'],['Copy','Ctrl+C'],['Paste','Ctrl+V'],['Select all','Ctrl+A'],
  ['Enter / leave manuscript editor','F6'],['Leave editor / cancel','Escape'],['First-line indent / outdent','Tab / Shift+Tab'],
  ['Story Tree focus navigation','Arrows / Home / End'],['Story Tree select','Enter'],['Move sibling / Collection member','Alt+Up / Alt+Down'],
  ['Fullscreen','F11'],['Close application','Alt+F4'],['Zoom in (alternate)','Ctrl+Shift+='],
] as const;
const reserved=new Set(['Ctrl+E','Ctrl+Shift+B','Ctrl+Shift+7','Ctrl+Shift+8','Ctrl+Shift+9','Ctrl+Z','Ctrl+Y','Ctrl+Shift+Z','Ctrl+B','Ctrl+I','Ctrl+U','Ctrl+X','Ctrl+C','Ctrl+V','Ctrl+A','Ctrl+F','Ctrl+K','Ctrl+N','Ctrl+Shift+F','Ctrl+Shift+S','Ctrl+Shift+=','Ctrl+Shift+-','Ctrl+Shift+0','Alt+F','Alt+E','Alt+V','Alt+T','Alt+H','Alt+F4','Alt+ArrowUp','Alt+ArrowDown']);
export function commandBinding(id:CommandId,bindings:Keybindings={}){if(id==='command-palette'&&bindings[id]===undefined&&Object.entries(bindings).some(([key,v])=>key!==id&&v==='Ctrl+Shift+P'))return '';return bindings[id]??appCommands.find(c=>c.id===id)!.shortcut;}
export function normalizeBinding(value:string){
  if(typeof value!=='string')throw Error('Choose a key combination.');
  const parts=value.split('+'),key=parts.pop()||'',mods=parts;
  if(!/^(?:[A-Z0-9=\-]|F(?:[1-9]|1[0-2]))$/i.test(key)||mods.some(m=>!['Ctrl','Alt','Shift'].includes(m))||new Set(mods).size!==mods.length||(!mods.includes('Ctrl')&&!mods.includes('Alt')))throw Error('Use Ctrl or Alt with a letter, number or function key.');
  if(mods.includes('Ctrl')&&mods.includes('Alt'))throw Error('Ctrl+Alt combinations are reserved for AltGr text input.');
  return [...['Ctrl','Alt','Shift'].filter(m=>mods.includes(m)),key.toUpperCase()].join('+');
}
export function changeBinding(current:Keybindings,id:string,value:string|null):Keybindings{
  const command=appCommands.find(c=>c.id===id);if(!command?.configurable)throw Error('This shortcut is fixed by its editor or application handler.');
  const binding=value===null?command.shortcut:value===''&&id==='command-palette'?'':normalizeBinding(value);
  const conflict=appCommands.find(c=>c.id!==id&&!!binding&&commandBinding(c.id,current)===binding);
  if(conflict)throw Error(`Already assigned to ${conflict.label}.`);
  if(reserved.has(binding))throw Error('This combination is reserved for editing, navigation or Windows.');
  const next={...current};if(binding===command.shortcut)delete next[command.id];else next[command.id]=binding;return next;
}
export function validateBindings(value:unknown):Keybindings|undefined{
  if(value===undefined)return undefined;
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid keyboard shortcuts.');
  const bindings=value as Keybindings;
  for(const [id,binding] of Object.entries(bindings))changeBinding(bindings,id,binding);
  return bindings;
}
export type CommandKey={key:string;control:boolean;alt:boolean;shift:boolean;meta:boolean;isComposing?:boolean;type?:string};
export function commandForInput(input:CommandKey,bindings:Keybindings={}):CommandId|undefined{
  if(input.isComposing||input.meta||input.type&&input.type!=='keyDown')return;
  const key=input.key.length===1?input.key.toUpperCase():input.key;
  const candidate=[input.control?'Ctrl':'',input.alt?'Alt':'',input.shift?'Shift':'',key].filter(Boolean).join('+');
  return appCommands.find(c=>commandBinding(c.id,bindings)===candidate)?.id;
}
