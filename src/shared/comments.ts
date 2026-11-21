import type {Doc,Project} from './model.js';
import type {Node as PMNode} from '@tiptap/pm/model';
import type {Mapping} from '@tiptap/pm/transform';

export type CommentAnchor={documentId:string;kind:'range'|'caret';from:number;to:number;status:'attached'|'missing';reason?:string;quote:string;prefix:string;suffix:string};
export type ManuscriptComment={id:string;text:string;state:'open'|'resolved';created:string;modified:string;anchor:CommentAnchor};
export type CommentsState={version:1;byId:Record<string,ManuscriptComment>;documentBases:Record<string,string>};
export const emptyComments=():CommentsState=>({version:1,byId:{},documentBases:{}});
// Exact serialized evidence, not a lossy text digest. One copy per commented document.
export const commentBody=(body:Doc)=>JSON.stringify(body);
export const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export function validateComments(value:CommentsState|undefined){
 if(value===undefined)return;
 const uuid=/^[a-f0-9-]{36}$/;
 if(value.version!==1||!value.byId||Array.isArray(value.byId)||!value.documentBases||Array.isArray(value.documentBases))throw Error('Unsupported or damaged Comments data.');
 for(const [id,c] of Object.entries(value.byId)){
  const a=c?.anchor;
  if(!uuid.test(id)||c.id!==id||typeof c.text!=='string'||!['open','resolved'].includes(c.state)||!Number.isFinite(Date.parse(c.created))||!Number.isFinite(Date.parse(c.modified))||!a||!uuid.test(a.documentId)||!['range','caret'].includes(a.kind)||!['attached','missing'].includes(a.status)||!Number.isSafeInteger(a.from)||!Number.isSafeInteger(a.to)||a.from<0||a.to<a.from||(a.kind==='caret'&&a.from!==a.to)||[a.quote,a.prefix,a.suffix].some(x=>typeof x!=='string')||(a.reason!==undefined&&typeof a.reason!=='string'))throw Error('Invalid manuscript comment.');
  if(a.status==='attached'&&(typeof value.documentBases[a.documentId]!=='string'||a.kind==='range'&&a.from===a.to))throw Error('Comment body evidence is missing.');
 }
 for(const [id,body] of Object.entries(value.documentBases))if(!uuid.test(id)||typeof body!=='string')throw Error('Invalid comment body evidence.');
}
const indexes=new WeakMap<CommentsState,Map<string,ManuscriptComment[]>>();
export function commentIndex(value:CommentsState|undefined){if(value&&indexes.has(value))return indexes.get(value)!;const index=new Map<string,ManuscriptComment[]>();for(const c of Object.values(value?.byId||{})){const list=index.get(c.anchor.documentId)||[];list.push(c);index.set(c.anchor.documentId,list);}if(value)indexes.set(value,index);return index;}
export function captureAnchor(documentId:string,doc:PMNode,from:number,to:number):CommentAnchor{
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<from||to>doc.content.size)throw Error('Select a valid manuscript range or caret.');
 for(const pos of [from,to]){const at=doc.resolve(pos);if(!at.parent.isTextblock)throw Error('Place the comment within manuscript text.');let safe=false;const text=at.parent.textBetween(0,at.parent.content.size,'','\n');if(at.parentOffset===text.length)safe=true;for(const part of new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text))if(part.index===at.parentOffset)safe=true;if(!safe)throw Error('Move the boundary outside the Unicode character.');}
 const quote=doc.textBetween(from,to,'\n','\n');if(from!==to&&!quote.trim())throw Error('Select meaningful manuscript text.');
 return {documentId,kind:from===to?'caret':'range',from,to,status:'attached',quote,prefix:doc.textBetween(Math.max(0,from-80),from,'\n','\n'),suffix:doc.textBetween(to,Math.min(doc.content.size,to+80),'\n','\n')};
}
export function attachComment(p:Project,anchor:CommentAnchor,body:Doc,id?:string):{project:Project;id:string}{
 const node=p.manifest.nodes.find(n=>n.id===anchor.documentId);if(!node||node.trashed||!['Chapter','Scene'].includes(node.kind)||!same(body,p.documents[node.id]))throw Error('The comment selection changed. Select it again.');
 const comments=structuredClone(p.author.comments||emptyComments()),stamp=new Date().toISOString();
 if(id){const old=comments.byId[id];if(!old||old.anchor.status!=='missing')throw Error('Only an Anchor Missing comment can be reattached.');comments.byId[id]={...old,anchor,modified:stamp};}
 else{id=crypto.randomUUID();comments.byId[id]={id,text:'',state:'open',anchor,created:stamp,modified:stamp};}
 comments.documentBases[node.id]=commentBody(body);return {id,project:{...p,author:{...p.author,comments}}};
}
export function editComment(p:Project,id:string,patch:{text?:string;state?:'open'|'resolved'}|null):Project{
 const old=p.author.comments?.byId[id];if(!old)throw Error('This comment no longer exists.');const comments={...p.author.comments!,byId:{...p.author.comments!.byId}};
 if(patch===null)delete comments.byId[id];else comments.byId[id]={...old,...patch,modified:new Date().toISOString()};return {...p,author:{...p.author,comments}};
}
export function missingAnchor(a:CommentAnchor,reason:string):CommentAnchor{return {...a,status:'missing',reason};}
/** Maps only the owner document through its actual accepted transaction sequence. */
export function mapCommentAnchors(value:CommentsState|undefined,id:string,before:Doc,after:Doc,mapping:Mapping,oldOffset:number,newOffset:number,doc:PMNode):CommentsState|undefined{
 if(!value)return value;const comments={...value,byId:{...value.byId},documentBases:{...value.documentBases}};
 const list=commentIndex(value).get(id)||[];if(!list.length)return value;
 const beforeEvidence=commentBody(before);
 for(const c of list){let a=c.anchor;if(a.status==='missing')continue;
  if(value.documentBases[id]!==beforeEvidence)a=missingAnchor(a,'unmapped-replacement');
  else{
   let from=a.from+oldOffset,to=a.to+oldOffset,lost=false;
   for(const map of mapping.maps){
    if(a.kind==='caret'){const r=map.mapResult(from,1);if(r.deletedAcross)lost=true;from=to=r.pos;}
    else{let survives=to>from;map.forEach((start,end)=>{if(end>start&&start<=from&&end>=to)survives=false;});const left=map.mapResult(from,1),right=map.mapResult(to,-1);from=left.pos;to=right.pos;if(!survives||from>=to)lost=true;}
   }
   from-=newOffset;to-=newOffset;
   if(lost||from<0||to>doc.content.size||from>to||a.kind==='range'&&!doc.textBetween(from,to,'\n','\n').trim())a=missingAnchor(a,'text-removed');else a={...a,from,to};
  }
  if(!same(a,c.anchor))comments.byId[c.id]={...c,anchor:a};
 }
 comments.documentBases[id]=commentBody(after);const nextIndex=new Map(commentIndex(value));nextIndex.set(id,list.map(c=>comments.byId[c.id]));indexes.set(comments,nextIndex);return comments;
}
export function invalidateComments(value:CommentsState|undefined,id:string,body:Doc|undefined,reason='unmapped-replacement'):CommentsState|undefined{
 if(!value)return value;const next={...value,byId:{...value.byId},documentBases:{...value.documentBases}};for(const c of Object.values(value.byId))if(c.anchor.documentId===id&&c.anchor.status==='attached')next.byId[c.id]={...c,anchor:missingAnchor(c.anchor,reason)};if(body)next.documentBases[id]=commentBody(body);else delete next.documentBases[id];return next;
}
export type AnchorSide=Record<string,CommentAnchor>;
export function anchors(value:CommentsState|undefined,id?:string):AnchorSide{return Object.fromEntries(Object.values(value?.byId||{}).filter(c=>!id||c.anchor.documentId===id).map(c=>[c.id,c.anchor]));}
export function restoreAnchors(value:CommentsState|undefined,expected:AnchorSide,target:AnchorSide,bodies:Record<string,Doc>):CommentsState|undefined{
 if(!value)return value;if(Object.values(value.byId).some(c=>Object.hasOwn(bodies,c.anchor.documentId)&&!Object.hasOwn(expected,c.id)))throw Error('New comments prevent traversal of older manuscript history.');if(Object.keys({...expected,...target}).some(id=>!value.byId[id]||!same(value.byId[id].anchor,expected[id])))throw Error('Comment anchors changed after this manuscript edit. History cannot safely overwrite them.');
 const next={...value,byId:{...value.byId},documentBases:{...value.documentBases}};for(const [id,anchor] of Object.entries(target))next.byId[id]={...value.byId[id],anchor:structuredClone(anchor)};for(const [id,body] of Object.entries(bodies))if(Object.values(next.byId).some(c=>c.anchor.documentId===id))next.documentBases[id]=commentBody(body);return next;
}
