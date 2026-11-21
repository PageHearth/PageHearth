import {describe,expect,it} from 'vitest';
import {promises as fs} from 'node:fs';
import {clampResearchPaneWidths,clampResearchZoom,pdfPreviewUrl,parseResearchZoom,resizeResearchPane,stepResearchZoom} from '../src/renderer/researchView';

describe('Wave 2D native-acceptance Research repairs',()=>{
  it('uses five-percent image steps, arbitrary direct entry and safe bounds',()=>{
    expect(stepResearchZoom(100,1)).toBe(105);
    expect(stepResearchZoom(105,-1)).toBe(100);
    expect(parseResearchZoom('135%',100)).toBe(135);
    expect(parseResearchZoom(' 87 ',100)).toBe(87);
    expect(parseResearchZoom('broken',100)).toBe(100);
    expect(clampResearchZoom(1)).toBe(25);
    expect(clampResearchZoom(999)).toBe(400);
  });

  it('creates reversible PDF viewer URLs for repeated zoom, fit and page changes',()=>{
    const source='file:///C:/Book/source.pdf';
    expect(pdfPreviewUrl(source,7,100,'manual')).toBe(`${source}#page=7&zoom=100`);
    expect(pdfPreviewUrl(source,7,105,'manual')).toBe(`${source}#page=7&zoom=105`);
    expect(pdfPreviewUrl(source,7,110,'manual')).toBe(`${source}#page=7&zoom=110`);
    expect(pdfPreviewUrl(source,7,100,'manual')).toBe(`${source}#page=7&zoom=100`);
    expect(pdfPreviewUrl(source,7,135,'width')).toBe(`${source}#page=7&zoom=page-width`);
    expect(pdfPreviewUrl(source,7,135,'page')).toBe(`${source}#page=7&zoom=page-fit`);
  });

  it('clamps keyboard and pointer Research pane resizing to a visible preview',()=>{
    expect(resizeResearchPane({organizerWidth:190,libraryWidth:320},'organizer',50,1200)).toEqual({organizerWidth:240,libraryWidth:320});
    expect(clampResearchPaneWidths({organizerWidth:900,libraryWidth:900},900)).toEqual({organizerWidth:368,libraryWidth:220});
    expect(clampResearchPaneWidths({organizerWidth:1,libraryWidth:1},1400)).toEqual({organizerWidth:140,libraryWidth:220});
  });

  it('exposes real creation dialogs, visible Tags, fit controls and non-sticky Research chrome',async()=>{
    const source=await fs.readFile('src/renderer/Research.tsx','utf8'),styles=await fs.readFile('src/renderer/style.css','utf8');
    expect(source).toContain("setCreating('web')");
    expect(source).toContain("setCreating('text')");
    expect(source).toContain("setCreating('folder')");
    expect(source).toContain('<h3>Tags</h3>');
    expect(source).toContain('Fit Image');
    expect(source).toContain('Save PDF Location');
    expect(source).not.toContain('prompt(`Label for page');
    expect(source).toContain('style={imageFit?undefined:{width:`${zoom}%`}}');
    expect(styles).toContain('.research-workspace{height:100%;min-height:0;display:block;overflow:auto');
    expect(styles).not.toMatch(/\.research-source>header\{position:sticky/u);
  });

  it('uses native file preview URLs with the packaged PDF viewer enabled',async()=>{
    const main=await fs.readFile('src/main/main.ts','utf8');
    expect(main).toContain('previewUrl:pathToFileURL(file).href');
    expect(main.match(/plugins:true/gu)).toHaveLength(2);
    const research=await fs.readFile('src/renderer/Research.tsx','utf8');
    expect(research).toContain("if(item.type==='pdf')setSrc(result.exists?result.previewUrl:'')");
    expect(research).toContain('<PdfViewport preview={preview}');
    const viewport=await fs.readFile('src/renderer/PdfViewport.tsx','utf8');expect(viewport).toContain('memo(');expect(viewport).toContain('<embed key={preview}');expect(viewport).not.toContain('onScroll');
    expect(research).toContain('label="PDF zoom percentage"');
  });

  it('provides safe transient folder actions and explicit blank-pane selection clearing',async()=>{
    const source=await fs.readFile('src/renderer/Research.tsx','utf8');
    expect(source).toContain('aria-haspopup="menu"');
    expect(source).toContain('useTransientPopover(open,setOpen,root,trigger)');
    expect(source).toContain('New Subfolder');
    expect(source).toContain('Remove Folder…');
    expect(source).toContain('No Research item, asset, note, tag, or link will be deleted.');
    expect(source).toContain('data-testid="research-folder-blank"');
    expect(source).toContain('data-testid="research-list-blank"');
  });

  it('uses project-persisted keyboard-accessible pane separators and clipping-safe cards',async()=>{
    const source=await fs.readFile('src/renderer/Research.tsx','utf8'),styles=await fs.readFile('src/renderer/style.css','utf8');
    expect(source.match(/role="separator"/gu)).toHaveLength(1);
    expect(source).toContain('updateResearchLayout(latestProject.current,paneWidths.current)');
    expect(source).toContain('Resize Research organization pane');
    expect(source).toContain('Resize Research library pane');
    expect(styles).toContain('.research-list>button{width:100%;min-width:0;max-width:100%;overflow:hidden}');
    expect(styles).toContain('.research-separator:hover::after');
  });

  it('renders removable Research backlinks on Character, built-in and custom entity sheets',async()=>{
    const files=await Promise.all(['src/renderer/WorldBible.tsx','src/renderer/WorldBibleWave2B.tsx','src/renderer/CustomWorldBible.tsx'].map(file=>fs.readFile(file,'utf8')));
    for(const source of files){expect(source).toContain("researchBacklinks(project,'entity'");expect(source).toContain('Open Research source');expect(source).toContain('removeResearchLink(');expect(source).toContain('className="reference-source"');expect(source).toContain('className="reference-actions"');}
  });

  it('keeps detached Research always-on-top opt-in and project-local',async()=>{
    const main=await fs.readFile('src/main/main.ts','utf8'),renderer=await fs.readFile('src/renderer/main.tsx','utf8');
    expect(main).toContain("entry[1].surface!=='research'");
    expect(main).toContain('researchKeepOnTop');
    expect(renderer).toContain('Keep on Top');
    expect(renderer).toContain('detachedAlwaysOnTop(enabled)');
  });

  it('puts Add and Manage Category controls together at the top of World Bible home',async()=>{
    const source=await fs.readFile('src/renderer/WorldBible.tsx','utf8');
    expect(source).toContain('<div className="world-home-actions"><StudioButton variant="primary" onClick={()=>setAdding(true)}>+ Add Category</StudioButton><StudioButton variant="quiet" onClick={()=>setManaging(true)}>Manage Categories</StudioButton></div>');
  });
});
