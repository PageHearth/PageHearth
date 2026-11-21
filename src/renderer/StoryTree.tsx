import {treeDropPlacement,moveDestinations} from '../shared/treeMoving';
import {creationPath} from '../shared/treeCreation';
import {TemporaryTreeNotice} from './temporaryTreeNotice';
import {useTransientPopover} from './WorldBibleControls';
import {ModalCard} from './ModalCard';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Project,TreeNode } from '../shared/model';
import { changeTree, TreeMoveRejected, type TreeAction } from '../shared/tree';

export function StoryTree({project,selected,busy,onSelect,onChange,onCheckedChange,onAddToCollection,onContinuous,onAdd,title='STORY TREE'}:{project:Project;selected:string;busy:boolean;onSelect:(id:string)=>void;onChange:(action:TreeAction)=>Promise<void|boolean>;onCheckedChange?:(ids:string[])=>void;onAddToCollection?:(ids:string[])=>void;onContinuous?:(ids:string[])=>void;onAdd?:(kind:Project['manifest']['nodes'][number]['kind'],active:string|null)=>void;title?:string}){
  const nodes=project.manifest.nodes;
  const [moveNotice,setMoveNotice]=useState('');
  const [treeNotice]=useState(()=>new TemporaryTreeNotice(setMoveNotice));
  useEffect(()=>()=>treeNotice.dispose(),[treeNotice]);
  const [help,setHelp]=useState(false),anchor=useRef(selected);
  const [adding,setAdding]=useState(false),addRoot=useRef<HTMLDivElement>(null),addTrigger=useRef<HTMLButtonElement>(null);useTransientPopover(adding,setAdding,addRoot,addTrigger);useEffect(()=>{if(adding)addRoot.current?.querySelector<HTMLButtonElement>('[role=menuitem]:not(:disabled)')?.focus();},[adding]);

  const [multiple,setMultiple]=useState<string[]>([]);
  const [active,setActive]=useState<string|null>(selected);
  const [dropHint,setDropHint]=useState<{id:string;placement:'before'|'after'|'inside'}|null>(null);
  const [renaming,setRenaming]=useState<string|null>(null);
  const [name,setName]=useState('');
  const [moveDialog,setMoveDialog]=useState<string[]|null>(null),[moveParent,setMoveParent]=useState('');
  const dragging=useRef<string[]>([]);
  const workspace=project.manifest.settings.workspace;
  const [closed,setClosed]=useState(Array.isArray(workspace.collapsed)?workspace.collapsed as string[]:[]);
  const [trash,setTrash]=useState(false);
  const [context,setContext]=useState<{id:string;ids:string[];x:number;y:number}|null>(null);
  useEffect(()=>{const reveal=(event:Event)=>{const {id,ancestors}=(event as CustomEvent<{id:string;ancestors:string[]}>).detail;setTrash(false);setActive(id);setClosed(previous=>previous.filter(key=>!ancestors.includes(key)));requestAnimationFrame(()=>document.getElementById('tree-'+id)?.scrollIntoView({block:'nearest'}));};window.addEventListener('pagehearth-reveal-document',reveal);return()=>window.removeEventListener('pagehearth-reveal-document',reveal);},[]);
  const menu=useRef<HTMLDivElement>(null);
  const visible=nodes.filter(n=>!!n.trashed===trash && (project.author.scenes==='available'||n.kind!=='Scene'));
  const ids=(multiple.length?multiple:active?[active]:[]).filter(id=>visible.some(n=>n.id===id));
  function rows(parent:string|null,depth=0):{id:string;depth:number}[]{return visible.filter(n=>n.parent===parent || (parent===null && !visible.some(p=>p.id===n.parent))).flatMap(n=>[{id:n.id,depth},...(!closed.includes(n.id)?rows(n.id,depth+1):[])]);}
  const entries=rows(null);
  function focus(id:string){document.getElementById('tree-'+id)?.focus();}
  function collapse(id:string,value:boolean){if(busy)return;const next=value?[...new Set([...closed,id])]:closed.filter(x=>x!==id);setClosed(next);window.dispatchEvent(new CustomEvent('tree-collapse',{detail:next}));}
  function closeContext(){if(context)focus(context.id);setContext(null);}
  function showContext(id:string,x:number,y:number){
    if(busy)return;
    // A right-click outside the checked group targets only that row; it never silently adds other documents.
    const targets=multiple.includes(id)?multiple.filter(x=>visible.some(n=>n.id===x)):[id];
    setContext({id,ids:targets,x:Math.max(0,Math.min(x,window.innerWidth-240)),y:Math.max(0,Math.min(y,window.innerHeight-180))});
  }
  useEffect(()=>{
    if(!context)return;
    menu.current?.querySelector<HTMLElement>('[role=menuitem]:not(:disabled)')?.focus();
    const outside=(event:PointerEvent)=>{if(!menu.current?.contains(event.target as Node))setContext(null);};
    document.addEventListener('pointerdown',outside,true);
    return ()=>document.removeEventListener('pointerdown',outside,true);
  },[context]);
  useEffect(()=>{if(busy)setContext(null);},[busy]);
  function setChecked(ids:string[]){setMultiple(ids);onCheckedChange?.(ids);}
  function range(id:string){const from=entries.findIndex(e=>e.id===anchor.current),to=entries.findIndex(e=>e.id===id);setChecked(entries.slice(Math.min(from<0?to:from,to),Math.max(from<0?to:from,to)+1).map(e=>e.id));}
  function toggleSelected(id:string,includeActive=false){const base=multiple.length?multiple:includeActive&&anchor.current&&anchor.current!==id?[anchor.current]:[];setChecked(base.includes(id)?base.filter(x=>x!==id):[...base,id]);anchor.current=id;}
  async function act(action:TreeAction){
    if(busy)return false;
    const moving=action.kind==='move'||action.kind==='relocate';let preview=project;
    if(moving){treeNotice.dismiss();try{preview=changeTree(project,action);if(preview===project)return true;}catch(e){if(e instanceof TreeMoveRejected){treeNotice.show(e.message);return false;}await onChange(action);return false;}}
    const result=await onChange(action);if(result===false)return false;
    if(moving){
      const id=active&&action.ids.includes(active)?active:action.ids[0];const ancestors=new Set<string>();
      for(const moved of action.ids){let parent=preview.manifest.nodes.find(n=>n.id===moved)?.parent;while(parent&&!ancestors.has(parent)){ancestors.add(parent);parent=preview.manifest.nodes.find(n=>n.id===parent)?.parent;}}
      setClosed(old=>old.filter(key=>!ancestors.has(key)));setActive(id);
      requestAnimationFrame(()=>{focus(id);document.getElementById('tree-'+id)?.scrollIntoView({block:'nearest'});});
    }else setChecked([]);
    setRenaming(null);return true;
  }
  function placement(node:TreeNode,y:number,rect:DOMRect,shift:boolean){
    const roots=dragging.current.filter(id=>{const n=nodes.find(n=>n.id===id);return !n?.parent||!dragging.current.includes(n.parent);});
    return treeDropPlacement(node.kind,(y-rect.top)/Math.max(1,rect.height),shift,roots.includes(node.id));
  }
  async function confirmMove(){if(!moveDialog)return;const ok=await act({kind:'relocate',ids:moveDialog,parent:moveParent||null});if(ok)setMoveDialog(null);}

  function rename(targets:string[]){if(busy || targets.length!==1)return;const id=targets[0];setActive(id);setName(nodes.find(n=>n.id===id)?.title || '');setRenaming(id);}
  function cancelRename(id:string){setRenaming(null);requestAnimationFrame(()=>focus(id));}
  async function saveRename(id:string){await act({kind:'rename',id,title:name});requestAnimationFrame(()=>focus(id));}
  async function remove(targets:string[]){if(busy || !targets.length)return;if(await window.pagehearth.confirmDelete(targets.length))await act({kind:'delete',ids:targets});}
  // Toolbar and context menu share these handlers, including confirmation and the existing backup-before-delete path.
  function actions(targets:string[],contextual=false){
    const role=contextual?'menuitem':undefined;
    const invoke=(fn:()=>unknown)=>{if(contextual)closeContext();void fn();};
    const eligible=targets.filter(id=>nodes.some(n=>n.id===id&&!n.trashed&&['Chapter','Scene'].includes(n.kind)));
    return <>{contextual&&!trash&&onContinuous&&targets.length>0&&<button role={role} onClick={()=>invoke(()=>onContinuous(targets))}>Open as Continuous Manuscript</button>}{contextual&&!trash&&eligible.length>0&&onAddToCollection&&<button role={role} onClick={()=>invoke(()=>onAddToCollection(eligible))}>Add to Collection…</button>}{contextual&&!trash&&<button role={role} disabled={busy||!targets.length} onClick={()=>invoke(()=>{setMoveParent('');setMoveDialog([...targets]);})}>Move to…</button>}<button role={role} disabled={busy || targets.length!==1} onClick={()=>invoke(()=>rename(targets))}>Rename</button>{trash?<><button role={role} disabled={busy || !targets.length} onClick={()=>invoke(()=>act({kind:'restore',ids:targets}))}>Restore</button><button role={role} disabled={busy || !targets.length} onClick={()=>invoke(()=>remove(targets))}>Delete permanently…</button></>:<button role={role} disabled={busy || !targets.length} onClick={()=>invoke(()=>act({kind:'trash',ids:targets}))}>Move to Trash</button>}</>;
  }
  function key(e:KeyboardEvent<HTMLDivElement>,id:string,index:number){
    if(busy)return;
    const node=nodes.find(n=>n.id===id)!;
    if(e.key==='ContextMenu' || (e.shiftKey && e.key==='F10')){e.preventDefault();const rect=e.currentTarget.getBoundingClientRect();showContext(id,rect.left,rect.bottom);return;}
    if(e.key===' '&&(e.ctrlKey||e.metaKey)){e.preventDefault();toggleSelected(id);return;}
    if(e.key==='Escape'){setChecked([]);return;}
    if(e.key==='F2'){e.preventDefault();rename([id]);return;}
    if(e.key==='Enter' && e.target instanceof HTMLInputElement){e.preventDefault();onSelect(id);return;}
    if(e.key==='ArrowUp' || e.key==='ArrowDown'){
      e.preventDefault();const direction=e.key==='ArrowUp'?-1:1;
      if(e.altKey){const siblings=visible.filter(x=>x.parent===node.parent);const other=siblings[siblings.findIndex(x=>x.id===id)+direction];if(other)void act({kind:'move',ids:multiple.includes(id)?multiple:[id],target:other.id,placement:direction<0?'before':'after'});}
      else if(entries[index+direction]){if(e.shiftKey)range(entries[index+direction].id);else anchor.current=entries[index+direction].id;focus(entries[index+direction].id);}
    }
    if(e.key==='Home'){e.preventDefault();if(entries[0]){if(e.shiftKey)range(entries[0].id);else anchor.current=entries[0].id;focus(entries[0].id);}}
    if(e.key==='End'){e.preventDefault();if(entries.length){if(e.shiftKey)range(entries.at(-1)!.id);else anchor.current=entries.at(-1)!.id;focus(entries.at(-1)!.id);}}
    if(e.key==='ArrowRight' || e.key==='ArrowLeft'){e.preventDefault();collapse(id,e.key==='ArrowLeft');}
  }
  return <div className="tree" tabIndex={-1} aria-label="Story Tree background" onClick={e=>{
    if((e.target as HTMLElement).closest('.tree-entry,button,input,form,dialog,select,summary,.tree-context'))return;
    setActive(null);setContext(null);e.currentTarget.focus();
  }}>
    {moveNotice&&<div className="tree-operation-notice"><span role="status">{moveNotice}</span><button type="button" aria-label="Dismiss Story Tree message" title="Dismiss Story Tree message" onClick={()=>treeNotice.dismiss()}>×</button></div>}
    <div className="tree-header"><span className="panel-title">{title}</span><div className="tree-actions"><button aria-label="Story Tree Help" title="Story Tree Help" onClick={()=>setHelp(true)}>?</button>{onAdd&&<div className="tree-add" ref={addRoot}><button ref={addTrigger} title="Add Chapter or Scene" aria-label="Add Chapter or Scene" aria-haspopup="menu" aria-expanded={adding} disabled={busy||trash} onClick={()=>setAdding(!adding)} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setAdding(true);}}}>+</button>{adding&&<div role="menu" aria-label="Add document" onKeyDown={e=>{if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const items=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role=menuitem]:not(:disabled)')],at=items.indexOf(document.activeElement as HTMLButtonElement);items[e.key==='Home'?0:e.key==='End'?items.length-1:(at+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}}}>{(['Chapter',...(project.author.scenes==='available'?['Scene']:[]),'Part','Folder'] as const).map(kind=><button key={kind} role="menuitem" onClick={()=>{setAdding(false);addTrigger.current?.focus();onAdd(kind as Project['manifest']['nodes'][number]['kind'],active);}}>New {kind}</button>)}</div>}</div>}<button disabled={busy} aria-pressed={trash} aria-label={trash?'Return to Story Tree':'View Trash'} title={trash?'Return to Story Tree':'View Trash'} onClick={()=>{setTrash(!trash);setChecked([]);setRenaming(null);setContext(null);}}><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 5h14M7 5V2h6v3M5 5l1 13h8l1-13M8 8v7M12 8v7"/></svg></button></div></div>
    {!entries.length && <p role="status">{trash?'Trash is empty.':'No active documents. View Trash to find removed documents.'}</p>}
    <div role="group" aria-label={trash?'Trashed documents':'Story documents'}>{entries.map(({id,depth},index)=>{
      const n=nodes.find(n=>n.id===id)!;const children=visible.some(c=>c.parent===id);
      return <div key={id} className="tree-entry" data-kind={n.kind} style={{paddingLeft:`min(${depth*12}px, max(0px, calc(100% - 100px)))`}} onFocus={()=>setActive(id)} onKeyDown={e=>key(e,id,index)} onClick={e=>{if(e.target===e.currentTarget)focus(id);}} onContextMenu={e=>{e.preventDefault();showContext(id,e.clientX,e.clientY);}}>
        <button className="tree-disclosure" style={children?undefined:{visibility:'hidden'}} tabIndex={children?0:-1} aria-hidden={!children} aria-label={(closed.includes(id)?'Expand ':'Collapse ')+n.title} aria-expanded={!closed.includes(id)} onClick={()=>collapse(id,!closed.includes(id))}>{closed.includes(id)?'▸':'▾'}</button>
        {renaming===id?<form id={'tree-'+id} className={'tree-rename '+(active===id?'selected':'')} onSubmit={e=>{e.preventDefault();void saveRename(id);}} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();cancelRename(id);}}}><input autoFocus aria-label="Document name" value={name} onChange={e=>setName(e.target.value)}/><button disabled={busy}>Save name</button><button type="button" disabled={busy} onClick={()=>cancelRename(id)}>Cancel</button></form>:<button id={'tree-'+id} className={'tree-row '+(active===id?'selected':'')+(multiple.includes(id)?' multi-selected':'')} aria-pressed={multiple.includes(id)} data-drop={dropHint?.id===id?dropHint.placement:undefined} aria-current={selected===id?'true':undefined} tabIndex={active===id || (!entries.some(e=>e.id===active) && index===0)?0:-1} aria-disabled={busy} draggable={!busy && !trash}
          onDragStart={e=>{dragging.current=multiple.includes(id)?multiple:[id];e.dataTransfer.setData('text/plain',JSON.stringify(dragging.current));}}
          onDragOver={e=>{if(busy || trash)return;e.preventDefault();const rect=e.currentTarget.getBoundingClientRect();setDropHint({id,placement:placement(n,e.clientY,rect,e.shiftKey)});}}
          onDragLeave={()=>setDropHint(null)} onDragEnd={()=>{setDropHint(null);dragging.current=[];}}
          onDrop={e=>{e.preventDefault();setDropHint(null);if(busy || trash)return;try{const ids=JSON.parse(e.dataTransfer.getData('text/plain'));const rect=e.currentTarget.getBoundingClientRect();if(Array.isArray(ids) && ids.every(id=>typeof id==='string')){dragging.current=ids;const where=placement(n,e.clientY,rect,e.shiftKey);dragging.current=[];void act({kind:'move',ids,target:id,placement:where});}}catch{/* External text drops do not mutate the tree. */}}} onClick={e=>{if(busy)return;setActive(id);if(e.shiftKey)range(id);else if(e.ctrlKey||e.metaKey)toggleSelected(id,true);else{if(e.detail!==0)setChecked([]);anchor.current=id;onSelect(id);}}}>{<span className="tree-title" title={n.title}>{n.title}</span>}</button>}
      </div>;
    })}</div>
    {dropHint&&<div className="tree-drop-description" role="status">{dropHint.placement==='inside'?'Nest inside':dropHint.placement==='before'?'Insert before':'Insert after'}: {nodes.find(n=>n.id===dropHint.id)?.title}</div>}
    {moveDialog&&<ModalCard label="Move documents" onClose={()=>setMoveDialog(null)}><h2>Move {moveDialog.length===1?nodes.find(n=>n.id===moveDialog[0])?.title:moveDialog.length+' selected items'}</h2>{moveNotice&&<p role="status">{moveNotice}</p>}<form onSubmit={e=>{e.preventDefault();void confirmMove();}}><label>Destination<select aria-label="Move destination" value={moveParent} onChange={e=>setMoveParent(e.target.value)}><option value="">Manuscript root</option>{moveDestinations(project,moveDialog).map(node=><option key={node.id} value={node.id}>{creationPath(project,node.id)}</option>)}</select></label><p>Moves the selected items with their complete subtrees. Root moves go to the end; nested moves go before existing children.</p><button type="submit" disabled={busy}>Move</button><button type="button" disabled={busy} onClick={()=>setMoveDialog(null)}>Cancel</button></form></ModalCard>}
    {help&&<ModalCard label="Story Tree Help" className="tree-help-dialog" onClose={()=>setHelp(false)}><h2>Story Tree Help</h2><p>Arrows/Home/End move focus; Enter opens. Left/Right collapse/expand; Alt+↑/↓ reorders siblings.</p><p>Ctrl-click toggles group selection; Shift-click selects a visible range. Ctrl+Space toggles the focused row; Shift+Arrows/Home/End extends a range. Escape clears the group. A plain click selects one item; blank space clears active focus but preserves the selected group.</p><p>Use + to add a Chapter, Scene, Part or Folder. The destination defaults to the active Part or Folder; Scenes default to the active Chapter (or the active Scene’s parent). Check Destination in the dialog, or choose Manuscript root to create a top-level item. F2 renames. Right-click or Shift+F10 opens Rename, Move to Trash, Restore and confirmed permanent deletion where valid. A context click outside the selected group targets only that row.</p><p>Move to Trash affects the selected group, or the active row, and descendants. View Trash only switches views. Restore returns documents to the manuscript; permanent deletion requires confirmation.</p><p>Drag to the center of a Part or Folder to nest; upper/lower edges insert before/after. Other rows reorder by upper/lower half. Shift + drop also nests. Use right-click or Shift+F10 → Move to… for a destination list or Manuscript root. A selected group moves together. Existing nesting protections remain in effect.</p><button onClick={()=>setHelp(false)}>Close</button></ModalCard>}
    {context && <div className="tree-context" ref={menu} role="menu" aria-label={'Actions for '+(context.ids.length===1?nodes.find(n=>n.id===context.id)?.title:context.ids.length+' selected documents')} style={{left:context.x,top:context.y}} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setContext(null);}} onKeyDown={e=>{
      if(e.key==='Escape'){e.preventDefault();closeContext();}
      else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const items=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role=menuitem]:not(:disabled)')];const at=items.indexOf(document.activeElement as HTMLButtonElement);items[e.key==='Home'?0:e.key==='End'?items.length-1:(at+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}
    }}><div className="tree-help">{context.ids.length===1?nodes.find(n=>n.id===context.id)?.title:context.ids.length+' selected documents'}</div>{actions(context.ids,true)}</div>}
  </div>;
}
