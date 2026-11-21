import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

const sheet=readFileSync(new URL('../src/renderer/WorldBible.tsx',import.meta.url),'utf8');
const wave2b=readFileSync(new URL('../src/renderer/WorldBibleWave2B.tsx',import.meta.url),'utf8');
const controls=readFileSync(new URL('../src/renderer/WorldBibleControls.tsx',import.meta.url),'utf8');
const placeholder=readFileSync(new URL('../src/renderer/DetachedPlaceholder.tsx',import.meta.url),'utf8');
const renderer=readFileSync(new URL('../src/renderer/main.tsx',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main/main.ts',import.meta.url),'utf8');
const preload=readFileSync(new URL('../src/main/preload.cts',import.meta.url),'utf8');
const bridge=readFileSync(new URL('../src/shared/bridge.ts',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/renderer/worldBible.css',import.meta.url),'utf8');

describe('World Bible interaction contracts',()=>{
  it('keeps resting fields reading-first, uses a hyphen for empty values and commits click-away edits',()=>{
    expect(sheet).not.toContain('<small>{field.kind}</small>');
    expect(sheet).not.toContain('Add value');
    expect(sheet).toContain('display||<span className="muted">-</span>');
    expect(sheet).toContain('value||<span className="muted">-</span>');
    expect(sheet).toContain('onBlur={blur}');
    expect(sheet).toContain("if(event.key==='Enter'){event.preventDefault();save();}");
    expect(sheet).toContain("if(event.key==='Escape'){event.preventDefault();cancel();}");
  });

  it('keeps F6 editor entry and returns focus to the consolidated command bar',()=>{
    expect(renderer).not.toContain('>Enter Editor</button>');expect(renderer).toContain("'enter-editor':()=>");
    expect(renderer).not.toContain('>Write here</button>');
    expect(renderer).toContain("if(!e.isComposing && e.key==='F6')");
    expect(renderer).toContain("document.querySelector<HTMLElement>('[aria-label=\"Editor commands\"]')?.focus()");
  });

  it('routes Add Character Field Enter and its primary button through one guarded form submission',()=>{
    expect(sheet).toContain('if(submitting.current||!label.trim())return');
    expect(sheet).toContain('<form className="modal-form field-create-form" onSubmit={create}>');
    expect(sheet).toContain('<button className="primary" type="submit" disabled={!label.trim()}>Create</button>');
    expect(sheet.match(/createField\(project,item\.type,label,kind/g)).toHaveLength(1);
  });

  it('supports grip-only field dragging and a reserved hierarchy-navigation row on every child screen',()=>{
    expect(sheet).toContain('application/x-pagehearth-entity-field');
    expect(sheet).toContain('moveEntityField(project,id,moving,field.id,placement)');
    expect(sheet).toContain('function WorldBibleChild');
    expect(sheet).toContain('function WorldBibleWorkspace');
    expect(sheet).toContain('<div className="world-child-scroll"><div className="world-child-frame">');
    expect(sheet).toContain('<div className="world-child-frame">');
    expect(sheet).toContain('<div className="world-child-content">{children}</div>');
    expect(sheet).toContain('aria-label="Back one World Bible level"');
    expect(sheet).toContain('aria-label="Forward one World Bible level"');
    expect(sheet).toContain('<WorldBibleChild crumbs={[{label:\'World Bible\',onClick:onBack},{label:showTrash?\'Character Trash\':\'Characters\'}]}');
    expect(sheet).toContain('<WorldBibleChild crumbs={[{label:\'World Bible\',onClick:onHome},{label:\'Characters\',onClick:onBack},{label:item.name}]}');
    expect(css).toMatch(/\.world-navigation\{[^}]*flex:none[^}]*min-height:45px[^}]*align-items:center[^}]*justify-content:space-between/);
    expect(css).toMatch(/\.world-child-scroll\{[^}]*width:100%[^}]*overflow-y:auto[^}]*overflow-x:hidden/);
    expect(css).toMatch(/\.world-child-frame\{[^}]*min-height:100%[^}]*width:min\(1120px,100%\)[^}]*margin:0 auto[^}]*background:var\(--page\)/);
    expect(css).toMatch(/\.world-navigation\{[^}]*width:100%[^}]*margin:0/);
    expect(css).toMatch(/\.character-browser,\.entity-sheet\{width:100%;margin:0/);
    expect(css).toMatch(/\.world-navigation \.breadcrumbs\{[^}]*align-items:center[^}]*flex:1/);
    expect(css).toMatch(/\.world-hierarchy-controls\{[^}]*align-items:center[^}]*flex:0 0 auto[^}]*margin-left:auto/);
    expect(css).toMatch(/\.world-hierarchy-controls button\{[^}]*place-items:center[^}]*width:34px[^}]*height:34px/);
    expect(css).toMatch(/\.world-navigation\{[^}]*position:sticky[^}]*top:0/);
    expect(css).not.toContain('.sheet-navigation');
    expect(css).toContain('.structured-field[data-drop=before]');
    expect(css).toContain('.structured-field[data-drop=after]');
    expect(sheet).toMatch(/return <WorldBibleChild crumbs=\{\[\{label:'World Bible',onClick:onHome}[\s\S]*<ReferencesSection/);
  });

  it('gives the World Bible root the shared full-workspace scroll owner without adding child navigation',()=>{
    expect(sheet).toContain('return <WorldBibleWorkspace root><div className="world-bible">');
    expect(sheet.match(/className="world-navigation"/g)).toHaveLength(1);
    expect(css).toMatch(/\.world-bible\{[^}]*width:100%[^}]*overflow:visible/);
    expect(css).toMatch(/\.world-child-scroll\{[^}]*width:100%[^}]*overflow-y:auto[^}]*scrollbar-gutter:stable both-edges/);
    expect(css).toMatch(/\.world-child-frame\{[^}]*width:min\(1120px,100%\)[^}]*margin:0 auto/);
  });

  it('uses hierarchy navigation instead of Character visit history in docked and detached surfaces',()=>{
    expect(sheet).not.toContain('navigation.ids');
    expect(renderer).not.toContain('characterNavigation');
    expect(sheet).toContain("if(view==='characters')content=<CharacterBrowser");
    expect(sheet).toContain("onBack={()=>{setFeedback('');setView('home');}}");
    expect(sheet).toContain("onForward={()=>canForward&&setView('character')}");
    expect(sheet).toContain("onBack={()=>setView('characters')}");
    expect(renderer).toContain('<WorldBible project={project} initialEntityId={context}');
  });

  it('edits media captions inline and gives the primary portrait responsive visual priority without cropping',()=>{
    expect(sheet).not.toContain("prompt('Image caption'");
    expect(sheet).toContain('className="media-caption-editor"');
    expect(sheet).toContain('aria-label="Image caption"');
    expect(sheet).toContain("if(event.key==='Escape'){event.preventDefault();cancelCaption();}");
    expect(sheet).toContain("else if(event.key==='Enter'){event.preventDefault();saveCaption();}");
    expect(sheet).toContain('onBlur={captionBlur}');
    expect(sheet).toContain('className="media-caption-text"');
    expect(sheet).toContain('title={caption||undefined}');
    expect(sheet).toContain('aria-label={caption?`Caption: ${caption}`:undefined}');
    expect(css).toMatch(/\.media-tile figcaption\{[^}]*text-align:center/);
    expect(css).toMatch(/\.media-caption-text\{[^}]*overflow:hidden[^}]*text-overflow:ellipsis[^}]*white-space:nowrap[^}]*text-align:center/);
    expect(sheet).not.toContain('<strong>Primary</strong>');
    expect(sheet.match(/className="media-primary-badge"/g)).toHaveLength(1);
    expect(sheet).toContain('aria-label="Primary image"');
    expect(sheet).toContain('{primary&&<span className="media-primary-badge"');
    expect(css).toMatch(/\.media-thumbnail\{position:relative/);
    expect(css).toMatch(/\.media-primary-badge\{position:absolute;top:7px;left:7px/);
    expect(css).toMatch(/\.entity-portrait\{[^}]*width:clamp\(190px,22vw,240px\)[^}]*object-fit:contain/);
    expect(css).toMatch(/\.media-tile img\{[^}]*height:150px/);
  });

  it('reorders media only from its grip, exposes both insertion edges and keeps arrows as the locked-aware alternative',()=>{
    expect(sheet).toContain('application/x-pagehearth-entity-media');
    expect(sheet).toContain('moveMedia(project,id,moving,media.id,placement)');
    expect(sheet).toContain('className="media-drag-handle drag-handle"');
    expect(sheet).toContain('draggable={!layoutLocked} disabled={layoutLocked}');
    expect(sheet).toContain("closest<HTMLElement>('figure.media-tile')");
    expect(sheet).toContain('event.dataTransfer.setDragImage(card,x,y)');
    expect(sheet).toContain("setDrop(event.clientX<rect.left+rect.width/2?'before':'after')");
    expect(sheet).toContain('disabled={!canUp||layoutLocked}');
    expect(sheet).toContain('disabled={!canDown||layoutLocked}');
    expect(css).toContain('.media-tile[data-drop=before]');
    expect(css).toContain('.media-tile[data-drop=after]');
  });

  it('confirms successful Character Trash, returns to Characters, focuses the category and preserves failures on the sheet',()=>{
    expect(sheet).toContain("const completeCharacterTrash=(next:Project)=>{onChange(next);setFeedback('Character moved to Trash');setView('characters');}");
    expect(sheet).toContain("function moveCharacterToTrash(){setActionError('');try{onTrashed(trashEntity(project,id));}catch(error){setActionError");
    expect(sheet).toContain('className="world-feedback" role="status" aria-live="polite"');
    expect(sheet).toContain('className="world-action-error" role="alert"');
    expect(sheet).toContain('<h1 ref={heading} tabIndex={-1}>');
    expect(sheet).toContain('if(notice)heading.current?.focus()');
  });

  it('allows registered detached surfaces to read media and always offers deliberate manual reference selection',()=>{
    expect(main).toContain("projectHandle('read-project-asset'");
    expect(main).toContain("projectHandle('choose-entity-media'");
    expect(main).toContain("projectHandle('commit-entity-media'");
    expect(renderer).toContain("import {ReferencePicker");
    expect(renderer).toContain('<ReferencePicker');
    expect(renderer).not.toMatch(/item\.type==='character'.*item\.name\.toLocaleLowerCase\(\)\.includes\(query/);
  });

  it('preserves Wave 2B categories and activates the accepted Wave 2C categories',()=>{
    expect(sheet).toContain("['Locations','Places, settings, and regions.','location']");
    expect(sheet).toContain("['Bestiary','Creatures and monsters.','bestiary']");
    expect(sheet).toContain("['Factions','Groups and organizations.','faction']");
    expect(sheet).toContain("['Lore','History, cultures, beliefs, events, and canonical knowledge.','lore']");
    expect(sheet).toContain("['Glossary','Terms, names, phrases, titles, and vocabulary.','glossary']");
    expect(sheet).toContain("['Systems / Magic','Rules, powers, technologies, institutions, and frameworks.','system']");
    expect(sheet).toContain('<WorldBibleWave2B');
    expect(sheet).toContain('onOpenEntity={openEntity}');
  });

  it('keeps deep Location ancestry semantic when visual breadcrumbs collapse',()=>{
    expect(wave2b).toContain("type==='location'&&ancestorCrumbs.length>=2");
    expect(wave2b).toContain("hidden:ancestorCrumbs");
    expect(wave2b).toContain('aria-label="Show hidden Location ancestors"');
    expect(wave2b).toContain('role="menuitem"');
    expect(wave2b).toContain('useTransientPopover(ancestors,setAncestors,ancestryRoot,ancestryTrigger)');
    expect(wave2b).toContain('ref={ancestryTrigger} aria-haspopup="menu"');
    expect(wave2b).toContain('useEffect(()=>setAncestors(false),[route])');
    expect(controls).toContain("window.addEventListener('pointerdown',outside)");
    expect(controls).toContain("if(event.key==='Escape'){event.preventDefault();setOpen(false);trigger.current?.focus();}");
    expect(wave2b).toContain("const goBack=()=>{if(page!=='entity')return");
    expect(wave2b).toContain('setForwardIds(values=>rememberForward(active,values))');
    expect(wave2b).toContain("disabled={!canForward} onClick={()=>{setAncestors(false);onForward?.();}}");
    expect(css).toContain('.ancestry-menu{position:absolute');
  });

  it('provides keyboard alternatives and safe explicit controls for Location hierarchy movement',()=>{
    expect(wave2b).toContain('role="tree" aria-label="Locations"');
    expect(wave2b).toContain('role="treeitem" aria-level={level}');
    expect(wave2b).toContain('aria-label={`Move ${item.name} to parent`}');
    expect(wave2b).toContain('aria-label="Search parent Locations"');
    expect(wave2b).toContain('Unassigned Locations is a system view, not a Location record.');
    expect(wave2b).toContain("mode==='subtree'");
    expect(wave2b).toContain("mode==='unassigned'");
    expect(wave2b).toContain("mode==='reparent'");
  });

  it('keeps Sightings, Story Links, exact References and Primary Location usage visibly distinct',()=>{
    expect(wave2b).toContain('Sightings are manually recorded observations');
    expect(wave2b).toContain('References, metadata, relationships, and matching prose never create them.');
    expect(wave2b).toContain('Deliberate semantic associations. Exact manuscript occurrences appear under References.');
    expect(wave2b).toContain('No explicit references. Matching prose is never counted.');
    expect(wave2b).toContain('explicit Primary Location');
  });

  it('uses the accepted reading-first, media and detached contracts for all Wave 2B sheets',()=>{
    expect(wave2b).toContain("value||<span className=\"muted\">-</span>");
    expect(wave2b).toContain("if(e.key==='Escape'){e.preventDefault();cancel();}");
    expect(wave2b).toContain("else if(e.key==='Enter'){e.preventDefault();save();}");
    expect(wave2b).toContain('className="media-caption-text"');
    expect(wave2b).toContain('title={media.caption||undefined}');
    expect(wave2b).toContain('>Replace</button>');
    expect(wave2b).toContain('aria-label="Primary image"');
    expect(main).toContain("surfaceTitle=surface==='character'?(targetEntity?.name||'World Bible')");
    expect(main).toContain("title:'Choose a World Bible image'");
  });

  it('exposes persistent Wave 2B browsing filters, faction sort and member-count presentation',()=>{
    expect(wave2b).toContain('aria-label="Filter by Record Type"');
    expect(wave2b).toContain('aria-label="Filter by Location or Territory"');
    expect(wave2b).toContain('<option value="location">Location / Territory</option>');
    expect(wave2b).toContain('<option value="memberCount">Member Count</option>');
    expect(wave2b).toContain('Members and leadership derive only from explicit relationships.');
    expect(wave2b).not.toContain('parentFactionId');
  });

  it('uses entity-keyed detached windows, one-live-surface placeholders and exact lifecycle events',()=>{
    expect(main).toContain('detachedWindowKey(surface,store.project.manifest.id,contextId,targetEntity?.type)');
    expect(main).toContain("surface==='character'&&!targetEntity");
    expect(renderer).toContain("new CustomEvent('world-character-detached',{detail:{entityId:contextId}})");
    expect(wave2b).toContain('const detach=async(id:string)=>{if(!onDetach)return;await onDetach(id);showCategory();}');
    expect(wave2b).toContain('onDetach(item.id).catch(error=>setActionError');
    expect(main).toContain("win.webContents.send('workspace-detached',surface,contextId)");
    expect(main).toContain("win.webContents.send('workspace-docked','character',previous)");
    expect(renderer).toContain('detachedEntityIds={detachedEntities}');
    expect(sheet).toContain('detached={detachedEntityIds?.has(active)}');
    expect(wave2b).toContain('detachedEntityIds?.has(item.id)');
    expect(placeholder).toContain('Only one live copy is shown. Closing the detached window docks it here again.');
    expect(placeholder).toContain('>Bring to front</button>');
    expect(placeholder).toContain('>Dock here</button>');
  });

  it('provides responsive category cards, readable field labels and shared anchored action menus',()=>{
    expect(css).toContain('.category-grid{grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:1fr;align-items:stretch}');
    expect(css).toContain('.category-card{width:100%;height:100%;min-width:0;min-height:112px');
    expect(css).toContain('@container(max-width:760px){.category-grid{grid-template-columns:1fr;grid-auto-rows:auto}');
    expect(controls).toContain('<FieldTypePicker label="Field Type"');
    expect(wave2b).toContain('FIELD_TYPE_LABELS[field.kind]');
    expect(wave2b).not.toContain('<details><summary>Actions</summary>');
    expect(sheet).not.toContain('<details><summary>Actions</summary>');
    expect(css).toContain('.entity-actions-popover');
  });

  it('offers explicit clipboard/file media import and makes the dragged source card vacate',()=>{
    expect(main).toContain("projectHandle('paste-entity-media'");
    expect(main).toContain('firstClipboardPng(await clipboard.read()');
    expect(main).toContain("extension:'.png'");
    expect(controls).toContain('Paste from Clipboard');
    expect(controls).toContain('Choose Image File…');
    expect(wave2b).toContain("placement:event.clientY<rect.top+rect.height/2?'before':'after'");
    expect(wave2b).toContain("placement:event.clientX<rect.left+rect.width/2?'before':'after'");
    expect(sheet).toContain('window.requestAnimationFrame(onDragStart)');
    expect(wave2b).toContain('window.requestAnimationFrame(()=>setDragging(field.id))');
    expect(wave2b).toContain('window.requestAnimationFrame(()=>setDragging(media.id))');
    expect(css).toContain('.structured-field.is-dragging,.media-tile.is-dragging{opacity:0}');
    expect(css).not.toContain('.structured-field.is-dragging,.media-tile.is-dragging{visibility:hidden}');
  });

  it('duplicates only an explicitly selected active entity from the current category',()=>{
    expect(wave2b).toContain("candidates=project.author.worldBible!.entities.filter(item=>item.type===type&&!item.trashed)");
    expect(wave2b).toContain('Duplicate Existing');
    expect(wave2b).toContain("if(mode==='duplicate'){if(!sourceId)return;await staged.discard();const made=duplicateProfile(project,sourceId)");
    expect(sheet).toContain('<fieldset className="creation-method"><legend>Creation method</legend>');
    expect(wave2b).toContain('<fieldset className="creation-method"><legend>Creation method</legend>');
    expect(css).toContain('.modal-form .creation-method label{display:inline-flex;align-items:center');
  });

  it('keeps shared Manage Fields geometry stable while advanced options change',()=>{
    expect(controls).toContain('export function FieldDefinitionCreate');
    expect(sheet).toContain('<FieldDefinitionCreate label={label} onLabel={setLabel} kind={kind} onKind={setKind} options={fieldOptions} onOptions={setFieldOptions} onCreate={addField}/>');
    expect(wave2b).toContain('<FieldDefinitionCreate label={label} onLabel={setLabel} kind={kind} onKind={setKind} options={options} onOptions={setOptions} onCreate={addField}/>');
    expect(controls).toContain('<FieldTypePicker label="Field Type"');
    expect(controls).toContain("advanced?'Fewer Field Types':'More Field Types…'");
    expect(css).toContain('grid-template-areas:"label type" "create more" "choices choices"');
    expect(css).toContain('.field-definition-create>.field-type-picker{display:contents}');
    expect(css).toContain('.field-definition-create>.field-type-picker select{width:100%;min-width:0}');
    expect(css).toContain('.field-definition-create>.primary{grid-area:create;justify-self:start;align-self:start}');
    expect(css).toContain('grid-template-areas:"label" "type" "more" "choices" "create"');
  });

  it('stages every New Entity primary image through the shared clipboard/file chooser',()=>{
    expect(controls).toContain('export function ImageSourceMenu');
    expect(controls).toContain('Paste from Clipboard');
    expect(controls).toContain('Choose Image File…');
    expect(controls).toContain("source==='clipboard'?await window.pagehearth.pasteEntityMedia():await window.pagehearth.chooseEntityMedia()");
    expect(sheet).toContain('staged=useStagedEntityImage()');
    expect(sheet).toContain('<ImageSourceMenu disabled={busy||staged.busy}');
    expect(wave2b).toContain('staged=useStagedEntityImage()');
    expect(wave2b).toContain('<ImageSourceMenu disabled={busy||staged.busy}');
    expect(wave2b).toContain("createEntity(project,type,name,template)");
    expect(wave2b).toContain("type==='location'");
    expect(wave2b).toContain("type==='bestiary'");
    expect(wave2b).toContain("ENTITY_LABELS[type]");
  });

  it('discards canceled temporary image tokens and commits only after Create',()=>{
    expect(bridge).toContain('discardEntityMedia(token:string):Promise<void>');
    expect(preload).toContain("discardEntityMedia:(token:string)=>ipcRenderer.invoke('discard-entity-media',token)");
    expect(main).toContain("projectHandle('discard-entity-media'");
    expect(main).toContain('pendingMedia.delete(token)');
    expect(controls).toContain('if(token.current)void window.pagehearth.discardEntityMedia(token.current)');
    expect(controls).toContain('if(prior)await window.pagehearth.discardEntityMedia(prior)');
    expect(sheet).toContain('await staged.discard();onClose()');
    expect(wave2b).toContain('await staged.discard();onClose()');
    expect(sheet.indexOf("createEntity(project,'character',name,template)")).toBeLessThan(sheet.indexOf('commitEntityMedia(staged.image.token)'));
    expect(wave2b.indexOf('createEntity(project,type,name,template)')).toBeLessThan(wave2b.indexOf('commitEntityMedia(staged.image.token)'));
    expect(sheet).toContain('addMedia(result.project,result.id,imported.path)');
    expect(wave2b).toContain('addMedia(next,made.id,imported.path)');
    expect(sheet).toContain('staged.consumed()');
    expect(wave2b).toContain('staged.consumed()');
  });
});
