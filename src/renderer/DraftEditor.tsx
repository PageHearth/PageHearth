import {TextSelection,type Transaction} from '@tiptap/pm/state';
import {draftPageKey,firstOffsetOnLine,draftPageGap,draftPagePadding} from './draftPagePresentation';
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { EditorContent, type Editor } from '@tiptap/react';
import { activeDraftPage, draftBoundaries, safePosition, type DraftPosition } from '../shared/draft';

export type DraftHandle = { capture(): DraftPosition };
type Props = {hideDocumentTitles?:boolean; editor: Editor; ready: boolean; title: string; navigator: 'none' | 'pages'; view?:'pages'|'continuous'; zoom: number; initial?: DraftPosition; onPosition: (position: DraftPosition)=>void };
export const DraftEditor = forwardRef<DraftHandle,Props>(function DraftEditor({editor,ready,title,navigator,view='pages',zoom,initial,onPosition,hideDocumentTitles=false},ref){
  const scroll=useRef<HTMLDivElement>(null);const content=useRef<HTMLDivElement>(null);const rail=useRef<HTMLDivElement>(null);
  const [gaps,setGaps]=useState<number[]>([]);
  const [boundaries,setBoundaries]=useState([0]);const [active,setActive]=useState(0);const [offset,setOffset]=useState(0);
  const initialized=useRef(false);const restoring=useRef(true);const positionCallback=useRef(onPosition);positionCallback.current=onPosition;
  const lastWidth=useRef(0);const layoutAnchor=useRef<{pos:number;offset:number}|null>(null);
  function rememberLayoutAnchor(){const el=scroll.current;if(!el || restoring.current)return;const bounds=el.getBoundingClientRect();const prose=editor.view.dom.getBoundingClientRect();const hit=editor.view.posAtCoords({left:prose.left+Math.min(20,prose.width/2),top:bounds.top+12});if(hit)layoutAnchor.current={pos:hit.pos,offset:editor.view.coordsAtPos(hit.pos).top-bounds.top};}
  const capture=():DraftPosition=>({scrollTop:scroll.current?.scrollTop ?? 0,anchor:editor.state.selection.anchor,head:editor.state.selection.head});
  useImperativeHandle(ref,()=>({capture}));
  useLayoutEffect(()=>{
    if(initialized.current)return;restoring.current=true;
    if(!ready)return;initialized.current=true;
    const saved=safePosition(initial,editor.state.doc.content.size);
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc,saved.anchor,saved.head)));
    let second=0;const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>{if(scroll.current)scroll.current.scrollTop=saved.scrollTop;restoring.current=false;});});
    return ()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);};
  },[editor,ready]);
  useEffect(()=>{
    const node=content.current;const scroller=scroll.current;if(!node || !scroller)return;
    let frame=0;let observedWidth=-1;
    const measure=()=>{
      cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
        const prose=node.querySelector<HTMLElement>('.tiptap');if(!prose||editor.isDestroyed||editor.view.composing)return;
        const started=performance.now(),savedScroll=scroller.scrollTop;const selectedPos=editor.state.selection.head;const caretOffset=editor.view.coordsAtPos(selectedPos).top-scroller.getBoundingClientRect().top;const keepCaret=prose.contains(document.activeElement)&&caretOffset>=0&&caretOffset<scroller.clientHeight;
        if(draftPageKey.getState(editor.state)?.find().length)editor.view.dispatch(editor.state.tr.setMeta(draftPageKey,[]).setMeta('addToHistory',false));
        let rect=prose.getBoundingClientRect();
        if(lastWidth.current && Math.abs(lastWidth.current-rect.width)>1 && layoutAnchor.current && !restoring.current){const anchor=layoutAnchor.current;const pos=Math.min(anchor.pos,editor.state.doc.content.size);scroller.scrollTop+=editor.view.coordsAtPos(pos).top-scroller.getBoundingClientRect().top-anchor.offset;}
        lastWidth.current=rect.width;node.style.setProperty('--draft-page-min-height',Math.max(300,rect.width*1.42+100)+'px');
        rect=prose.getBoundingClientRect();
        const lines:number[]=[];const textLines:{top:number;node:Node}[]=[];const blocks:{top:number;pos:number}[]=[];let bottom=0;
        const walker=document.createTreeWalker(prose,NodeFilter.SHOW_TEXT);
        while(walker.nextNode()){if(walker.currentNode.parentElement?.closest('[data-manuscript-ui]'))continue;
          const range=document.createRange();range.selectNodeContents(walker.currentNode);
          for(const line of range.getClientRects()){lines.push(line.top-rect.top);textLines.push({top:line.top-rect.top,node:walker.currentNode});bottom=Math.max(bottom,line.bottom-rect.top);}
        }
        for(const child of prose.querySelectorAll('p,h1,h2,h3,li,pre,blockquote,figure.manuscript-image')){const bounds=child.getBoundingClientRect();bottom=Math.max(bottom,bounds.bottom-rect.top);if(!child.textContent||child.matches('figure.manuscript-image')){lines.push(bounds.top-rect.top);blocks.push({top:bounds.top-rect.top,pos:editor.view.posAtDOM(child,0)});}}
        const origin=rect.top-scroller.getBoundingClientRect().top+scroller.scrollTop;
        let pages=draftBoundaries(Math.max(1,bottom),rect.width,lines);
        if(view==='pages'){
          const positions:number[]=[];
          for(const top of pages.slice(1)){
            const line=textLines.find(line=>Math.abs(Math.round(line.top)-top)<1),block=blocks.find(block=>Math.abs(Math.round(block.top)-top)<1);
            if(line){const range=document.createRange(),text=line.node;const offset=firstOffsetOnLine(text.textContent?.length||0,rect.top+line.top,index=>{range.setStart(text,index);range.setEnd(text,Math.min(index+1,text.textContent?.length||0));return range.getBoundingClientRect().top;});positions.push(editor.view.posAtDOM(text,offset));}
            else if(block)positions.push(block.pos);
          }
          editor.view.dispatch(editor.state.tr.setMeta(draftPageKey,[...new Set(positions)]).setMeta('addToHistory',false));
          const nodeTop=node.getBoundingClientRect().top,proseTop=prose.getBoundingClientRect().top;
          const markers=[...prose.querySelectorAll<HTMLElement>('[data-draft-gap]')];
          setGaps(markers.map(marker=>marker.getBoundingClientRect().top-nodeTop+draftPagePadding));
          pages=[0,...markers.map(marker=>marker.getBoundingClientRect().bottom-proseTop)];
          // Decoration transactions never create document/protection updates.
        }else setGaps([]);
        scroller.scrollTop=savedScroll;if(keepCaret)scroller.scrollTop+=editor.view.coordsAtPos(selectedPos).top-scroller.getBoundingClientRect().top-caretOffset;
        node.dataset.layoutMs=(performance.now()-started).toFixed(2);node.dataset.pageCount=String(pages.length);
        setOffset(origin);setBoundaries(pages);setActive(activeDraftPage(pages,scroller.scrollTop-origin));
      });
    };
    const observer=new ResizeObserver(()=>{const width=node.getBoundingClientRect().width;if(width!==observedWidth){observedWidth=width;measure();}});observer.observe(node);observer.observe(scroller);
    const editorDOM=editor.view.dom;const changed=({transaction}:{transaction:Transaction})=>{if(transaction.docChanged)measure();};editor.on('transaction',changed);editorDOM.addEventListener('compositionend',measure);editorDOM.addEventListener('load',measure,true);document.fonts.addEventListener('loadingdone',measure);measure();
    return ()=>{observer.disconnect();editor.off('transaction',changed);editorDOM.removeEventListener('compositionend',measure);editorDOM.removeEventListener('load',measure,true);document.fonts.removeEventListener('loadingdone',measure);cancelAnimationFrame(frame);};
  },[editor,navigator,zoom,view,title]);
  useEffect(()=>{const save=()=>{if(!restoring.current){positionCallback.current(capture());if(scroll.current){const top=editor.view.coordsAtPos(editor.state.selection.head).top-scroll.current.getBoundingClientRect().top+scroll.current.scrollTop-offset;setActive(activeDraftPage(boundaries,top));}}};editor.on('selectionUpdate',save);return ()=>{editor.off('selectionUpdate',save);};},[editor,boundaries,offset]);
  useEffect(()=>{const button=rail.current?.querySelector<HTMLElement>('[aria-current="page"]');if(button && rail.current){const top=button.offsetTop-rail.current.offsetTop;if(top<rail.current.scrollTop)rail.current.scrollTop=top;else if(top+button.offsetHeight>rail.current.scrollTop+rail.current.clientHeight)rail.current.scrollTop=top+button.offsetHeight-rail.current.clientHeight;}},[active]);
  // A queued DOM scroll can arrive after Split destroys this editor, before React removes the pane.
  function onScroll(){const el=scroll.current;if(!el||editor.isDestroyed)return;setActive(el.scrollTop>0 && el.scrollTop+el.clientHeight>=el.scrollHeight-2 ? boundaries.length-1 : activeDraftPage(boundaries,el.scrollTop-offset));if(!restoring.current){rememberLayoutAnchor();positionCallback.current(capture());}}
  return <div className={'draft-layout'+(hideDocumentTitles?' hide-manuscript-titles':'')+(view==='pages'?' draft-page-view':'')}>
    {navigator==='pages' && <section className="draft-rail" aria-label="Draft Pages"><h2>DRAFT PAGES</h2><p>Writing navigation,<br/>not Book Pages.</p><div className="draft-page-list" ref={rail}>{boundaries.map((top,i)=><button key={i} aria-current={active===i?'page':undefined} onClick={()=>{scroll.current?.scrollTo({top:offset+top,behavior:'instant'});}} aria-label={`Draft Page ${i+1}`}>{active===i?'● ':' ' }Page {i+1}</button>)}</div></section>}
    <div className="draft-scroll" ref={scroll} onScroll={onScroll}><div className="page" ref={content} title={view==='pages'?'Virtual writing pages. Final book pagination is determined in PUBLISH.':undefined}>{gaps.map((top,i)=><span className="draft-page-gap" aria-hidden="true" key={i} style={{top,height:draftPageGap}}/>)}{title&&<h1>{title}</h1>}<EditorContent editor={editor}/></div></div>
  </div>;
});
