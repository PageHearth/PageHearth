import {Node} from '@tiptap/core';
import {Plugin} from '@tiptap/pm/state';
import {Fragment,Slice,type Node as PMNode} from '@tiptap/pm/model';
import {validManuscriptImage,imageWidthFraction} from '../shared/manuscriptImages';

/** Display-only node view. Canonical JSON contains no data URLs or machine paths. */
export const ManuscriptImage=Node.create({
 name:'manuscriptImage',group:'block',atom:true,selectable:true,draggable:true,
 addOptions(){return {project:():string|null=>null};},
 addAttributes(){return Object.fromEntries(Object.entries({sourceAsset:null,id:'',projectId:'',asset:'',alt:'',caption:'',size:'medium',alignment:'center',decorative:false,width:0,height:0}).map(([key,value])=>[key,{default:value}]));},
 // External HTML cannot manufacture trusted project asset references.
 parseHTML(){return [{tag:'figure[data-pagehearth-image]',getAttrs:element=>{try{const a=JSON.parse((element as HTMLElement).dataset.pagehearthImage||'');return validManuscriptImage(a)&&a.projectId===this.options.project()?a:false;}catch{return false;}}}];},
 renderHTML({node}){return ['figure',{'data-manuscript-image':node.attrs.id,'data-pagehearth-image':JSON.stringify(node.attrs)},['span',{},node.attrs.decorative?'Image':'Image: '+node.attrs.alt],['figcaption',{},node.attrs.caption]];},
 addProseMirrorPlugins(){return [new Plugin({props:{transformPasted:slice=>{const copy=(fragment:Fragment):Fragment=>{const result:PMNode[]=[];fragment.forEach(n=>{if(n.type.name==='manuscriptImage'){if(validManuscriptImage(n.attrs)&&n.attrs.projectId===this.options.project())result.push(n.type.create({...n.attrs,id:crypto.randomUUID()}));}else result.push(n.copy(copy(n.content)));});return Fragment.from(result);};return new Slice(copy(slice.content),slice.openStart,slice.openEnd);}}})];},
 addNodeView(){return ({node})=>{
  const dom=document.createElement('figure'),image=document.createElement('img'),status=document.createElement('span'),caption=document.createElement('figcaption');let disposed=false;
  image.onerror=()=>{image.hidden=true;status.textContent='Image unavailable — replace it using Image properties.';};dom.className='manuscript-image';dom.contentEditable='false';dom.append(image,status,caption);
  const a=node.attrs;dom.dataset.manuscriptImage=String(a.id);dom.setAttribute('role','group');dom.setAttribute('aria-label',a.decorative?'Decorative image':a.alt||'Image without alt text');
  if(validManuscriptImage(a)){dom.style.width=(imageWidthFraction(a.size)*100)+'%';dom.style.maxWidth=a.width+'px';dom.style.marginLeft=a.alignment==='left'?'0':'auto';dom.style.marginRight=a.alignment==='right'?'0':'auto';image.alt=a.decorative?'':a.alt;image.width=a.width;image.height=a.height;caption.textContent=a.caption;status.textContent='Loading image…';
   void window.pagehearth.manuscriptImageRead(a.projectId,a.asset).then(src=>{if(!disposed){image.src=src;status.textContent='';}}).catch(()=>{if(!disposed){image.hidden=true;status.textContent='Image unavailable — replace it using Image properties.';}});
  }else{image.hidden=true;status.textContent='Image unavailable';}
  return {dom,selectNode(){dom.classList.add('ProseMirror-selectednode');dom.setAttribute('aria-label','Selected: '+(a.decorative?'Decorative image':a.alt||'Image without alt text'));},deselectNode(){dom.classList.remove('ProseMirror-selectednode');dom.setAttribute('aria-label',a.decorative?'Decorative image':a.alt||'Image without alt text');},destroy(){disposed=true;}};
 };}
});
