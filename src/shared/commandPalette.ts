import {appCommands,commandBinding,type CommandDescriptor,type CommandId,type Keybindings} from './commands.js';
export type CommandContext={project:boolean;manuscript:boolean;selection:boolean;singleDocument:boolean;busy:boolean;saveError?:boolean;composing:boolean;detached?:boolean;workspace:string;focus:boolean;typewriter:boolean;revisionActive:boolean;revisionVisible:boolean;revisionAll:boolean;split:boolean;locked:boolean;undo:boolean;redo:boolean;tree:boolean;inspector:boolean;pages:boolean;workspaceReasons?:Partial<Record<CommandId,string>>;catalog?:Record<string,{name:string}>};
export function commandState(c:CommandDescriptor,x:CommandContext){
 let label=c.label,reason='';
 if(c.id==='focus-mode')label=x.focus?'Exit Focus Mode':'Enter Focus Mode';
 if(c.id==='typewriter-toggle')label=x.typewriter?'Disable Typewriter Scrolling':'Enable Typewriter Scrolling';
 if(c.id==='revision-visible')label=x.revisionVisible?'Hide Revision Marks':'Show Revision Marks';
 if(c.id==='tree-toggle')label=x.tree?'Hide Story Tree':'Show Story Tree';
 if(c.id==='inspector-toggle')label=x.inspector?'Hide Inspector':'Show Inspector';
 if(c.id==='draft-pages')label=x.pages?'Hide Draft Pages':'Show Draft Pages';
 if(x.catalog?.[c.id])label='Use '+x.catalog[c.id].name;
 if(x.busy)reason='Finish the current operation first.';
 // Error presentation is not mutation-lane ownership. Only canonical Save may retry it.
 else if(x.saveError&&c.id!=='save')reason='Retry Save or resolve the project error first.';
 else if(x.composing)reason='Finish text composition first.';
 else if(x.detached&&!['new-project','open-project','settings','about','command-palette','search-project','zoom-in','zoom-out','zoom-reset'].includes(c.id))reason='Use this command in the main window.';
 else if(x.workspaceReasons?.[c.id])reason=x.workspaceReasons[c.id]!;
 else if(c.context!=='any'&&!x.project)reason='Open a project first.';
 else if(['manuscript','selection'].includes(c.context)&&!x.manuscript)reason='Open the editable WRITE manuscript.';
 else if(c.context==='selection'&&!x.selection)reason='Select manuscript text first.';
 else if(['comment-add','comment-caret','create-scene','revision-mark','revision-remove'].includes(c.id)&&!x.singleDocument)reason='Keep the selection within one document.';
 else if(c.id==='comment-caret'&&x.selection)reason='Place a caret first.';
 else if(c.id==='revision-mark'&&!x.revisionActive)reason='Turn on a Revision pass first.';
 else if(['revision-previous','revision-next'].includes(c.id)&&!x.revisionAll&&!x.revisionActive)reason='Turn on a Revision pass first.';
 else if(c.id==='undo'&&!x.undo||c.id==='redo'&&!x.redo)reason='No manuscript history in this direction.';
 else if(['editor-focus-other','editor-lock','editor-unlock','editor-close-pane'].includes(c.id)&&!x.split)reason='Split the editor first.';
 else if(c.id==='editor-lock'&&x.locked||c.id==='editor-unlock'&&!x.locked)reason='The pane already has this lock state.';
 return {label,reason,available:!reason};
}
const normalize=(s:string)=>s.normalize('NFKC').toLocaleLowerCase('en-US').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function matchCommand(text:string,query:string):number|null{
 const t=normalize(text),q=normalize(query);if(!q)return 0;if(t===q)return 0;if(t.startsWith(q))return 100+t.length-q.length;
 const words=t.split(' '),tokens=q.split(' ');if(tokens.every(token=>words.some(word=>word.startsWith(token))))return 200+t.length;
 let last=-1,gaps=0;for(const ch of q.replaceAll(' ','')){const at=t.indexOf(ch,last+1);if(at<0)return null;gaps+=at-last-1;last=at;}return 400+gaps;
}
export function paletteResults(query:string,context:CommandContext,bindings:Keybindings,recent:readonly string[],commands:readonly CommandDescriptor[]=appCommands){
 const empty=!query.trim();return commands.flatMap((c,index)=>{if(c.palette==='hidden'||empty&&c.palette==='search-only')return [];const state=commandState(c,context);if(empty&&!state.available)return [];
 const label=matchCommand(state.label,query),other=matchCommand([c.group,...c.keywords].join(' '),query);const score=label??(other===null?null:10000+other);if(score===null)return [];
 const affinity=context.manuscript&&['Manuscript','Format','Revision','Comments'].includes(c.group)?0:context.workspace==='world-bible'&&c.group==='Worldbuilding'?0:['corkboard','outliner','timeline','collections'].includes(context.workspace)&&c.group==='Planning'?0:context.workspace==='notebook'&&c.id==='notebook'?0:1;
 const at=recent.indexOf(c.id),rank=at<0?100:at;return [{...c,...state,binding:commandBinding(c.id,bindings),score,affinity,rank,index,recent:at>=0}];}).sort((a,b)=>empty?a.rank-b.rank||a.affinity-b.affinity||a.index-b.index:a.score-b.score||a.affinity-b.affinity||a.rank-b.rank||a.index-b.index);
}
export type {CommandId};
