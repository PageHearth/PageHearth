import {NodeSelection} from '@tiptap/pm/state';
import {createManuscriptImage} from '../shared/manuscriptImages';
import {ImageProperties} from './ImageProperties';
import {UpdateCenter} from './Updates';
import {publicationEdit} from './publicationEdit';
import {ProjectNotifications} from './ProjectNotifications';
import PublishWorkspace from './PublishWorkspace';
import {ModalCard} from './ModalCard';
import {startThemeRuntime,selectApplicationTheme} from './themeRuntime';
import {ManualSaveFeedback} from './manualSaveFeedback';
const ShellDialog=lazy(()=>import('./ShellDialog'));
import {ProjectDictionary,useProjectSpelling} from './ProjectDictionary';
import {ReferencePicker,type ReferenceRequest} from './ReferencePicker';
import {referenceRanges,validateReferenceReplacement} from '../shared/referenceIntegrity';
import {typedReference} from './referenceInput';
import {DetachedPalette} from './DetachedPalette';
import {workspaceReason,executeWorkspaceCommand,workspaceCommandIds} from './workspaceCommands';
import {executeFormat} from './formatCommands';
import {CommandPalette} from './CommandPalette';
import {captureCommandOrigin,validCommandOrigin} from './commandOrigin';
import {beginTransientOverlay} from './transientOverlay';
import {commandState,type CommandContext} from '../shared/commandPalette';
import {commandDescriptor,type CommandId,type CommandResult} from '../shared/commands';
import {routePane} from '../shared/split';
import {RevisionControls} from './RevisionControls';
import {readRevisionPasses,revisionRanges,type RevisionId,type RevisionPasses} from '../shared/revisionPasses';
import {scopeDocuments as revisionDocuments} from '../shared/continuous';
import {revisionSelectionCommand,RevisionCommandRefusal,revisionSelectionCue} from './revisionInput';
import {closeWithProtection} from './protectedClose';
import {attachComment,captureAnchor,anchors,restoreAnchors,invalidateComments,commentBody} from '../shared/comments';
import {commentEmphasis} from './commentDecorations';
import {Selection as ManuscriptSelection,TextSelection as ManuscriptTextSelection} from '@tiptap/pm/state';
import {bodyFingerprint,partitionScene,sceneResultScope,type SceneSelection} from '../shared/sceneSelection';
import {canonicalPosition,compositePosition} from './continuous';
import {ImportReport} from './ImportReport';
import {Templates} from './Templates';
import {localDay} from '../shared/writing';
import {textFocusKey,focusPreferences,type FocusPreferences} from './textFocus';
import {ManuscriptPanes,type PaneCallbacks} from './manuscriptPanes';
import {SplitSurface} from './SplitSurface';
import {scopeDocuments,type ManuscriptScope} from '../shared/continuous';
import {segments,replaceSegment,boundaryMessage} from './continuous';
import {HistoryBrowser} from './History';
import {WritingUtility,useStatisticsTransport,useWriting} from './Writing';
import {restoredCopy} from '../shared/history';
import {GlobalSearch} from './GlobalSearch';
import {SearchIndexService,type SearchRequest} from '../shared/search';
import {announceSearch,revealEditor} from './searchNavigation';
import {Timeline} from './Timeline';
import {captureReferenceFormat,createReferenceTransaction} from './referenceFormat';
import {EditorCommandBar} from './EditorCommandBar';
import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { blank, words, type Project, type TreeNode, type Doc } from '../shared/model';
import '../shared/bridge';
import {ShellNavigation,StatusZoom,KeyboardShortcuts} from './AppShell';
import {commandBinding,commandForInput,type Keybindings} from '../shared/commands';
import './style.css';
import './shell.css';
import './worldBible.css';
import {Home} from './Home';
import { zoomShortcut, type AppCommand, type RecentProject, type ZoomAction, type AppTheme } from '../shared/preferences';
import {reconcileProject} from '../shared/reconcile';
import type { DraftWorkspace } from '../shared/draft';
import { replaceDocument } from './documentSession';
import { PanelResize, panelWidth } from './PanelResize';
import { StoryTree } from './StoryTree';
import {creationDestinations, defaultCreationParent, creationPath, createTreeNode} from '../shared/treeCreation';
import { changeTree, TreeMoveRejected, treeOrderSnapshot, type TreeAction } from '../shared/tree';
import { Inspector } from './Inspector';
import { Outliner } from './Outliner';
import { Corkboard } from './Corkboard';
import { Notebook } from './Notebook';
import { QuickNotes } from './QuickNotes';
import { detachedErrorMessage, workspaceRegistry, type WorkspaceId } from './workspaces';
import {commitQuickNotesSend,restoreFailedQuickNotes} from './quickNotesSend';
import {ProjectDirtyState} from './saveState';
import {OutlinerStructureHistory} from './outlinerHistory';
import {WorldBible} from './WorldBible';
import {DetachedPlaceholder} from './DetachedPlaceholder';
import {customCategory,entity} from '../shared/worldBible';
import {Research} from './Research';
import {AddToCollectionDialog,CollectionCreateDialog,Collections} from './Collections';
import type {CollectionMember,CollectionTargetType} from '../shared/collections';
import './themes.css';
import './editorStudio.css';



