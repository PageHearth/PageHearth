import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../src/renderer/style.css',import.meta.url),'utf8');
const indentation=readFileSync(new URL('../src/renderer/indentation.ts',import.meta.url),'utf8');
const inspector=readFileSync(new URL('../src/renderer/Inspector.tsx',import.meta.url),'utf8');
const tagInput=readFileSync(new URL('../src/renderer/TagInput.tsx',import.meta.url),'utf8');
const outliner=readFileSync(new URL('../src/renderer/Outliner.tsx',import.meta.url),'utf8');
const notebook=readFileSync(new URL('../src/renderer/Notebook.tsx',import.meta.url),'utf8');
const corkboard=readFileSync(new URL('../src/renderer/Corkboard.tsx',import.meta.url),'utf8');
const panelResize=readFileSync(new URL('../src/renderer/PanelResize.tsx',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/renderer/main.tsx',import.meta.url),'utf8');

describe('WRITE and Notebook editing conventions',()=>{
  it('keeps ordinary WRITE paragraphs contiguous while scoping restrained Note spacing to Notebook',()=>{
    expect(css).toMatch(/\.draft-scroll \.tiptap p\{margin-block:0\}/);
    expect(css).toMatch(/\.note-editor \.tiptap\{line-height:1\.45\}/);
    expect(css).toMatch(/\.note-editor \.tiptap p\{margin-block:0 \.18em\}/);
  });
  it('retains semantic first-line indentation without paragraph margin or padding',()=>{
    expect(indentation).toContain('text-indent:');
    expect(indentation).not.toMatch(/margin|padding|\t/);
  });
  it('uses illustrative metadata placeholders without assigning saved values',()=>{
    expect(inspector).toContain('placeholder="Draft, Needs Revision, Revised…"');
    expect(inspector).toContain('placeholder="mystery, foreshadowing, research"');
    expect(inspector).toContain('value={currentData.status}');
    expect(inspector).toContain('value={currentData.tags}');
    expect(tagInput).toContain('parseTags(text)');
  });
  it('keeps each Outliner grip in a fixed control slot and preserves explicit move labels',()=>{
    expect(css).toMatch(/\.structure-controls\{display:grid;grid-template-columns:26px 18px 26px/);
    expect(outliner).toContain('className="structure-controls"');
    expect(outliner).toContain('Drag to reorder manuscript: ');
    expect(outliner).toContain('↶ Undo move');
    expect(outliner).toContain('↷ Redo move');
  });
  it('shares buffered tag entry with Notebook Details instead of rebuilding typed text',()=>{
    expect(notebook).toContain('<TagInput label="Note tags"');
    expect(tagInput).toContain('setText(event.target.value)');
    expect(tagInput).toContain('onChange={event=>setText(event.target.value)}');
    expect(tagInput).toContain('setTimeout(');
    expect(tagInput).toContain('onBlur={event=>commit(event.target.value)}');
    expect(notebook).not.toMatch(/value=\{selected\.tags\.join[^\n]+split\(','\)/);
  });
  it('exposes independently keyboard-resizable Notebook panes and conventional task geometry',()=>{
    expect(notebook.match(/<PaneResize/g)).toHaveLength(2);
    expect(panelResize).toContain('role="separator"');
    expect(panelResize).toContain("event.key==='Home'");
    expect(css).toMatch(/\.notebook-workspace\{grid-template-columns:[^}]*--notebook-nav[^}]*--notebook-list/);
    expect(css).toMatch(/ul\[data-type=taskList\]>li\[data-checked\]\{display:grid;grid-template-columns:20px minmax\(0,1fr\)/);
    expect(css).toMatch(/li\[data-checked\]>label input\[type=checkbox\]\{[^}]*width:16px!important;[^}]*height:16px;[^}]*margin:0;[^}]*padding:0/);
  });
  it('uses theme tokens for Corkboard cards and separates structural from visual movement',()=>{
    expect(css).toContain('--card-neutral-bg:');
    expect(css).toMatch(/:root\[data-appearance=dark\]\{--card-neutral-bg:/);
    expect(corkboard).toContain('application/x-pagehearth-manuscript');
    expect(corkboard).toContain("onTreeChange({kind:'move'");
    expect(corkboard).toContain('onPointerDown={event=>beginCardDrag(event,card)}');
  });
  it('makes shared-field deletion and Corkboard structure versus planning actions explicit',()=>{
    expect(inspector).toContain("section('custom','Custom Fields'");
    expect(inspector).toContain('Manage shared project fields');
    expect(inspector).toContain("'Delete '+field.label+' from project'");
    expect(corkboard).toContain('MANUSCRIPT STRUCTURE');
    expect(corkboard).toContain('INDEPENDENT PLANNING BOARD');
    expect(corkboard).toContain("disabled={settings.mode==='manuscript'}");
    expect(corkboard).toContain('Switch to Freeform Planning to move this visual card');
    expect(corkboard).toContain("isPeeked?'Close Peek':'Peek'");
    expect(css).toContain('.card-topline{display:grid');
    expect(css).toContain('.card-drag-handle{position:static');
  });
  it('routes custom-field Enter and the button through one guarded creation handler',()=>{
    expect(inspector).toContain('function submitField(){');
    expect(inspector).toContain('fieldCreateLocked.current||!fieldName.trim()||!fieldKinds.length');
    expect(inspector).toContain("event.key==='Enter'&&!event.repeat&&!event.nativeEvent.isComposing");
    expect(inspector).toContain('event.preventDefault();submitField();');
    expect(inspector).toContain('onClick={submitField}>Create field</button>');
    expect(inspector.match(/createCustomField\(project,fieldName,fieldKinds\)/g)).toHaveLength(1);
  });
  it('shows canonical Corkboard context and supports accessible custom card colors',()=>{
    expect(corkboard).toContain("contextNode?.kind==='Scene'");
    expect(corkboard).toContain("contextParent.title+' › '");
    expect(corkboard).toContain('aria-label={contextLabel}');
    expect(corkboard).toContain('<option value="custom">Custom…</option>');
    expect(corkboard).toContain('aria-label="Custom card color picker"');
    expect(corkboard).toContain('aria-label="Custom card color hex"');
    expect(css).toContain('.planning-card.color-custom{background:color-mix');
    expect(css).toContain(':root[data-appearance=dark] .planning-card.color-custom');
  });
  it('keeps selected Outliner columns compact with truncated labels and aligned controls',()=>{
    expect(outliner).toContain('className="column-label-text" title={label}');
    expect(css).toMatch(/\.column-order\{display:flex;flex-wrap:wrap;align-items:stretch;gap:8px/);
    expect(css).toMatch(/\.column-order li\{[^}]*flex:0 1 230px;width:230px;max-width:100%/);
    expect(css).toMatch(/\.column-label-text\{[^}]*overflow:hidden;text-overflow:ellipsis;white-space:nowrap/);
    expect(css).toMatch(/\.column-controls\{display:flex;align-items:center;gap:4px/);
  });
  it('groups each project custom field vertically with its delete action inside the box',()=>{
    expect(inspector).toContain('className="project-field-delete"');
    expect(css).toMatch(/\.project-field-entry\{display:flex;flex-direction:column;align-items:stretch;gap:8px/);
    expect(css).toMatch(/\.project-field-entry \.project-field-delete\{align-self:flex-start/);
    expect(css).toMatch(/\.project-field-entry>\.field-delete-confirm\{width:100%\}/);
  });
});