function App() {
  const [palette,setPalette]=useState<{element:HTMLElement|null;capture:ReturnType<typeof captureCommandOrigin>}|null>(null);
  const [recentCommands,setRecentCommands]=useState<CommandId[]>([]);
  const [revisionRequest,setRevisionRequest]=useState(0);const revisionActions=useRef<null|{choose:(slot:RevisionId|null)=>void}>(null);
  const [importEntry,setImportEntry]=useState(false);
  const [dictionaryOpen,setDictionaryOpen]=useState(false);
  const [importReportOpen,setImportReportOpen]=useState(false);
  const [templatesOpen,setTemplatesOpen]=useState<'new'|'save'|'manage'|null>(null);
  const [focusMode,setFocusMode]=useState(false);
  const [historyRequest,setHistoryRequest]=useState<{id:string;take:boolean}|null>(null);const historyRef=useRef(false);
  function openHistory(id:string,take:boolean){const p=current.current;if(!p||transitioning.current)return;const node=p.manifest.nodes.find(n=>n.id===id);if(!node||!['Chapter','Scene'].includes(node.kind)){setNotice('Select a Chapter or Scene to use History.');return;}historyRef.current=true;setHistoryRequest({id,take});}
  function closeHistory(){setHistoryRequest(null);requestAnimationFrame(()=>{historyRef.current=false;});}
  async function restoreHistory(id:string,body:Doc,expected:Doc){const p=current.current;if(!p||JSON.stringify(p.documents[id])!==JSON.stringify(expected))throw Error('Current text changed while preparing restore.');validateReferenceReplacement(p,id,body);const comments=invalidateComments(p.author.comments,id,body);await window.pagehearth.protectDocument(p.manifest.id,id,body,comments,p.author.comments);if(current.current?.manifest.id!==p.manifest.id||JSON.stringify(current.current.documents[id])!==JSON.stringify(expected))throw Error('Current document changed; restore canceled.');changed({...current.current,documents:{...current.current.documents,[id]:body},author:comments?{...current.current.author,comments}:current.current.author});panes.history.closeGroup();panes.history.prose({kind:'prose',documentId:id,before:structuredClone(expected),after:structuredClone(body),anchorsBefore:anchors(p.author.comments,id),anchorsAfter:anchors(comments,id),from:1,to:1,contributions:[],time:Date.now()},false);panes.history.closeGroup();panes.sync();await window.pagehearth.projectEdited(p.manifest.id);await flush();}
  async function newHistoryDocument(id:string,body:Doc,title:string){if(!current.current)throw Error('Project closed.');changed(restoredCopy(current.current,id,body,title));await flush();}

  const [searchOpen,setSearchOpen]=useState(false);const searchNavigation=useRef(false);
  const [project,setProject] = useState<Project|null>(null); const current = useRef<Project|null>(null);
  useEffect(()=>{if(historyRequest&&project&&!project.documents[historyRequest.id]){closeHistory();setNotice('The History source document was removed.');}},[project,historyRequest]);
  const [scope,setScope]=useState<ManuscriptScope|null>(null);const scopeRef=useRef<ManuscriptScope|null>(null);const [titles,setTitles]=useState(true);
  function activeDocument(id:string){if(selection.current===id)return;selection.current=id;setSelected(id);}
  function setScopeState(value:ManuscriptScope|null){scopeRef.current=value;setScope(value);}
  async function changeScope(value:ManuscriptScope|null,id=selection.current){return run(async()=>{await flush();if(await panes.direct(panes.active,value,id)){setWriteView('editor');setMode('WRITE');}});}
  const [selected,setSelected] = useState(''); const selection = useRef('');
  const [mode,setMode] = useState<'WRITE'|'PUBLISH'>('WRITE');
  const [shellDialog,setShellDialog]=useState<{kind:'settings'|'about';origin:number|null}|null>(null);
  const shellOrigin=useRef<number|null>(null);
  useEffect(()=>{document.title=project?'PageHearth · '+project.manifest.title:'PageHearth';},[project?.manifest.title,project?.manifest.id]);
  const [saveAcknowledged,setSaveAcknowledged]=useState(false);
  const saveFeedback=useRef<ManualSaveFeedback|null>(null);
  if(!saveFeedback.current)saveFeedback.current=new ManualSaveFeedback(setSaveAcknowledged);
  useEffect(()=>()=>saveFeedback.current?.clear(),[]);
  const [title,setTitle] = useState('My Novel'); const [status,setStatus] = useState('Saved'); const [error,setError] = useState(''); const [notice,setNotice] = useState(''); const [commentAnnouncement,setCommentAnnouncement]=useState('');
  const [goalToast,setGoalToast]=useState(0);const writing=useWriting(project,setNotice,count=>setGoalToast(n=>n+count));
  const openWriting=(view:'statistics'|'goals')=>{void window.pagehearth.detachWorkspace('goals',view).catch(e=>setNotice(String(e)));};const openGoals=()=>openWriting('goals');
  useEffect(()=>{if(!goalToast)return;const timer=setTimeout(()=>setGoalToast(0),7000);return()=>clearTimeout(timer);},[goalToast]);

  const [createNode,setCreateNode]=useState(false); const [busy,setBusy] = useState(false); const [newKind,setNewKind] = useState<TreeNode['kind']>('Chapter'); const [newTitle,setNewTitle] = useState('');const [newParent,setNewParent]=useState<string|null>(null);const creationActive=useRef<string|null>(null);
  const quickSend=useRef(false);const [quickSending,setQuickSending]=useState(false);
  const [bindings,setBindings]=useState<Keybindings>({}),[shortcutsOpen,setShortcutsOpen]=useState(false),[sentNote,setSentNote]=useState<string|null>(null);
  const [zoom,setZoom] = useState(100);const [recents,setRecents] = useState<RecentProject[]>([]);
  const [editorView,setEditorView]=useState<'pages'|'continuous'>('pages');
  const [navigator,setNavigator] = useState<'none'|'pages'>('none');
  const [treeVisible,setTreeVisible]=useState(true);const [inspectorVisible,setInspectorVisible]=useState(true);
  const [treeWidth,setTreeWidth]=useState(235);const [inspectorWidth,setInspectorWidth]=useState(235);
  const [writeView,setWriteView]=useState<WorkspaceId>('editor');const [inspectorPin,setInspectorPin]=useState<string|null>(null);const [notebookTarget,setNotebookTarget]=useState<string|null>(null);const [researchTarget,setResearchTarget]=useState<string|null>(null);const [worldOpenRequest,setWorldOpenRequest]=useState(0);const [worldTarget,setWorldTarget]=useState<string|undefined>(undefined);const [timelineTarget,setTimelineTarget]=useState<string|undefined>();const [timelineRequest,setTimelineRequest]=useState(0);const [collectionTarget,setCollectionTarget]=useState<string|undefined>(undefined);const [quickNotes,setQuickNotesOpen]=useState(false);const [treeChecked,setTreeChecked]=useState<string[]>([]);
  const [detached,setDetached]=useState<Set<string>>(new Set());
  const [detachedEntities,setDetachedEntities]=useState<Set<string>>(new Set());
  const [referenceRequest,setReferenceRequest]=useState<ReferenceRequest|null>(null);
  const [addCollectionTargets,setAddCollectionTargets]=useState<Pick<CollectionMember,'type'|'id'>[]|null>(null);const [createCollectionTargets,setCreateCollectionTargets]=useState<Pick<CollectionMember,'type'|'id'>[]|null>(null);
  const referenceOpen=useRef(false);
  const transitioning=useRef(false);const commandRef=useRef<(command:AppCommand)=>void>(()=>{});
  const pendingCommand=useRef<AppCommand|null>(null);
  useEffect(()=>{if(!busy && pendingCommand.current){const next=pendingCommand.current;pendingCommand.current=null;commandRef.current(next);}},[busy]);
  const saveState=useRef(new ProjectDirtyState()); const timer = useRef<ReturnType<typeof setTimeout>|null>(null); const inFlight = useRef<Promise<void>|null>(null);
  const outlinerHistory=useRef<OutlinerStructureHistory|null>(null);
  const publish = (p: Project) => { current.current=p; setProject({...p}); };
  useEffect(()=>setTreeChecked([]),[project?.manifest.id]);
  const fail = (e: unknown) => { saveFeedback.current!.clear();setError(String(e)); setNotice(''); setStatus('Error'); };
  const workspace = (p:Project):DraftWorkspace => p.manifest.settings.workspace as DraftWorkspace;
  function capturePosition(){if(mode==='WRITE'&&writeView==='editor'&&current.current)panes.remember();}
  async function refreshSettings(){const state=await window.pagehearth.appState();setBindings(state.settings.keybindings||{});setRecentCommands(state.settings.recentCommands||[]);setZoom(state.settings.zoomPercent);setRecents(state.settings.recentProjects);if(state.warning)setNotice(state.warning);}
  async function changeZoom(action:ZoomAction|number){try{setZoom(await window.pagehearth.zoom(action));}catch(e){fail(e);}}
  async function flush(): Promise<void> {
    if(timer.current) clearTimeout(timer.current);
    if(inFlight.current) { await inFlight.current; if(saveState.current.dirty) return flush(); return; }
    const task = (async()=> { while(saveState.current.dirty && current.current) {
      setStatus('Saving…'); const at = saveState.current.generation;
      const candidate=structuredClone(current.current);const result=await window.pagehearth.save(candidate);const saved=result.project;
      if(saveState.current.acknowledge(at)){publish(saved);}
      else {const rebased=reconcileProject(candidate,structuredClone(current.current),saved);if(!rebased.project)throw Error('Newer local edits conflict with the accepted save. They remain protected; save a recovery copy before refreshing.');publish(rebased.project);}
      if(result.reconciled)setNotice('PageHearth safely combined this save with newer non-conflicting project changes.');
    } setStatus('Saved'); setError(''); })();
    inFlight.current = task;
    try { await task; } finally { inFlight.current=null; }
  }
  function changed(p: Project) { saveFeedback.current!.clear();publish(p); saveState.current.markChanged(); setStatus('Unsaved'); if(timer.current) clearTimeout(timer.current); timer.current=setTimeout(()=>flush().catch(fail),1000); }
  useProjectSpelling(project,authorChanged);
  function authorChanged(p:Project){const previous=current.current,before=previous?.author;if(previous){for(const [id,body] of Object.entries(p.documents)){const old=previous.documents[id];if(old&&JSON.stringify(old)!==JSON.stringify(body)){validateReferenceReplacement(p,id,body);panes.history.closeGroup();panes.history.prose({kind:'prose',documentId:id,before:structuredClone(old),after:structuredClone(body),anchorsBefore:anchors(previous.author.comments,id),anchorsAfter:anchors(p.author.comments,id),from:1,to:1,contributions:[],time:Date.now()},false);panes.history.closeGroup();void window.pagehearth.protectDocument(p.manifest.id,id,body,p.author.comments,previous.author.comments).catch(fail);}}}changed(p);panes.sync();void window.pagehearth.protectAuthor(p.manifest.id,p.author,before).catch(fail);void window.pagehearth.projectEdited(p.manifest.id).catch(fail);}
  const referenceFormat=useRef<ReturnType<typeof captureReferenceFormat>|null>(null);
  const referenceOwner=useRef<{editor:typeof panes.active.editor;projectId:string;epoch:number;generation:number;documentId:string;body:string}|null>(null);
  function captureOwner(source:typeof panes.active.editor,from:number,to:number,trigger=false){const p=current.current,pane=panes.panes.find(p=>p.editor===source);if(!p||!pane)return false;const a=canonicalPosition(source.state.doc,from),b=canonicalPosition(source.state.doc,to);if(pane.scope&&(!a||!b||a.id!==b.id)){setNotice('Select text within one manuscript document.');return false;}referenceOwner.current={editor:source,projectId:p.manifest.id,epoch:panes.epoch,generation:pane.generation,documentId:pane.documentId,body:JSON.stringify(p.documents[pane.documentId])};referenceFormat.current=captureReferenceFormat(source.state,from,to,trigger);return true;}
  const [,paneRender]=useState(0);
  const historyQueue=useRef(Promise.resolve());const historyRequests=useRef(0);
  function queueManuscriptHistory(direction:'undo'|'redo'){if(!historyRequests.current&&!transitioning.current&&panes.history.peek(direction)?.kind==='prose'){try{applyProseHistory(direction);}catch(e){fail(e);}return;}historyRequests.current++;const epoch=panes.epoch;historyQueue.current=historyQueue.current.then(async()=>{if(panes.epoch===epoch)await manuscriptUndo(direction);}).catch(fail).finally(()=>{historyRequests.current--;});}
  const paneCallbacks=useRef<PaneCallbacks>(null!);
  paneCallbacks.current={imagePaste:()=>{void executeCommand('paste-image');},imageDrop:source=>{void insertManuscriptImage('file',source).catch(fail);},project:()=>current.current,edit:async(id,body,source,comments)=>{const p=current.current;if(!p)return;searchNavigation.current=false;changed({...p,documents:{...p.documents,[id]:body},author:comments?{...p.author,comments}:p.author});const protection=window.pagehearth.protectDocument(p.manifest.id,id,body,comments,p.author.comments);void window.pagehearth.projectEdited(p.manifest.id).catch(fail);const request=typedReference(source);if(request&&!referenceOpen.current&&captureOwner(source,request.from,request.to,true)){referenceOpen.current=true;setReferenceRequest(request);}await protection;},context:pane=>{activeDocument(pane.documentId);scopeRef.current=pane.scope;setScope(pane.scope);setEditorView(pane.view);setNavigator(pane.navigator);setTitles(pane.titles);},state:()=>paneRender(x=>x+1),persist:state=>{const p=current.current;if(!p||searchNavigation.current||historyRef.current)return;const active=state.panes.find(x=>x.id===state.active)!;const previous=workspace(p);if(JSON.stringify(previous.splitEditors)===JSON.stringify(state))return;changed({...p,manifest:{...p.manifest,settings:{...p.manifest.settings,workspace:{...previous,splitEditors:state,selected:active.documentId,manuscriptScope:active.scope,editorView:active.view,navigator:active.navigator,manuscriptTitles:active.titles}}}});},notice:setNotice,history:queueManuscriptHistory,selection:()=>{if(panes.active.editor.state.selection.empty)setNotice(value=>value===boundaryMessage?'':value);},error:fail};
  const [panes]=useState(()=>new ManuscriptPanes(new Proxy({} as PaneCallbacks,{get:(_,key)=>paneCallbacks.current[key as keyof PaneCallbacks]})));
  const editor=panes.active.editor;
  useStatisticsTransport(project,editor,selected,project&&scope?scopeDocuments(project,scope):undefined);
  useEffect(()=>()=>panes.destroy(),[panes]);
  // Pane events own view/scope/navigation context. Canonical content synchronization
  // can only change the active document (for example, a deleted-document fallback).
  // Re-emitting all context here schedules redundant passive updates on every edit.
  useEffect(()=>{panes.busy=busy;panes.sync();activeDocument(panes.active.documentId);},[project,busy,panes]);
  useEffect(()=>{if(project&&selected)void window.pagehearth.activeManuscriptDocument(project.manifest.id,selected).catch(fail);},[project?.manifest.id,selected]);
  useEffect(()=>{void window.pagehearth.manuscriptScopeState(!!scope,titles).catch(fail);},[scope,titles]);
  useEffect(()=>{void window.pagehearth.editorLayoutState(panes.layout,panes.active.locked).catch(fail);},[panes.layout,panes.active.locked]);
  useEffect(()=>{refreshSettings().catch(fail);const stopSettings=window.pagehearth.onSettings(settings=>setBindings(settings.keybindings||{}));const stopZoom=window.pagehearth.onZoom(setZoom);const stopCommand=window.pagehearth.onCommand(c=>commandRef.current(c));const stopProject=window.pagehearth.onProjectUpdate(p=>{if(!saveState.current.dirty)publish(p);else setNotice('A detached workspace saved changes while this window has unsaved work. Finish or recover the visible edit before changing workspaces.');});const stopDock=window.pagehearth.onWorkspaceDocked((surface,contextId)=>{if(surface==='character'&&contextId)setDetachedEntities(value=>{const next=new Set(value);next.delete(contextId);return next;});else setDetached(value=>{const next=new Set(value);next.delete(surface);return next;});});const stopDetach=window.pagehearth.onWorkspaceDetached((surface,contextId)=>{if(surface==='character'&&contextId)setDetachedEntities(value=>new Set(value).add(contextId));else setDetached(value=>new Set(value).add(surface));});const stopOpen=window.pagehearth.onDetachedOpen((type,id)=>{setMode('WRITE');if(type==='document')void openDocument(id);else if(type==='note')openNote(id);else if(type==='timeline'){setTimelineTarget(id);setTimelineRequest(value=>value+1);chooseWriteView('timeline');}else if(type==='entity'){setWorldTarget(id);setWorldOpenRequest(value=>value+1);chooseWriteView('world-bible');}else{setResearchTarget(id);chooseWriteView('research');}});void window.pagehearth.ready().catch(fail);return ()=>{stopSettings();stopZoom();stopCommand();stopProject();stopDock();stopDetach();stopOpen();};},[]);
  useEffect(()=> { const key = (e:KeyboardEvent)=>{
    if(document.querySelector('[data-shortcut-dialog]'))return;
    if(!e.isComposing&&(e.ctrlKey||e.metaKey)&&!e.altKey&&['z','y'].includes(e.key.toLowerCase())&&(panes.active.editor.view.dom.contains(document.activeElement)||historyRequests.current>0)){e.preventDefault();e.stopImmediatePropagation();queueManuscriptHistory(e.key.toLowerCase()==='y'||e.shiftKey?'redo':'undo');return;}
    const action=zoomShortcut({type:'keyDown',control:e.ctrlKey,alt:e.altKey,meta:e.metaKey,key:e.key,code:e.code});
    // Native input is consumed in main. This capture fallback covers synthesized/accessibility input.
    if(action){e.preventDefault();e.stopImmediatePropagation();void changeZoom(action);return;}
    if(e.ctrlKey&&!e.shiftKey&&!e.altKey&&e.key.toLowerCase()==='f'&&mode==='WRITE'&&writeView==='editor'){e.preventDefault();panes.active.find=true;panes.emit();return;}
    if(document.documentElement.dataset.commandPalette==='open')return;
    if(!e.isComposing&&e.key==='Escape'&&document.activeElement?.closest('dialog[open],.writing-dialog,.revision-manager,.revision-control details[open]'))return;
    if(!e.isComposing&&e.key==='Escape'&&focusMode){e.preventDefault();e.stopImmediatePropagation();setFocusMode(false);panes.active.editor.view.focus();return;}
    if(!e.isComposing && e.key==='F6'){const el=panes.active.editor.view.dom;if(!el)return;e.preventDefault();if(el.contains(document.activeElement))document.querySelector<HTMLElement>(focusMode?'[aria-label="Focus controls"]':'[aria-label="Editor commands"]')?.focus();else el.focus();return;}
    if(!e.isComposing && e.key==='Escape' && document.activeElement?.closest('[aria-label="Manuscript editor"]')){e.preventDefault();document.querySelector<HTMLElement>('[aria-label="Editor commands"]')?.focus();return;}
    if(document.documentElement.dataset.commandPalette==='open')return;const id=commandForInput({key:e.key,control:e.ctrlKey,alt:e.altKey,shift:e.shiftKey,meta:e.metaKey,isComposing:e.isComposing},bindings);if(id==='command-palette'){e.preventDefault();openPalette();return;}if(id==='focus-mode'||id==='search-project'||id==='quicknotes'||id==='notebook'||id==='save'){e.preventDefault();commandRef.current({kind:id});}
  }; window.addEventListener('keydown',key,true); return ()=>window.removeEventListener('keydown',key,true); },[bindings,mode,writeView,focusMode]);
  useEffect(()=>{const wheel=(e:WheelEvent)=>{if(e.ctrlKey && !e.altKey && !e.metaKey && e.deltaY!==0){e.preventDefault();e.stopImmediatePropagation();void changeZoom(e.deltaY<0?'in':'out');}};window.addEventListener('wheel',wheel,{capture:true,passive:false});return ()=>window.removeEventListener('wheel',wheel,true);},[]);
  async function run(fn:()=>Promise<void>) { if(transitioning.current)return;if(panes.active.editor.view.composing){setNotice('Finish the current text composition before changing editor views.');return;}capturePosition();transitioning.current=true;setBusy(true);panes.busy=true;panes.interaction(); try { await fn(); return true; } catch(e) {fail(e);return false;} finally {transitioning.current=false;setBusy(false);panes.busy=false;panes.interaction();} }
  useEffect(()=>{void window.pagehearth.editorViewState(project?editorView:null).catch(fail);},[editorView,!!project]);
  function loadProject(p:Project){saveFeedback.current!.clear();setFocusMode(false);setHistoryRequest(null);historyRef.current=false;setSearchOpen(false);searchNavigation.current=false;publish(p);saveState.current.reset();outlinerHistory.current=new OutlinerStructureHistory(treeOrderSnapshot(p));const saved=workspace(p);panes.reset(p);setTreeWidth(panelWidth(saved.treeWidth));setInspectorWidth(panelWidth(saved.inspectorWidth));setTreeVisible(saved.treeVisible!==false);setInspectorVisible(saved.inspectorVisible!==false);setWriteView(workspaceRegistry.some(x=>x.id===saved.writeView)?saved.writeView as WorkspaceId:'editor');setMode('WRITE');setInspectorPin(null);setNotebookTarget(null);setResearchTarget(null);setWorldTarget(undefined);setCollectionTarget(undefined);setTimelineTarget(undefined);setNotice(p.recovery.join(' '));setError('');setStatus('Saved');setNewTitle('');}
  async function closeToHome(){saveFeedback.current!.clear();await panes.pending;setScopeState(null);setSearchOpen(false);await flush();if(!await window.pagehearth.close()){setNotice('Project kept open. External backup still needs permission in Settings → Project protection.');return false;}if(timer.current)clearTimeout(timer.current);current.current=null;outlinerHistory.current=null;setProject(null);setSentNote(null);selection.current='';setSelected('');saveState.current.reset();panes.reset(null);setMode('WRITE');setWriteView('editor');setQuickNotesOpen(false);setNavigator('none');setNewTitle('');setNewKind('Chapter');setNotice('');setError('');setStatus('Saved');await refreshSettings();return true;}
  async function recoverAndRefresh(){const local=current.current;if(!local)return;await panes.pending;const canonical=await window.pagehearth.resolveStale(structuredClone(local));if(!canonical)return;publish(canonical);saveState.current.reset();panes.sync();setError('');setStatus('Saved');setNotice('Recovery copy saved. This window refreshed to the current saved project.');}
  async function home(){await run(async()=>{await closeToHome();});}
  async function openRecent(root:string){await run(async()=>{if(!await closeToHome())return;loadProject(await window.pagehearth.openRecent(root));await refreshSettings();});}
  const commentCapture=useRef<{token:string;epoch:number;paneId:string;projectId:string;body:Doc;anchor:ReturnType<typeof captureAnchor>}|null>(null);
  function captureComment(){
    const p=current.current,pane=panes.active;if(!p||mode!=='WRITE'||writeView!=='editor'||transitioning.current||pane.editor.view.composing||!pane.editor.isEditable)throw Error('Open editable WRITE text and finish composition first.');
    const {from,to}=pane.editor.state.selection,a=pane.scope?canonicalPosition(pane.editor.state.doc,from):{id:pane.documentId,pos:from},b=pane.scope?canonicalPosition(pane.editor.state.doc,to):{id:pane.documentId,pos:to};
    if(!a||!b||a.id!==b.id)throw Error('A comment selection must stay within one document.');
    const body=p.documents[a.id],node=p.manifest.nodes.find(n=>n.id===a.id);if(!node||node.trashed||!['Chapter','Scene'].includes(node.kind))throw Error('Choose an active Chapter or Scene.');
    return {token:crypto.randomUUID(),epoch:panes.epoch,paneId:pane.id,projectId:p.manifest.id,body,anchor:captureAnchor(a.id,pane.editor.schema.nodeFromJSON(body),a.pos,b.pos)};
  }
  useEffect(()=>{(window as any).__pagehearthCommentMenu=()=>{if(!panes.active.editor.view.dom.contains(document.activeElement))return null;try{commentCapture.current=captureComment();return {token:commentCapture.current.token,caret:commentCapture.current.anchor.kind==='caret'};}catch(e){return {reason:String(e).replace(/^Error: /,'')};}};return()=>{delete (window as any).__pagehearthCommentMenu;};});
  async function commentAction(action:'add'|'navigate'|'selection'|'caret',id?:string,token?:string,anchorKind?:'range'|'caret'){try{
    if(action==='navigate'){
      await flush();const p=current.current,c=p?.author.comments?.byId[id!];if(!p||!c||c.anchor.status==='missing')throw Error('Anchor Missing. Reattach this comment to manuscript text.');
      if(p.author.comments?.documentBases[c.anchor.documentId]!==commentBody(p.documents[c.anchor.documentId]))throw Error('Anchor evidence changed. No position was guessed.');
      if(!await panes.navigate(c.anchor.documentId,{reuse:true}))return;setMode('WRITE');chooseWriteView('editor');
      const pane=panes.active,at=pane.scope?compositePosition(pane.editor.state.doc,c.anchor.documentId,c.anchor.from):c.anchor.from;if(at===null)throw Error('Anchor is outside this manuscript view.');
      pane.editor.commands.setTextSelection(at);pane.editor.view.dispatch(pane.editor.state.tr.setMeta(commentEmphasis,c.id).scrollIntoView());pane.editor.commands.focus();setCommentAnnouncement('Comment anchor: '+(c.anchor.quote||'caret position'));
      return;
    }
    const captured=token?commentCapture.current:captureComment();if(!captured||token&&captured.token!==token)throw Error('Comment selection expired.');commentCapture.current=null;
    if(anchorKind&&captured.anchor.kind!==anchorKind)throw Error(anchorKind==='range'?'Select manuscript text first.':'Place a caret first.');
    if(action==='selection'&&captured.anchor.kind!=='range'||action==='caret'&&captured.anchor.kind!=='caret')throw Error(action==='caret'?'Place a caret first.':'Select manuscript text first.');
    const p=current.current;if(!p||p.manifest.id!==captured.projectId||panes.epoch!==captured.epoch||panes.active.id!==captured.paneId||commentBody(p.documents[captured.anchor.documentId])!==commentBody(captured.body))throw Error('The selection changed. Select it again.');
    const made=attachComment(p,captured.anchor,captured.body,id);setInspectorPin(null);setInspectorVisible(true);authorChanged(made.project);panes.sync();setTimeout(()=>window.dispatchEvent(new CustomEvent('pagehearth-comment-created',{detail:{id:made.id,state:made.project.author.comments!.byId[made.id].state}})),0);return true;
  }catch(e){setNotice(String(e).replace(/^Error: /,''));return false;}}
  const sceneCapture=useRef<{token:string;request:SceneSelection;paneId:string;epoch:number}|null>(null);
  function captureScene(){
    if(!current.current||mode!=='WRITE'||writeView!=='editor'||transitioning.current||panes.active.editor.view.composing||!panes.active.editor.isEditable)throw Error('Open the editable WRITE manuscript and finish any text composition first.');
    const pane=panes.active,{from,to}=pane.editor.state.selection;
    const a=pane.scope?canonicalPosition(pane.editor.state.doc,from):{id:pane.documentId,pos:from},b=pane.scope?canonicalPosition(pane.editor.state.doc,to):{id:pane.documentId,pos:to};
    if(!a||!b||a.id!==b.id)throw Error('Selection must stay within one Chapter or Scene.');
    const p=current.current,body=p.documents[a.id],node=p.manifest.nodes.find(n=>n.id===a.id);
    if(!node||node.trashed||!['Chapter','Scene'].includes(node.kind))throw Error('Select text within one active Chapter or Scene.');
    if(node.kind==='Scene'&&p.manifest.nodes.some(n=>n.parent===node.id))throw Error('This Scene has children. Resolve its hierarchy before splitting it.');
    const result=partitionScene(pane.editor.schema,body,a.pos,b.pos);
    if(node.kind==='Scene'&&result.bodies.length===1)throw Error('This selection already fills the current Scene.');
    return {token:crypto.randomUUID(),paneId:pane.id,epoch:panes.epoch,request:{projectId:p.manifest.id,revision:p.manifest.revision,sourceId:a.id,from:a.pos,to:b.pos,body:bodyFingerprint(body)}};
  }
  useEffect(()=>{(window as any).__pagehearthSceneMenu=()=>{if(mode!=='WRITE'||writeView!=='editor'||!panes.active.editor.view.dom.contains(document.activeElement))return null;try{sceneCapture.current=captureScene();return {token:sceneCapture.current.token};}catch(e){sceneCapture.current=null;return {reason:String(e).replace(/^Error: /,'')};}};return()=>{delete (window as any).__pagehearthSceneMenu;};});
  function focusSceneResult(id:string,pos:number,sourceId:string,pieces:string[]){
    const pane=panes.active;
    const ancestors:string[]=[];let parent=current.current?.manifest.nodes.find(n=>n.id===id)?.parent;while(parent){ancestors.push(parent);parent=current.current?.manifest.nodes.find(n=>n.id===parent)?.parent;}
    window.dispatchEvent(new CustomEvent('pagehearth-reveal-document',{detail:{id,ancestors}}));
    pane.scope=sceneResultScope(pane.scope,current.current!,sourceId,pieces);
    const generation=pane.generation;pane.documentId=id;pane.baseline.clear();panes.sync();pane.generation=generation;
    const target=pane.scope?compositePosition(pane.editor.state.doc,id,pos):Math.min(pos,pane.editor.state.doc.content.size-1);
    if(target!==null)pane.editor.view.dispatch(pane.editor.state.tr.setSelection(ManuscriptSelection.near(pane.editor.state.doc.resolve(Math.max(0,Math.min(target,pane.editor.state.doc.content.size))))));pane.position={scrollTop:0,anchor:pane.editor.state.selection.anchor,head:pane.editor.state.selection.head};panes.emit(false);pane.editor.commands.focus();
  }
  async function createSelectedScene(token?:string){
    let captured:NonNullable<typeof sceneCapture.current>;
    try{captured=token?sceneCapture.current!:captureScene();if(!captured||token&&captured.token!==token)throw Error('The selection expired. Select the text again.');}catch(e){setNotice(String(e).replace(/^Error: /,''));return;}
    sceneCapture.current=null;let success=false;
    await run(async()=>{
      await panes.pending;await flush();const latest=await window.pagehearth.prepareScene();
      if(panes.epoch!==captured.epoch||panes.active.id!==captured.paneId||current.current?.manifest.id!==captured.request.projectId||bodyFingerprint(latest.documents[captured.request.sourceId])!==captured.request.body)throw Error('The source changed. Select the text again.');
      publish(latest);saveState.current.reset();
      const result=await window.pagehearth.createScene({...captured.request,revision:latest.manifest.revision});
      publish(result.project);saveState.current.reset();setStatus('Saved');panes.history.closeGroup();panes.history.push({kind:'structure',id:result.operationId});
      focusSceneResult(result.selectedId,result.selectedFrom,result.sourceId,result.pieceIds);setNotice('Created Scene structure from the selection. Undo restores the original manuscript.');success=true;
    });
    await new Promise<void>(resolve=>requestAnimationFrame(()=>{if(!panes.active.editor.isDestroyed)panes.active.editor.view.focus();resolve();}));return success;
  }
  function applyProseHistory(direction:'undo'|'redo'){
    const event=panes.history.peek(direction),latest=current.current;if(!latest||event?.kind!=='prose'||panes.active.editor.view.composing)return;
    const expected=direction==='undo'?event.after:event.before,body=direction==='undo'?event.before:event.after;
    if(!latest.manifest.nodes.some(n=>n.id===event.documentId&&!n.trashed)||JSON.stringify(latest.documents[event.documentId])!==JSON.stringify(expected)){panes.history.clear();throw Error('This manuscript body changed outside its history. Undo history was cleared; no prose was overwritten.');}
    const comments=restoreAnchors(latest.author.comments,(direction==='undo'?event.anchorsAfter:event.anchorsBefore)||{},(direction==='undo'?event.anchorsBefore:event.anchorsAfter)||{},{[event.documentId]:body});
    changed({...latest,documents:{...latest.documents,[event.documentId]:structuredClone(body)},author:comments?{...latest.author,comments}:latest.author});
    const protection=window.pagehearth.protectDocument(latest.manifest.id,event.documentId,body,comments,latest.author.comments);
    const contributions=Promise.all(event.contributions.map(contribution=>window.pagehearth.writingContribution?.(latest.manifest.id,{...contribution,apply:direction==='redo'?contribution.apply:!contribution.apply})));
    panes.pending=Promise.all([panes.pending,protection,contributions]).then(()=>{window.dispatchEvent(new Event('writing-activity'));});void panes.pending.catch(fail);
    const pane=panes.active;if(pane.scope&&!segments(pane.editor.state.doc).some(s=>s.id===event.documentId))pane.scope=null;
    focusSceneResult(event.documentId,direction==='undo'?event.from:event.to,event.documentId,[event.documentId]);
    const bookmark=direction==='undo'?event.selectionBefore:event.selectionAfter;
    if(bookmark){const editor=pane.editor,position=(n:number)=>pane.scope?compositePosition(editor.state.doc,event.documentId,n):Math.max(0,Math.min(n,editor.state.doc.content.size)),a=position(bookmark.anchor),h=position(bookmark.head);if(a!==null&&h!==null)editor.view.dispatch(editor.state.tr.setSelection(ManuscriptTextSelection.between(editor.state.doc.resolve(a),editor.state.doc.resolve(h))).setStoredMarks(bookmark.marks?.map(mark=>editor.schema.markFromJSON(mark))??null));}
    panes.history.complete(direction,event);pane.editor.view.focus();
  }
  function revisionCatalog(value:RevisionPasses){const p=current.current;if(!p)return;panes.history.closeGroup();authorChanged({...p,author:{...p.author,revisionPasses:value}});setCommentAnnouncement('Revision: '+(value.activeSlotId?value.slots[value.activeSlotId].name:'Off'));}
  async function revisionNavigate(direction:1|-1,all:boolean){try{const p=current.current;if(!p)return;const pass=readRevisionPasses(p),ids=revisionDocuments(p,{kind:'all'}),ranges=ids.flatMap(id=>revisionRanges(p.documents[id]).filter(r=>all||r.slotId===pass.activeSlotId).map(r=>({...r,id})));if(!ranges.length)return 'No Revision marks in this scope.';const pane=panes.active,position=pane.scope?canonicalPosition(pane.editor.state.doc,pane.editor.state.selection.from):{id:pane.documentId,pos:pane.editor.state.selection.from};const here=ids.indexOf(position?.id||'');const candidates=ranges.filter(r=>direction===1?(ids.indexOf(r.id)>here||r.id===position?.id&&r.from>position.pos):(ids.indexOf(r.id)<here||r.id===position?.id&&r.from<position.pos));const wrapped=!candidates.length,target=direction===1?(candidates[0]||ranges[0]):(candidates.at(-1)||ranges.at(-1))!;if(!routePane(p,panes.state(),target.id,true,true))return 'Both editor panes are locked. Unlock a pane to open this document.';if(!await panes.navigate(target.id,{reuse:true,preferOwner:true}))return;const editor=panes.active.editor,from=panes.active.scope?compositePosition(editor.state.doc,target.id,target.from):target.from,to=panes.active.scope?compositePosition(editor.state.doc,target.id,target.to):target.to;if(from!==null&&to!==null)editor.chain().setTextSelection({from,to}).scrollIntoView().focus().run();setCommentAnnouncement((wrapped?'Wrapped. ':'')+pass.slots[target.slotId].name+', '+p.manifest.nodes.find(n=>n.id===target.id)?.title);}catch(e){fail(e);}}
  async function revisionClear(slot:RevisionId,revision:number){if(transitioning.current||panes.active.editor.view.composing)throw Error('Finish the current operation before clearing revisions.');transitioning.current=true;setBusy(true);panes.busy=true;panes.interaction();try{await panes.pending;await flush();const p=current.current!;if(p.manifest.revision!==revision)throw Error('Project changed since confirmation. Review Clear again.');const result=await window.pagehearth.clearRevision(p.manifest.id,revision,slot);publish(result.project);saveState.current.reset();panes.sync();panes.history.push({kind:'revision-clear',id:result.operationId});setStatus('Saved');}finally{transitioning.current=false;setBusy(false);panes.busy=false;panes.interaction();}}
  async function manuscriptUndo(direction:'undo'|'redo'){
    if(transitioning.current)return;const event=panes.history.peek(direction);if(!event)return;
    if(event.kind==='prose'){applyProseHistory(direction);await panes.pending;return true;}
    if(event.kind==='revision-clear'){return run(async()=>{await panes.pending;await flush();const p=current.current!;const result=await window.pagehearth.revisionHistory(p.manifest.id,p.manifest.revision,event.id,direction);publish(result.project);saveState.current.reset();panes.sync();panes.history.complete(direction,event);setStatus('Saved');});}
    const succeeded=await run(async()=>{
      await panes.pending;await flush();const latest=await window.pagehearth.prepareScene();publish(latest);saveState.current.reset();
      const result=await window.pagehearth.sceneHistory(latest.manifest.id,latest.manifest.revision,event.id,direction);
      publish(result.project);saveState.current.reset();setStatus('Saved');
      if(direction==='undo'&&panes.active.scope?.kind==='roots'){const ids=panes.active.scope.ids;panes.active.scope={kind:'roots',ids:[...new Set(ids.flatMap(id=>result.pieceIds.includes(id)?[result.sourceId]:[id]))]};}
      focusSceneResult(result.selectedId,result.selectedFrom,result.sourceId,direction==='redo'?result.pieceIds:[result.sourceId]);
      panes.history.complete(direction,event);
    });
    await new Promise<void>(resolve=>requestAnimationFrame(()=>{if(!panes.active.editor.isDestroyed)panes.active.editor.view.focus();resolve();}));return succeeded;
  }
  commandRef.current=(command)=>{
    if(command.kind==='settings'||command.kind==='about'){shellOrigin.current=command.returnFocusWindowId??null;void executeCommand(command.kind);shellOrigin.current=null;return;}
    if(command.kind==='project-dictionary'){if(current.current)setDictionaryOpen(true);return;}
    if(command.kind==='command-palette'){openPalette();return;}
    if(command.kind==='create-scene'&&command.token){void createSelectedScene(command.token);return;}
    if((command.kind==='undo'||command.kind==='redo')&&!panes.active.editor.view.dom.contains(document.activeElement)){void window.pagehearth.nativeHistory(command.kind).catch(fail);return;}
    if(commandDescriptor(command.kind)){void executeCommand(command.kind as CommandId).then(r=>{if(r.status==='refused')setNotice(r.reason);});return;}

    if(command.kind==='document-history'){openHistory(command.id,command.take);return;}
    if(command.kind==='editor-view'){capturePosition();panes.patch({view:command.view});return;}
    if(command.kind==='comment'){void commentAction(command.action,command.id,command.token,command.anchorKind);return;}
    if(command.kind==='set-theme'){void selectApplicationTheme(command.theme).catch(fail);return;}
    if(command.kind==='add-reference'){if(editor&&!editor.state.selection.empty&&editor.view.dom.contains(document.activeElement)){const {from,to}=editor.state.selection,visibleText=editor.state.doc.textBetween(from,to,' ');referenceOpen.current=true;if(!captureOwner(editor,from,to))return;setReferenceRequest({from,to,visibleText,query:visibleText});}return;}
    if(command.kind==='remove-reference')return;
    if(transitioning.current&&command.kind!=='backup'){pendingCommand.current=command;return;}
    if(command.kind==='backup'){void (async()=>{try{if(current.current?.manifest.id===command.projectId)await flush();await window.pagehearth.scheduledBackup(command.projectId);}catch(e){await window.pagehearth.scheduledBackup(command.projectId,String(e));}})().catch(fail);}
    else if(command.kind==='open-file')void run(async()=>{try{if(!await closeToHome())return;loadProject(await window.pagehearth.openProjectPath(command.path));await refreshSettings();}finally{await window.pagehearth.openFileFinished();}});
    else if(command.kind==='open-folder')void choose(false,true);
    else if(command.kind==='recent')void openRecent(command.path);else if(command.kind==='quit')void run(()=>closeWithProtection(flush,()=>window.pagehearth.quit(),async message=>{fail(message);return window.pagehearth.closeWarning(message);}));
  };

  async function choose(create:boolean,folder=false) { await run(async()=>{ await panes.pending;await flush(); const p=await window.pagehearth.choose(create,title,folder); if(!p)return;loadProject(p);await refreshSettings(); }); }
  async function select(id:string){searchNavigation.current=false;await run(async()=>{await flush();await panes.navigate(id,{tree:true});});}

  function paletteContext():CommandContext {const p=current.current,pane=panes.active,sel=pane.editor.state.selection,a=pane.scope?canonicalPosition(pane.editor.state.doc,sel.from):{id:pane.documentId},b=pane.scope?canonicalPosition(pane.editor.state.doc,sel.to):{id:pane.documentId};const prefs=focusPreferences(p?.manifest.settings.workspace.focusPreferences),rev=p?readRevisionPasses(p):null;return {project:!!p,manuscript:!!p&&mode==='WRITE'&&writeView==='editor'&&pane.editor.isEditable,selection:!sel.empty,singleDocument:!!a&&a.id===b?.id,busy:transitioning.current,saveError:!!error,composing:pane.editor.view.composing,workspace:mode==='PUBLISH'?'publish':writeView,focus:focusMode,typewriter:prefs.typewriter,revisionActive:!!rev?.activeSlotId,revisionVisible:p?.manifest.settings.workspace.revisionMarksVisible!==false,revisionAll,split:panes.layout!=='single',locked:pane.locked,undo:!!panes.history.peek('undo'),redo:!!panes.history.peek('redo'),tree:treeVisible,inspector:inspectorVisible,pages:pane.navigator==='pages',workspaceReasons:Object.fromEntries(workspaceCommandIds.map(id=>[id,workspaceReason(id)])),catalog:rev?.slots};}
  function openPalette(){if(palette||document.querySelector('dialog[open],[aria-modal="true"]')||panes.active.editor.view.composing)return;const element=document.activeElement as HTMLElement|null;const capture=captureCommandOrigin(panes,current.current?.manifest.id);beginTransientOverlay();setPalette({element,capture});}
  async function protectedCommand(task:()=>Promise<void|CommandResult>):Promise<CommandResult>{let result:CommandResult={status:'failed'};await run(async()=>{result=await task()||{status:'completed'};});return result;}
  const completed=():CommandResult=>({status:'completed'}),opened=():CommandResult=>({status:'opened'});
  async function executeCommand(id:CommandId,origin?:NonNullable<typeof palette>):Promise<CommandResult>{
    const descriptor=commandDescriptor(id);if(!descriptor)return {status:'refused',reason:'Unknown command.'};
    const state=commandState(descriptor,paletteContext());if(!state.available){setNotice(state.reason);return {status:'refused',reason:state.reason};}
    if(origin&&(['manuscript','selection'].includes(descriptor.context))&&!validCommandOrigin(origin.capture,panes,current.current?.manifest.id)){const reason='The manuscript context changed. Select it again.';setNotice(reason);return {status:'refused',reason};}
    if(['create-scene','comment-add','comment-caret'].includes(id)){try{if(id==='create-scene')captureScene();else captureComment();}catch(e){const reason=String(e).replace(/^Error: /,'');setNotice(reason);return {status:'refused',reason};}}
    try{const handler=commandHandlers[id];if(!handler)return {status:'refused',reason:'This command is unavailable here.'};const result=await handler();if(origin&&['completed','opened'].includes(result.status)&&descriptor.safety!=='destructive'){try{setRecentCommands(await window.pagehearth.paletteRecent(id)||[]);}catch(e){setNotice('Recent commands could not be saved: '+String(e));}}return result;}catch(e){if(e instanceof RevisionCommandRefusal){setNotice(e.message);return {status:'refused',reason:e.message};}fail(e);return {status:'failed'};}
  }
  const [imageProperties,setImageProperties]=useState(false);
  const imageContextCapture=useRef<{token:string;pane:typeof panes.active;doc:typeof panes.active.editor.state.doc;selection:typeof panes.active.editor.state.selection;epoch:number}|null>(null);
  useEffect(()=>{
   (window as any).__pagehearthImageMenu=async(x:number,y:number)=>{imageContextCapture.current=null;if(mode!=='WRITE'||writeView!=='editor'||busy)return null;const hit=document.elementFromPoint(x,y);const pane=panes.panes.find(p=>hit&&p.editor.view.dom.contains(hit));if(!pane||!pane.editor.isEditable||!await panes.activate(pane))return null;const e=pane.editor,figure=hit?.closest('figure[data-manuscript-image]');if(figure){const id=(figure as HTMLElement).dataset.manuscriptImage;let pos:number|undefined;e.state.doc.descendants((n,p)=>{if(n.type.name==='manuscriptImage'&&n.attrs.id===id)pos=p;});if(pos===undefined)return null;e.commands.setNodeSelection(pos);}else if(e.state.selection.empty||e.state.selection instanceof NodeSelection){const at=e.view.posAtCoords({left:x,top:y});if(at)e.commands.setTextSelection(at.pos);}e.view.focus();const image=e.state.selection instanceof NodeSelection&&e.state.selection.node.type.name==='manuscriptImage';const token=crypto.randomUUID();imageContextCapture.current={token,pane,doc:e.state.doc,selection:e.state.selection,epoch:panes.epoch};return {token,image};};
   (window as any).__pagehearthImageAction=(token:string,action:string)=>{const c=imageContextCapture.current;imageContextCapture.current=null;if(!c||c.token!==token||c.epoch!==panes.epoch||panes.active!==c.pane||c.pane.editor.isDestroyed||c.pane.editor.state.doc!==c.doc||!c.pane.editor.state.selection.eq(c.selection))return false;const e=c.pane.editor;e.view.focus();if(action==='copy')return true;if(action==='remove'){if(e.state.selection instanceof NodeSelection&&e.state.selection.node.type.name==='manuscriptImage')e.commands.deleteSelection();return true;}if(['insert-image','paste-image','image-properties'].includes(action))void executeCommand(action as CommandId);return true;};
   return()=>{delete (window as any).__pagehearthImageMenu;delete (window as any).__pagehearthImageAction;};});
  async function insertManuscriptImage(kind:'file'|'clipboard',source?:string):Promise<CommandResult>{
   const pane=panes.active,p=current.current;if(!p)return {status:'refused',reason:'Open a project first.'};
   const editor=pane.editor,before=editor.state.doc,selection=editor.state.selection,epoch=panes.epoch;
   await panes.pending;await flush();setNotice('Importing image…');
   let item;try{item=await window.pagehearth.manuscriptImageImport(p.manifest.id,kind,source);}catch(e){setNotice(String(e).replace(/^Error: Error invoking remote method '[^']+': Error: /,'').replace(/^Error: /,''));return {status:'failed'};}if(!item){setNotice(kind==='clipboard'?'No image found on the clipboard.':'Image insertion canceled.');return {status:'canceled'};}
   let attempted=false;
   try{if(current.current?.manifest.id!==p.manifest.id||panes.epoch!==epoch||panes.active!==pane||editor.isDestroyed||editor.state.doc!==before)throw Error('Manuscript changed during image selection. Insert the image again.');
    const image=createManuscriptImage(p.manifest.id,item.asset,item.width,item.height);if(item.sourceAsset)image.attrs!.sourceAsset=item.sourceAsset;
    const replacing=selection instanceof NodeSelection&&selection.node.type.name==='manuscriptImage';const parent=selection.$from.parent.type.name;if(!replacing&&(parent!=='paragraph'||selection.$from.depth!==(pane.scope?2:1)||!selection.empty))throw Error('Place the caret in an ordinary manuscript paragraph before inserting an image.');
    if(current.current?.manifest.id!==p.manifest.id||panes.epoch!==epoch||editor.isDestroyed||editor.state.doc!==before)throw Error('Manuscript changed. Insert the image again.');
    const inserted=replacing?editor.chain().focus().setNodeSelection(selection.from).updateAttributes('manuscriptImage',{asset:item.asset,sourceAsset:item.sourceAsset??null,width:item.width,height:item.height}).run():editor.chain().focus().setTextSelection(selection.from).insertContent(image).run();if(!inserted||editor.state.doc===before)throw Error('The image could not be inserted here.');
    attempted=true;await window.pagehearth.manuscriptImageFinish(item.token,true);await panes.pending;setNotice('Image inserted. Select it and use Insert → Image properties to add alt text and a caption.');return {status:'completed'};
   }finally{if(!attempted)await window.pagehearth.manuscriptImageFinish(item.token,editor.isDestroyed||editor.state.doc!==before);}
  }
  const commandHandlers:Partial<Record<CommandId,()=>CommandResult|Promise<CommandResult>>>={
    'insert-image':()=>insertManuscriptImage('file'),'paste-image':()=>insertManuscriptImage('clipboard'),'image-properties':()=>{setImageProperties(true);return opened();},
    'command-palette':()=>{openPalette();return opened();},
    'new-project':()=>{setImportEntry(false);setTemplatesOpen('new');return opened();},'manage-templates':()=>{setTemplatesOpen('manage');return opened();},'save-template':()=>{setTemplatesOpen('save');return opened();},'import-manuscript':()=>{setImportEntry(true);setTemplatesOpen('new');return opened();},
    'open-project':()=>protectedCommand(async()=>{await panes.pending;await flush();const p=await window.pagehearth.choose(false,title,false);if(p){loadProject(p);await refreshSettings();return completed();}return {status:'canceled'};}),
    'save':async()=>{const ticket=saveFeedback.current!.begin();await panes.pending;await flush();await window.pagehearth.flushDetached();await flush();saveFeedback.current!.success(ticket);return completed();},'home':()=>protectedCommand(async()=>({status:await closeToHome()?'completed':'canceled'})),
    'undo':async()=>{const ok=await manuscriptUndo('undo');await panes.pending;panes.active.editor.view.focus();return {status:ok?'completed':'failed'};},'redo':async()=>{const ok=await manuscriptUndo('redo');await panes.pending;panes.active.editor.view.focus();return {status:ok?'completed':'failed'};},
    'enter-editor':()=>{setMode('WRITE');chooseWriteView('editor');requestAnimationFrame(()=>panes.active.editor.view.focus());return completed();},
    'continuous-selection':async()=>{return {status:await changeScope({kind:'roots',ids:treeChecked.length?treeChecked:[selection.current]})?'completed':'failed'};},'continuous-all':async()=>{return {status:await changeScope({kind:'all'})?'completed':'failed'};},'single-document':async()=>{return {status:await changeScope(null)?'completed':'failed'};},'continuous-titles':()=>{panes.patch({titles:!panes.active.titles});return completed();},
    'create-scene':async()=>{sceneCapture.current=captureScene();return {status:await createSelectedScene(sceneCapture.current.token)?'completed':'failed'};},
    'take-snapshot':()=>{openHistory(selection.current,true);return opened();},'browse-history':()=>{openHistory(selection.current,false);return opened();},
    'search-project':()=>{searchNavigation.current=true;setSearchOpen(true);return opened();},'find-manuscript':()=>{panes.active.find=true;panes.emit();return opened();},
    'focus-mode':()=>{setFocusMode(v=>!v);panes.active.editor.view.focus();return completed();},
    'quicknotes':()=>{setQuickNotesOpen(v=>!v);return opened();},'notebook':()=>{setMode('WRITE');chooseWriteView('notebook');return completed();},
    'settings':()=>{if(!shellDialog&&!document.querySelector('dialog[open]'))setShellDialog({kind:'settings',origin:shellOrigin.current});return opened();},'about':()=>{if(!shellDialog&&!document.querySelector('dialog[open]'))setShellDialog({kind:'about',origin:shellOrigin.current});return opened();},
    'shortcuts':()=>{setShortcutsOpen(true);return opened();},'import-report':()=>{setImportReportOpen(true);return opened();},
    'statistics':async()=>{await window.pagehearth.detachWorkspace('goals','statistics');return opened();},'writing-goals':async()=>{await window.pagehearth.detachWorkspace('goals','goals');return opened();},
    'tree-toggle':()=>{togglePanel('treeVisible');return completed();},'inspector-toggle':()=>{togglePanel('inspectorVisible');return completed();},'draft-pages':()=>{chooseNavigator(panes.active.navigator==='pages'?'none':'pages');return completed();},
    'editor-focus-other':async()=>{await panes.activate(panes.panes.find(p=>p!==panes.active)!,true);return completed();},'editor-lock':()=>{panes.patch({locked:true});return completed();},'editor-unlock':()=>{panes.patch({locked:false});return completed();},
    'rebuild':()=>protectedCommand(async()=>{await flush();setNotice(await window.pagehearth.rebuild());}),
    'backup-now':()=>protectedCommand(async()=>{await flush();const backup=await window.pagehearth.backupNotice();setNotice(backup.kind==='saved'?'Verified backup saved: '+backup.file:backup.message);}),
    'verify-backup':()=>protectedCommand(async()=>{const message=await window.pagehearth.verify();setNotice(message);return {status:message==='Verification canceled.'?'canceled':'completed'};}),'restore-backup':()=>protectedCommand(async()=>{await flush();const message=await window.pagehearth.restore();setNotice(message);return {status:message==='Restore canceled.'?'canceled':'completed'};}),
    'revision-visible':()=>{const p=current.current!;changed({...p,manifest:{...p.manifest,settings:{...p.manifest.settings,workspace:{...p.manifest.settings.workspace,revisionMarksVisible:p.manifest.settings.workspace.revisionMarksVisible===false}}}});return completed();},
    'revision-mark':()=>{revisionSelectionCommand(panes.active.editor,readRevisionPasses(current.current!).activeSlotId,false);return completed();},'revision-remove':()=>{revisionSelectionCommand(panes.active.editor,null,true);return completed();},
    'revision-previous':async()=>{const reason=await revisionNavigate(-1,revisionAll);return reason?{status:'refused',reason}:completed();},'revision-next':async()=>{const reason=await revisionNavigate(1,revisionAll);return reason?{status:'refused',reason}:completed();},
    'revision-manage':()=>{setRevisionRequest(v=>v+1);return opened();},'revision-clear':()=>{setRevisionRequest(v=>v+1);return opened();},
    'comment-add':async()=>{commentCapture.current=captureComment();return {status:await commentAction('add',undefined,commentCapture.current.token,'range')?'completed':'failed'};},'comment-caret':async()=>{commentCapture.current=captureComment();return {status:await commentAction('add',undefined,commentCapture.current.token,'caret')?'completed':'failed'};},
  };
  for(const id of workspaceCommandIds)commandHandlers[id]=()=>executeWorkspaceCommand(id);
  for(const [id,view] of Object.entries({'open-corkboard':'corkboard','open-outliner':'outliner','open-timeline':'timeline','open-world-bible':'world-bible','open-research':'research','open-collections':'collections'}))commandHandlers[id as CommandId]=()=>{setMode('WRITE');chooseWriteView(view as WorkspaceId);return completed();};
  for(const [id,layout] of Object.entries({'editor-single':'single','editor-side-by-side':'side-by-side','editor-stacked':'stacked','editor-close-pane':'single'}))commandHandlers[id as CommandId]=()=>protectedCommand(async()=>{await flush();await panes.setLayout(layout as 'single'|'side-by-side'|'stacked',id==='editor-close-pane'?panes.active.id:undefined);setMode('WRITE');setWriteView('editor');});
  for(const [id,action] of Object.entries({'zoom-in':'in','zoom-out':'out','zoom-reset':'reset'}))commandHandlers[id as CommandId]=async()=>{setZoom(await window.pagehearth.zoom(action as ZoomAction));return completed();};
  for(const [id,theme] of Object.entries({'theme-light':'Light','theme-dark':'Dark','theme-parchment':'Parchment','theme-system':'System'}))commandHandlers[id as CommandId]=async()=>{await selectApplicationTheme(theme);return completed();};
  for(const id of ['publish','write'] as const)commandHandlers[id]=()=>protectedCommand(async()=>{await flush();setMode(id==='publish'?'PUBLISH':'WRITE');});
  for(const id of ['text-focus-off','text-focus-sentence','text-focus-paragraph','typewriter-toggle'] as const)commandHandlers[id]=()=>{const v=focusPreferences(current.current!.manifest.settings.workspace.focusPreferences);setFocusOptions(id==='typewriter-toggle'?{...v,typewriter:!v.typewriter}:{...v,text:id==='text-focus-sentence'?'sentence':id==='text-focus-paragraph'?'paragraph':'off'});return completed();};
  for(const id of ['view-pages','view-continuous'] as const)commandHandlers[id]=()=>{capturePosition();panes.patch({view:id==='view-pages'?'pages':'continuous'});return completed();};
  for(const id of ['revision-off','revision-1','revision-2','revision-3','revision-4','revision-5'] as const)commandHandlers[id]=()=>{revisionActions.current?.choose(id==='revision-off'?null:id);return completed();};
  for(const id of ['bold','italic','underline','heading','list','align-left','align-center','align-right','indent','outdent'] as const)commandHandlers[id]=()=>{executeFormat(panes.active.editor,id);return completed();};

  function chooseWriteView(value:WorkspaceId){searchNavigation.current=false;capturePosition();setWriteView(value);const p=current.current;if(p)changed({...p,manifest:{...p.manifest,settings:{...p.manifest.settings,workspace:{...workspace(p),writeView:value}}}});}
  async function openDocument(id:string){if(await panes.navigate(id,{reuse:true})){setMode('WRITE');chooseWriteView('editor');}}
  async function openOccurrence(documentId:string,occurrenceId:string){await openDocument(documentId);requestAnimationFrame(()=>{const e=panes.active.editor;try{const range=referenceRanges(e.state.doc.toJSON()).find(r=>r.occurrenceId===occurrenceId);if(range)e.chain().focus().setTextSelection({from:range.from,to:range.to}).scrollIntoView().run();}catch(error){setNotice(String(error));}});}
  function applyReference(targetId:string){const saved=referenceFormat.current,owner=referenceOwner.current,p=current.current,pane=panes.panes.find(p=>p.editor===owner?.editor);if(!saved||!owner||!p)return;try{if(p.manifest.id!==owner.projectId||panes.epoch!==owner.epoch||!pane||pane.generation!==owner.generation||pane.documentId!==owner.documentId||JSON.stringify(p.documents[owner.documentId])!==owner.body||owner.editor.isDestroyed)throw Error('The reference source changed. Select the text again.');const target=entity(p,targetId);if(!target||target.trashed)throw Error('Reference target is missing or in Trash.');owner.editor.view.dispatch(createReferenceTransaction(owner.editor.state,saved,targetId,crypto.randomUUID()));owner.editor.view.focus();}catch(error){setNotice(String(error));}referenceOpen.current=false;setReferenceRequest(null);}
  async function sendQuickNotes(){const p=current.current;if(!p||quickSend.current)return;quickSend.current=true;setQuickSending(true);try{const sent=await commitQuickNotesSend(p,async candidate=>{authorChanged(candidate);await flush();return structuredClone(current.current!);});setQuickNotesOpen(false);setSentNote(sent.noteId);setNotice('Sent to Notebook.');}catch(e){const latest=current.current;if(latest?.manifest.id===p.manifest.id&&!latest.author.quickNotes.text&&p.author.quickNotes.text){const restored=restoreFailedQuickNotes(latest,p);publish(restored);saveState.current.markChanged();if(timer.current)clearTimeout(timer.current);try{await window.pagehearth.protectAuthor(restored.manifest.id,restored.author);}catch(protection){fail(Error(String(e)+' QuickNotes remains visible, but protection could not be updated: '+String(protection)));return;}}fail(e);}finally{quickSend.current=false;setQuickSending(false);}}
  function openNote(id:string){setNotebookTarget(id);setMode('WRITE');chooseWriteView('notebook');}
  function setScenes(value:'off'|'available'){const p=current.current;if(!p)return;const next=structuredClone(p);next.author.scenes=value;authorChanged(next);if(value==='off'&&!scopeRef.current){if(newKind==='Scene')setNewKind('Chapter');if(next.manifest.nodes.find(n=>n.id===selection.current)?.kind==='Scene'){const id=next.manifest.nodes.find(n=>!n.trashed&&n.kind!=='Scene')?.id||'';void panes.direct(panes.active,null,id).catch(fail);}}}
  async function detachSurface(surface:'inspector'|'corkboard'|'outliner'|'notebook'|'character'|'research'|'collections'|'timeline'|'goals',contextId=selected){await flush();await window.pagehearth.detachWorkspace(surface,contextId);if(surface==='character')window.dispatchEvent(new CustomEvent('world-character-detached',{detail:{entityId:contextId}}));}
  function detachCurrentWorkspace(){if(writeView==='corkboard'||writeView==='outliner'||writeView==='notebook'||writeView==='collections'||writeView==='timeline')void detachSurface(writeView,writeView==='collections'?collectionTarget||'':writeView==='timeline'?timelineTarget||'':selected);}
  function chooseNavigator(value:'none'|'pages'){searchNavigation.current=false;capturePosition();panes.patch({navigator:value});}
  function togglePanel(panel:'treeVisible'|'inspectorVisible'){capturePosition();const value=panel==='treeVisible'?!treeVisible:!inspectorVisible;if(panel==='treeVisible')setTreeVisible(value);else setInspectorVisible(value);const p=current.current;if(p)changed({...p,manifest:{...p.manifest,settings:{...p.manifest.settings,workspace:{...workspace(p),[panel]:value}}}});}
  function saveWidth(panel:'treeWidth'|'inspectorWidth',width:number){const p=current.current;if(p)changed({...p,manifest:{...p.manifest,settings:{...p.manifest.settings,workspace:{...workspace(p),[panel]:width}}}});}
  async function add(){await run(async()=>{await flush();const id=crypto.randomUUID(),p=createTreeNode(current.current!,newKind,newTitle,newParent,id);changed(p);await flush();if(!scopeRef.current)await panes.navigate(id);setNewTitle('');setCreateNode(false);const ancestors:string[]=[];let parent=p.manifest.nodes.find(n=>n.id===id)?.parent;while(parent){ancestors.push(parent);parent=p.manifest.nodes.find(n=>n.id===parent)?.parent;}window.dispatchEvent(new CustomEvent('pagehearth-reveal-document',{detail:{id,ancestors}}));});}
  async function treeChange(action:TreeAction){if((action.kind==='move'||action.kind==='relocate')){try{if(changeTree(current.current!,action)===current.current)return false;}catch(e){if(e instanceof TreeMoveRejected){setNotice(e.message);return false;}fail(e);return false;}}return await run(async()=>{await flush();if(action.kind==='delete')await window.pagehearth.backup();let p:Project;try{p=changeTree(current.current!,action);}catch(e){if(e instanceof TreeMoveRejected){setNotice(e.message);return;}throw e;}if(p===current.current)return;changed(p);await flush();if(action.kind==='restore')setNotice('Restored selected documents to the manuscript. Choose Return to Story Tree to view them.');else if(action.kind==='trash')setNotice('Selected documents moved to Trash. Use View Trash to restore them.');if(!scopeRef.current&&(!p.documents[selection.current] || (action.kind==='trash' && p.manifest.nodes.find(n=>n.id===selection.current)?.trashed))){panes.sync();panes.emit();}});}
  function collectionOpen(type:CollectionTargetType,id:string){if(type==='document')void openDocument(id);else if(type==='note')openNote(id);else if(type==='entity'){setWorldTarget(id);chooseWriteView('world-bible');}else{setResearchTarget(id);chooseWriteView('research');}}
  useEffect(()=>{const collapse=(event:Event)=>{const p=current.current;if(p)changed({...p,manifest:{...p.manifest,settings:{...p.manifest.settings,workspace:{...workspace(p),collapsed:(event as CustomEvent).detail}}}});};window.addEventListener('tree-collapse',collapse);return ()=>window.removeEventListener('tree-collapse',collapse);},[]);
  useEffect(()=>{const resume=(e:Event)=>{if(e instanceof KeyboardEvent&&e.ctrlKey&&e.shiftKey&&e.key.toLowerCase()==='f')return;if(e.isTrusted&&(e.target as HTMLElement)?.closest?.('.draft-layout,.editor-pane-header,.editor-splitter'))searchNavigation.current=false;};for(const name of ['pointerdown','wheel','keydown'])window.addEventListener(name,resume,true);return()=>{for(const name of ['pointerdown','wheel','keydown'])window.removeEventListener(name,resume,true);};},[]);
  const searchLive=useCallback(async()=>{let p=current.current!;let warning='';for(const snapshot of await window.pagehearth.searchSnapshots()){if(snapshot.project.manifest.id!==p.manifest.id)continue;const merged=reconcileProject(snapshot.base,p,snapshot.project);if(merged.project)p=merged.project;else warning='Conflicting detached edits are not combined for Search. Resolve them in the owning window.';}return {project:p,warning};},[]);
  async function searchNavigate(request:SearchRequest){const projectId=current.current?.manifest.id;if(!projectId)return;searchNavigation.current=true;if(await window.pagehearth.searchRoute(request))return;const p=current.current;if(!p||p.manifest.id!==projectId)throw Error('Project changed. Search again.');const index=new SearchIndexService();index.update(p);const resolved=index.resolve(request);if(!resolved.document)throw Error('Item no longer exists.');setNotice(resolved.document.trashed?'In Trash. Use the owning workspace’s View Trash controls; Search never restores content.':!resolved.hit?'Match changed or no longer exists.':'');const t=request.target;setMode('WRITE');
   if(t.kind==='document'){if(!await panes.navigate(t.id,{reuse:true}))return;setWriteView('editor');}
   else if(t.kind==='note'){setNotebookTarget(t.id);setWriteView('notebook');}
   else if(t.kind==='entity'){setWorldTarget(t.id);setWorldOpenRequest(v=>v+1);setWriteView('world-bible');}
   else if(t.kind==='research'){setResearchTarget(t.id);setWriteView('research');}
   else if(t.kind==='collection'){setCollectionTarget(t.id);setWriteView('collections');}
   else if(t.kind==='event'||t.kind==='track'){setTimelineTarget(t.kind==='event'?t.id:undefined);setTimelineRequest(v=>v+1);setWriteView('timeline');}
   else if(t.kind==='card'){if(!await panes.navigate(t.context!))return;setWriteView('corkboard');}
   else setQuickNotesOpen(true);
   announceSearch({...request,stale:!resolved.hit});
  }
  useEffect(()=>{const listener=(event:Event)=>{const r=(event as CustomEvent<SearchRequest>).detail;if(r.target.kind==='document'&&r.hit.field==='body')revealEditor(panes.active.editor,r);};const message=(e:Event)=>setNotice((e as CustomEvent<string>).detail);window.addEventListener('pagehearth-search-reveal',listener);window.addEventListener('pagehearth-search-message',message);return()=>{window.removeEventListener('pagehearth-search-reveal',listener);window.removeEventListener('pagehearth-search-message',message);};},[editor]);
  const focusActive=focusMode&&!!project&&mode==='WRITE'&&writeView==='editor';
  useEffect(()=>{if(!project||mode!=='WRITE'||writeView!=='editor')setFocusMode(false);},[project?.manifest.id,mode,writeView]);
  const focusOptions=focusPreferences(project?.manifest.settings.workspace.focusPreferences);
  useEffect(()=>{void window.pagehearth.focusViewState(focusOptions,!!project&&mode==='WRITE'&&writeView==='editor').catch(fail);},[focusOptions.text,focusOptions.typewriter,!!project,mode,writeView]);
  function setFocusOptions(value:FocusPreferences){panes.active.editor.view.dispatch(panes.active.editor.state.tr.setMeta(textFocusKey,{suspended:false}).setMeta('addToHistory',false));const p=current.current;if(p&&JSON.stringify(focusPreferences(p.manifest.settings.workspace.focusPreferences))!==JSON.stringify(value))changed({...p,manifest:{...p.manifest,settings:{...p.manifest.settings,workspace:{...workspace(p),focusPreferences:value}}}});}
  const [revisionAll,setRevisionAll]=useState(false);
  const revisionControl=project&&mode==='WRITE'&&writeView==='editor'?<RevisionControls actions={revisionActions} manageRequest={revisionRequest} onManageHandled={()=>setRevisionRequest(0)} all={revisionAll} onScope={setRevisionAll} project={project} onCatalog={revisionCatalog} onVisibility={()=>{const p=current.current!;changed({...p,manifest:{...p.manifest,settings:{...p.manifest.settings,workspace:{...p.manifest.settings.workspace,revisionMarksVisible:p.manifest.settings.workspace.revisionMarksVisible===false}}}});}} onMark={remove=>{try{revisionSelectionCommand(panes.active.editor,readRevisionPasses(current.current!).activeSlotId,remove);}catch(e){if(e instanceof RevisionCommandRefusal)return e.message;fail(e);}}} onNavigate={revisionNavigate} onPrepare={async()=>{capturePosition();await panes.pending;await flush();const p=await window.pagehearth.prepareScene();publish(p);saveState.current.reset();return p;}} onClear={revisionClear} onMenu={open=>{for(const pane of panes.panes)revisionSelectionCue(pane.editor,open&&pane===panes.active);}} onError={fail}/>:null;
  return <div className={'app'+(project&&mode==='WRITE'&&writeView==='editor'?' write-studio':'')+(focusActive?' focus-mode':'')}>
    {imageProperties&&<ImageProperties editor={panes.active.editor} onClose={()=>setImageProperties(false)} onReplace={()=>executeCommand('insert-image')}/>}
    {palette&&<CommandPalette context={paletteContext()} bindings={bindings} recent={recentCommands} origin={palette.element} onClose={()=>setPalette(null)} onExecute={id=>executeCommand(id,palette)}/>}
    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{commentAnnouncement}</span>
    {importReportOpen&&<ImportReport onClose={()=>setImportReportOpen(false)}/>}
    {dictionaryOpen&&project&&<ProjectDictionary project={project} onChange={authorChanged} onClose={()=>setDictionaryOpen(false)}/>}
    {templatesOpen&&<Templates importEntry={importEntry} initial={templatesOpen} onClose={()=>setTemplatesOpen(null)} onPrepare={async()=>{await flush();await window.pagehearth.prepareTemplates();}} onCreate={async(create)=>{if(!await closeToHome())return;const result=await create();loadProject(result.project);setTemplatesOpen(null);await refreshSettings();}}/>}
    {focusActive&&<div className="focus-strip-region"><div className="focus-strip" role="toolbar" aria-label="Focus controls" tabIndex={-1}>
      <button onClick={()=>{setFocusMode(false);panes.active.editor.view.focus();}} title="Exit Focus (Escape or F8)">Exit Focus</button>
      <label><span className="focus-label-full">Text Focus</span><span className="focus-label-compact" aria-hidden="true">Text</span> <select aria-label="Text Focus" value={focusOptions.text} onChange={e=>commandRef.current({kind:e.target.value==='sentence'?'text-focus-sentence':e.target.value==='paragraph'?'text-focus-paragraph':'text-focus-off'})}><option value="off">Off</option><option value="sentence">Sentence</option><option value="paragraph">Paragraph</option></select></label>
      <button aria-label={'Typewriter: '+(focusOptions.typewriter?'On':'Off')} title="Typewriter" aria-pressed={focusOptions.typewriter} onClick={()=>commandRef.current({kind:'typewriter-toggle'})}><span className="focus-label-full">Typewriter</span><span className="focus-label-compact" aria-hidden="true">Type</span>: {focusOptions.typewriter?'On':'Off'}</button>
      {revisionControl}
      <small>F6: editor / controls · Esc: exit</small>
    </div></div>}

    <ShellNavigation onThemeCommand={command=>commandRef.current(command)} revision={focusActive?null:revisionControl} mode={mode} workspace={writeView} busy={busy} hasProject={!!project} onHome={()=>void home()} onMode={m=>void run(async()=>{await flush();setMode(m);})} onWorkspace={chooseWriteView} onSearch={()=>{searchNavigation.current=true;setSearchOpen(true);}}/>
    {project&&<GlobalSearch key={project.manifest.id} project={project} open={searchOpen} onClose={()=>setSearchOpen(false)} onNavigate={searchNavigate} liveProject={searchLive}/>}
    <UpdateCenter/>{shellDialog&&<Suspense fallback={null}><ShellDialog projectSettings={project?<section className="project-settings" aria-label="Current project settings"><h3>Project settings — {project.manifest.title}</h3><p>Applies only to this project.</p><h4>Project protection</h4><label><input type="checkbox" checked={!!project.manifest.settings.backup?.daily} disabled={busy} onChange={e=>{const daily=e.target.checked;void run(async()=>{await flush();const p=await window.pagehearth.backupSettings(null,daily);if(p)publish(p);});}}/> Back up daily (24 hours after changes)</label><p className="muted">Backup folder: {project.manifest.settings.backup?.directory||'Inside this project'}</p><button disabled={busy} onClick={()=>run(async()=>{await flush();const p=await window.pagehearth.backupSettings(true,!!project.manifest.settings.backup?.daily);if(p)publish(p);})}>Choose backup folder…</button><button disabled={busy||!project.manifest.settings.backup?.directory} onClick={()=>run(async()=>{await flush();const p=await window.pagehearth.backupSettings(false,!!project.manifest.settings.backup?.daily);if(p)publish(p);})}>Use project backup folder</button><button disabled={busy} onClick={()=>run(async()=>{await flush();const backup=await window.pagehearth.backupNotice();setNotice(backup.kind==='saved'?'Verified backup saved: '+backup.file:backup.message);})}>Back up now</button><button disabled={busy} onClick={()=>run(async()=>setNotice(await window.pagehearth.verify()))}>Verify backup…</button><button disabled={busy} onClick={()=>run(async()=>{await flush();setNotice(await window.pagehearth.restore());})}>Restore Backup from ZIP…</button>{notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}</section>:undefined} kind={shellDialog.kind} zoom={zoom} onZoom={value=>void changeZoom(value)} onShortcuts={()=>{setShellDialog(null);setShortcutsOpen(true);}} onClose={()=>{const origin=shellDialog.origin;setShellDialog(null);requestAnimationFrame(()=>{void window.pagehearth.restoreShellFocus(origin).catch(fail);});}}/></Suspense>}
    {shortcutsOpen&&<KeyboardShortcuts bindings={bindings} onChange={setBindings} onClose={()=>setShortcutsOpen(false)}/>}
    <ProjectNotifications error={error} notice={notice} onRetry={()=>void executeCommand('save')} onRecover={()=>void run(recoverAndRefresh)} onDismiss={()=>{setNotice('');setSentNote(null);}} onOpen={sentNote?()=>{openNote(sentNote);setSentNote(null);setNotice('');}:undefined}/>
    {!project ? <Home recents={recents} busy={busy} onNew={()=>void executeCommand('new-project')} onOpen={()=>void executeCommand('open-project')} onRecent={openRecent} onRemove={path=>void run(async()=>{const s=await window.pagehearth.removeRecent(path);setRecents(s.recentProjects);})} onRestore={()=>void run(async()=>setNotice(await window.pagehearth.restore()))} onRecover={()=>void run(async()=>{await flush();setNotice(await window.pagehearth.importRecovery());})} onTemplates={()=>setTemplatesOpen('manage')}/> :
      <>
        <div className="workspace" style={{'--tree-col':treeVisible?`min(28vw,${treeWidth}px)`:'0px','--inspector-col':inspectorVisible?`min(28vw,${inspectorWidth}px)`:'0px'} as React.CSSProperties}>
          {mode==='WRITE' && treeVisible && <aside><PanelResize label="Story Tree" side="right" value={treeWidth} onChange={setTreeWidth} onCommit={value=>saveWidth('treeWidth',value)}/><StoryTree title={mode==='WRITE'?'STORY TREE':'BOOK CONTENT'} onAdd={mode==='WRITE'?(kind,active)=>{creationActive.current=active;setNewKind(kind);setNewParent(defaultCreationParent(current.current!,kind,active));setNewTitle('');setCreateNode(true);}:undefined} key={project.manifest.id} project={project} selected={selected} busy={busy} onSelect={select} onChange={treeChange} onCheckedChange={setTreeChecked} onContinuous={ids=>void changeScope({kind:"roots",ids})} onAddToCollection={ids=>setAddCollectionTargets(ids.map(id=>({type:'document',id})))}/>{mode==='WRITE'&&<><label className="scene-setting">Scenes <select aria-label="Scene availability" value={project.author.scenes} onChange={e=>setScenes(e.target.value as 'off'|'available')}><option value="off">Off (preserve and hide)</option><option value="available">Available</option></select></label>{createNode&&<ModalCard label={'New '+newKind} onClose={()=>setCreateNode(false)}><h2>New {newKind}</h2><label>Destination<select aria-label="Creation destination" value={newParent??''} onChange={e=>setNewParent(e.target.value||null)}><option value="">Manuscript root</option>{creationDestinations(project,newKind).map(node=><option key={node.id} value={node.id}>{creationPath(project,node.id)}</option>)}</select></label><div className="create-node"><input aria-label="New document title" placeholder="New document title" value={newTitle} onChange={e=>setNewTitle(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();void add();}}}/><div><select aria-label="Document type" value={newKind} onChange={e=>{const kind=e.target.value as TreeNode['kind'];setNewKind(kind);setNewParent(defaultCreationParent(current.current!,kind,creationActive.current));}}>{['Part','Chapter',...(project.author.scenes==='available'?['Scene']:[]),'Folder'].map(k=><option key={k}>{k}</option>)}</select><button disabled={busy} onClick={add}>Add</button></div></div><button disabled={busy} onClick={()=>setCreateNode(false)}>Cancel</button></ModalCard>}</>}</aside>}
          <main className={'writing '+(mode==='PUBLISH'?'publication':writeView==='editor'?'draft-workspace'+(navigator==='pages'?' with-pages':''):'author-workspace')}>
            {mode==='WRITE'&&writeView!=='editor'&&<div className="document-bar"><div className="document-bar-leading"><button className="panel-toggle" aria-label="Toggle Story Tree" aria-pressed={treeVisible} onClick={()=>togglePanel('treeVisible')}>Tree</button><span>{workspaceRegistry.find(x=>x.id===writeView)?.label}</span></div><div className="document-bar-actions">{mode==='WRITE'&&writeView!=='collections'&&writeView!=='timeline'&&(()=>{const targets:Pick<CollectionMember,'type'|'id'>[]=writeView==='notebook'&&notebookTarget?[{type:'note',id:notebookTarget}]:writeView==='research'&&researchTarget?[{type:'research',id:researchTarget}]:writeView==='world-bible'&&worldTarget?[{type:'entity',id:worldTarget}]:[...(treeChecked.length?treeChecked:selected?[selected]:[])].filter(id=>['Chapter','Scene'].includes(project.manifest.nodes.find(node=>node.id===id)?.kind||'')).map(id=>({type:'document' as const,id}));return targets.length?<span className="collection-shortcuts"><button onClick={()=>setAddCollectionTargets(targets)}>Add {targets.length>1?targets.length+' items ':''}to Collection…</button>{targets.length>1&&<button onClick={()=>setCreateCollectionTargets(targets)}>Create Collection from Selection…</button>}</span>:null;})()}{mode==='WRITE'&&(writeView==='corkboard'||writeView==='outliner'||writeView==='notebook'||writeView==='collections'||writeView==='timeline')&&!detached.has(writeView)&&<button className="workspace-detach" onClick={detachCurrentWorkspace}>Detach workspace</button>}<button className="panel-toggle" aria-label="Inspector" title="Inspector" aria-pressed={inspectorVisible} onClick={()=>togglePanel('inspectorVisible')}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="2" y="3" width="16" height="14" rx="2"/><path d="M12 3v14"/></svg></button></div></div>}
            {mode==='WRITE' ? writeView==='editor' ? <><EditorCommandBar onInsertImage={()=>void executeCommand('insert-image')} history={{undo:!!panes.history.peek('undo'),redo:!!panes.history.peek('redo'),run:queueManuscriptHistory}} layoutBusy={busy} layout={panes.layout} onLayout={kind=>commandRef.current({kind})} editor={editor} disabled={busy||!selected||!!project.manifest.nodes.find(n=>n.id===selected)?.trashed} navigator={navigator} onNavigator={chooseNavigator} tree={treeVisible} inspector={inspectorVisible} onTree={()=>togglePanel('treeVisible')} onInspector={()=>togglePanel('inspectorVisible')}/><SplitSurface preferences={focusOptions} panes={panes} project={project} zoom={zoom} busy={busy}/></> :
              writeView==='corkboard' ? detached.has('corkboard')?<Docked surface="corkboard" onBring={()=>window.pagehearth.detachWorkspace('corkboard',selected)} onDock={()=>window.pagehearth.dockWorkspace('corkboard')}/>:<Corkboard project={project} contextId={selected||project.manifest.nodes[0]?.id} onChange={authorChanged} onOpen={(type,id)=>type==='document'?void openDocument(id):openNote(id)} onTreeChange={action=>void treeChange(action)}/> :
              writeView==='outliner' ? detached.has('outliner')?<Docked surface="outliner" onBring={()=>window.pagehearth.detachWorkspace('outliner',selected)} onDock={()=>window.pagehearth.dockWorkspace('outliner')}/>:<Outliner project={project} selected={selected} onSelect={id=>void select(id)} onOpen={id=>void openDocument(id)} onChange={p=>{if(p.author!==project.author)authorChanged(p);else changed(p);}} onTreeChange={a=>void treeChange(a)} onMultiSelect={setTreeChecked} structureHistory={outlinerHistory.current!}/> :
              writeView==='notebook' ? detached.has('notebook')?<Docked surface="notebook" onBring={()=>window.pagehearth.detachWorkspace('notebook',selected)} onDock={()=>window.pagehearth.dockWorkspace('notebook')}/>:<Notebook project={project} target={notebookTarget} onChange={authorChanged} onTarget={setNotebookTarget} onOpenDocument={id=>void openDocument(id)}/> :
              writeView==='research' ? detached.has('research')?<Research project={project} initialItemId={researchTarget} onChange={authorChanged} detached onBring={()=>window.pagehearth.detachWorkspace('research',researchTarget||'')} onDock={()=>window.pagehearth.dockWorkspace('research')}/>:<Research project={project} initialItemId={researchTarget} onChange={authorChanged} onActive={setResearchTarget} onDetach={()=>detachSurface('research',researchTarget||'')} onOpenDocument={id=>void openDocument(id)} onOpenNote={openNote} onOpenEntity={id=>{setWorldTarget(id);chooseWriteView('world-bible')}}/> :
              writeView==='timeline' ? detached.has('timeline')?<Docked surface="timeline" onBring={()=>window.pagehearth.detachWorkspace('timeline',timelineTarget||'')} onDock={()=>window.pagehearth.dockWorkspace('timeline')}/>:<Timeline project={project} initialEventId={timelineTarget} openRequest={timelineRequest} onChange={authorChanged} onOpen={(type,id)=>collectionOpen(type,id)}/> :
              writeView==='collections' ? detached.has('collections')?<Docked surface="collections" onBring={()=>window.pagehearth.detachWorkspace('collections',collectionTarget||'')} onDock={()=>window.pagehearth.dockWorkspace('collections')}/>:<Collections project={project} initialCollectionId={collectionTarget} onChange={authorChanged} onLayoutChange={changed} onActive={setCollectionTarget} onOpen={collectionOpen}/> :
              <WorldBible project={project} initialEntityId={worldTarget} openRequest={worldOpenRequest} onChange={authorChanged} onActiveEntity={setWorldTarget} onDetach={id=>detachSurface('character',id)} detachedEntityIds={detachedEntities} onBringEntity={id=>window.pagehearth.detachWorkspace('character',id)} onDockEntity={id=>window.pagehearth.dockWorkspace('character',id)} onOpenOccurrence={(documentId,occurrenceId)=>void openOccurrence(documentId,occurrenceId)} onOpenResearch={id=>{setResearchTarget(id);chooseWriteView('research')}}/> :
              <PublishWorkspace key={project.manifest.id} project={project} onChange={authorChanged} onPublicationEdit={(id,edit)=>{const next=publicationEdit(current.current,id,edit);authorChanged(next);return next;}}/>}
          </main>
          {mode==='WRITE'&&inspectorVisible&&<aside className="inspector"><PanelResize label="Inspector" side="left" value={inspectorWidth} onChange={setInspectorWidth} onCommit={value=>saveWidth('inspectorWidth',value)}/><div className="inspector-scroll">{mode==='WRITE'?detached.has('inspector')?<Docked surface="inspector" onBring={()=>window.pagehearth.detachWorkspace('inspector',selected)} onDock={()=>window.pagehearth.dockWorkspace('inspector')}/>:<><div className="panel-title">INSPECTOR <button onClick={()=>void detachSurface('inspector')}>Detach</button></div><Inspector onComment={(id,action)=>void commentAction(action,id)} project={project} selected={selected} selectedIds={scope?[]:treeChecked} pinned={inspectorPin} onPin={setInspectorPin} onChange={p=>p.author!==project.author?authorChanged(p):changed(p)} onOpenNote={openNote} onHistory={openHistory}/></>:<><div className="panel-title">PUBLICATION</div><h3>{project.manifest.title}</h3><p>{project.manifest.nodes.length} documents</p><p>{Object.values(project.documents).reduce((sum,d)=>sum+words(d),0).toLocaleString()} words</p></>}</div></aside>}
        </div>
        <footer className="app-status"><span data-save-state={status} className={status==='Error'?'bad':''} role="status">● {status}</span><span className="manual-save-ack" role="status" aria-live="polite">{saveAcknowledged&&!error&&status==='Saved'?'✓ Saved':''}</span><button className="status-count" title="Writing Statistics" onClick={()=>openWriting('statistics')}>{mode==='WRITE'&&writeView==='notebook'?'Notebook Notes':scope?scopeDocuments(project,scope).reduce((sum,id)=>sum+words(project.documents[id]),0)+' scope words · '+scopeDocuments(project,scope).length+' documents':(project.documents[selected]?words(project.documents[selected]):0)+' document words'}</button><span className="status-context">{scope&&mode==='WRITE'?'Continuous · '+(scope.kind==='all'?'Entire Manuscript':'Selection')+' · '+(project.manifest.nodes.find(n=>n.id===selected)?.title||'Empty scope'):'Local project · '+mode}</span><div className="status-utilities">{writing.state?.showTimer&&<button onClick={openGoals} title="Open Writing Goals and Activity History">{writing.state.active?'Active':'Paused'} · {Math.floor((writing.state.days[localDay()]?.activeMs||0)/60000)}m</button>}<button title={commandBinding('quicknotes',bindings)+' · QuickNotes'} onClick={()=>setQuickNotesOpen(value=>!value)}><kbd>{commandBinding('quicknotes',bindings)}</kbd> · QuickNotes</button><StatusZoom zoom={zoom} onChange={value=>void changeZoom(value)}/></div><span className="status-hint">Ctrl+S to save</span></footer>
        {historyRequest&&project.documents[historyRequest.id]&&<HistoryBrowser key={project.manifest.id+historyRequest.id} project={project} id={historyRequest.id} take={historyRequest.take} live={()=>current.current!} onClose={closeHistory} onRestore={restoreHistory} onNew={newHistoryDocument}/>}
        {goalToast>0&&<div className="goal-toast" role="status">{goalToast===1?'Goal Reached':goalToast+' Goals Reached'} · <button onClick={()=>{setGoalToast(0);openGoals();}}>View Goals</button></div>}
        <QuickNotes sending={quickSending} shortcut={commandBinding('quicknotes',bindings)} open={quickNotes} project={project} onClose={()=>setQuickNotesOpen(false)} onChange={authorChanged} onSend={sendQuickNotes}/>
        {referenceRequest&&<ReferencePicker project={project} request={referenceRequest} onChoose={applyReference} onClose={()=>{referenceOpen.current=false;setReferenceRequest(null);const e=referenceOwner.current?.editor;if(e&&!e.isDestroyed)queueMicrotask(()=>e.view.focus());}}/>}
        {addCollectionTargets&&<AddToCollectionDialog project={project} targets={addCollectionTargets} onChange={authorChanged} onClose={()=>setAddCollectionTargets(null)}/>} {createCollectionTargets&&<CollectionCreateDialog project={project} initialMembers={createCollectionTargets} onChange={authorChanged} onCreated={id=>{setCollectionTarget(id);chooseWriteView('collections');}} onClose={()=>setCreateCollectionTargets(null)}/>}
      </>}
  </div>;
}
function Docked({surface,onBring,onDock}:{surface:string;onBring:()=>Promise<void>;onDock:()=>Promise<void>}){return <DetachedPlaceholder label={surface[0].toUpperCase()+surface.slice(1)} onBring={onBring} onDock={onDock}/>}

function DetachedApp(){
  const contextRef=useRef('');const searchBase=useRef<Project|null>(null);const [searchNotice,setSearchNotice]=useState('');
  const params=new URLSearchParams(location.search);const requested=params.get('detached') as 'inspector'|'corkboard'|'outliner'|'notebook'|'character'|'research'|'collections'|'timeline'|'goals';
  const [surface,setSurface]=useState<typeof requested>(requested);const [context,setContext]=useState('');const [contextRequest,setContextRequest]=useState(0);const [project,setProject]=useState<Project|null>(null);const [note,setNote]=useState<string|null>(null);const [pin,setPin]=useState<string|null>(null);const [error,setError]=useState('');const [alwaysOnTop,setAlwaysOnTop]=useState(false);const latest=useRef<Project|null>(null);const saveState=useRef(new ProjectDirtyState());const timer=useRef<ReturnType<typeof setTimeout>|null>(null);const saving=useRef<Promise<void>|null>(null);
  contextRef.current=context;
  function publish(p:Project){latest.current=p;setProject({...p});}
  async function flush(){await (window as any).__pagehearthGoalsFlush?.();if(timer.current)clearTimeout(timer.current);if(saving.current){await saving.current;if(saveState.current.dirty)return flush();return;}const task=(async()=>{while(saveState.current.dirty&&latest.current){const at=saveState.current.generation,candidate=structuredClone(latest.current);const result=await window.pagehearth.detachedSave(candidate),saved=result.project;if(saveState.current.acknowledge(at)){publish(saved);searchBase.current=saved;}else{const rebased=reconcileProject(candidate,structuredClone(latest.current),saved);if(!rebased.project)throw Error('Newer local edits conflict with the accepted save. They remain protected; save a recovery copy before refreshing.');publish(rebased.project);searchBase.current=saved;}}setError('');})();saving.current=task;try{await task;}finally{saving.current=null;}}
  function changed(p:Project){const before=latest.current?.author;publish(p);saveState.current.markChanged();void window.pagehearth.detachedProtectAuthor(p.manifest.id,p.author,before).catch(e=>setError(detachedErrorMessage(e)));if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>flush().catch(e=>setError(detachedErrorMessage(e))),1000);}
  useProjectSpelling(project,changed);
  async function recoverAndRefresh(){if(!latest.current)return;const canonical=await window.pagehearth.detachedResolveStale(structuredClone(latest.current));if(!canonical)return;publish(canonical);searchBase.current=canonical;saveState.current.reset();setError('');}
  useEffect(()=>{(window as any).__pagehearthFlush=flush;void window.pagehearth.detachedState().then(state=>{setSurface(state.surface);setContext(state.contextId);setAlwaysOnTop(state.alwaysOnTop);publish(state.project);searchBase.current=state.project;saveState.current.reset();}).catch(e=>setError(detachedErrorMessage(e)));const stop=window.pagehearth.onProjectUpdate(p=>{if(!saveState.current.dirty){publish(p);searchBase.current=p;}});const stopContext=window.pagehearth.onDetachedContext(id=>{const reveal=()=>{setContext(id);setContextRequest(value=>value+1);};if(requested==='timeline')void flush().then(reveal).catch(e=>setError(detachedErrorMessage(e)));else reveal();});const stopClose=window.pagehearth.onDetachedCloseRequest(()=>{void flush().then(()=>window.pagehearth.dockWorkspace(requested,contextRef.current)).catch(e=>setError(detachedErrorMessage(e)));});return()=>{delete (window as any).__pagehearthFlush;stop();stopContext();stopClose();};},[requested]);
  useEffect(()=>{(window as any).__pagehearthSearchSnapshot=()=>latest.current&&searchBase.current?{base:searchBase.current,project:latest.current}:null;const key=(e:KeyboardEvent)=>{if(commandForInput({key:e.key,control:e.ctrlKey,alt:e.altKey,shift:e.shiftKey,meta:e.metaKey,isComposing:e.isComposing})==='search-project'){e.preventDefault();void window.pagehearth.searchProject();}};window.addEventListener('keydown',key);const stop=window.pagehearth.onSearchNavigate(r=>{const p=latest.current;if(!p)return;const index=new SearchIndexService();index.update(p);const found=index.resolve(r);if(!found.document){setSearchNotice('Search item no longer exists.');return;}r={...r,stale:!found.hit};if(r.stale)setSearchNotice('Match changed or no longer exists.');if(r.target.kind==='note')setNote(r.target.id);else setContext(r.target.kind==='card'?r.target.context!:r.target.id);setContextRequest(v=>v+1);announceSearch(r);});return()=>{delete (window as any).__pagehearthSearchSnapshot;stop();window.removeEventListener('keydown',key);};},[]);
  if(error)return <main className="detached-shell"><div className="error" role="alert"><strong>PageHearth stopped this save to protect newer project data.</strong><div>{error}</div></div><button onClick={()=>void flush().catch(e=>setError(detachedErrorMessage(e)))}>Retry save</button><button onClick={()=>void recoverAndRefresh().catch(e=>setError(detachedErrorMessage(e)))}>Save recovery copy and refresh</button></main>;
  if(!project)return <main className="detached-shell"><p>Opening workspace…</p></main>;
  const active=context&&project.documents[context]?context:project.manifest.nodes.find(n=>!n.trashed)?.id||'';
  if(surface==='goals')return <><DetachedPalette project={project} workspace={surface}/><WritingUtility project={project} viewRequest={context} requestSerial={contextRequest} onClose={()=>void window.pagehearth.dockWorkspace('goals','')}/></>;
  return <main className="detached-shell"><DetachedPalette project={project} workspace={surface}/>{searchNotice&&<p role="status">{searchNotice}</p>}<header><span className="brand">PageHearth<small>Detached {surface}</small></span><div className="detached-window-actions">{surface==='research'&&<label title="Keep only this detached Research window above other windows"><input type="checkbox" checked={alwaysOnTop} onChange={event=>{const enabled=event.target.checked;void window.pagehearth.detachedAlwaysOnTop(enabled).then(setAlwaysOnTop).catch(e=>setError(detachedErrorMessage(e)))}}/> Keep on Top</label>}<button onClick={()=>void flush().then(()=>window.pagehearth.dockWorkspace(surface,context)).catch(e=>setError(detachedErrorMessage(e)))}>Dock</button></div></header>
    {surface==='inspector'?<aside className="detached-inspector editor-studio-inspector"><Inspector onComment={(id,action)=>{void flush().then(()=>window.pagehearth.commentCommand(id,action)).catch(e=>setError(String(e)));}} project={project} selected={active} pinned={pin} onPin={setPin} onChange={changed} onOpenNote={id=>{setNote(id);void window.pagehearth.detachedOpen('note',id);}}/></aside>:
    surface==='corkboard'?<Corkboard project={project} contextId={active} onChange={changed} onOpen={(type,id)=>void window.pagehearth.detachedOpen(type,id)} onTreeChange={action=>changed(changeTree(project,action))}/>:
    surface==='outliner'?<Outliner project={project} selected={active} onSelect={setContext} onOpen={id=>void window.pagehearth.detachedOpen('document',id)} onChange={changed} onTreeChange={action=>changed(changeTree(project,action))}/>:
    surface==='notebook'?<Notebook project={project} target={note} onChange={changed} onTarget={setNote} onOpenDocument={id=>void window.pagehearth.detachedOpen('document',id)}/>:
    surface==='research'?<Research project={project} initialItemId={context} onChange={changed} onActive={setContext} onOpenDocument={id=>void window.pagehearth.detachedOpen('document',id)} onOpenNote={id=>void window.pagehearth.detachedOpen('note',id)} onOpenEntity={id=>void window.pagehearth.detachedOpen('entity',id)}/>:
    surface==='timeline'?<Timeline project={project} initialEventId={context} openRequest={contextRequest} onChange={changed} onOpen={(type,id)=>void window.pagehearth.detachedOpen(type,id)}/>:
    surface==='collections'?<Collections project={project} initialCollectionId={context} onChange={changed} onLayoutChange={changed} onOpen={(type,id)=>void window.pagehearth.detachedOpen(type,id)}/>:
    <WorldBible project={project} initialEntityId={context} onChange={changed} onActiveEntity={id=>{void window.pagehearth.detachedSetContext(id).then(setContext).catch(e=>setError(detachedErrorMessage(e)));}} onOpenOccurrence={(documentId)=>void window.pagehearth.detachedOpen('document',documentId)} onOpenResearch={id=>void window.pagehearth.detachedOpen('research',id)}/>}</main>;
}
const detachedEntry=new URLSearchParams(location.search).has('detached');
startThemeRuntime();
createRoot(document.getElementById('root')!).render(detachedEntry?<DetachedApp/>:<App/>);
