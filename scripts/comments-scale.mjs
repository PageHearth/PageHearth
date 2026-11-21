import {Store} from '../dist-main/main/storage.js';
import {emptyComments,captureAnchor,mapCommentAnchors} from '../dist-main/shared/comments.js';
import {manuscriptSchema as schema} from '../dist-main/shared/manuscriptSchema.js';
import {Transform} from '@tiptap/pm/transform';
import {randomUUID} from 'node:crypto';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import path from 'node:path';
await mkdir('.acceptance/comments',{recursive:true});const root=await mkdtemp(path.resolve('.acceptance/comments/scale-')),store=new Store(root);
try{await store.create('Comments scale');let p=structuredClone(store.project);const id=p.manifest.nodes[0].id,body={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'word '.repeat(12000)}]}]},doc=schema.nodeFromJSON(body),comments=emptyComments(),stamp=new Date().toISOString();p.documents[id]=body;for(let i=0;i<2000;i++){const cid=randomUUID();comments.byId[cid]={id:cid,text:'Review this passage',state:'open',created:stamp,modified:stamp,anchor:captureAnchor(id,doc,1+i*5,5+i*5)};}comments.documentBases[id]=JSON.stringify(body);p.author.comments=comments;p=await store.commit(p);const measurements=[];
for(let i=0;i<3;i++){const tr=new Transform(schema.nodeFromJSON(p.documents[id])).insert(1,schema.text('New ')),start=performance.now(),mapped=mapCommentAnchors(p.author.comments,id,p.documents[id],tr.doc.toJSON(),tr.mapping,0,0,tr.doc),mappingMs=performance.now()-start,begin=performance.now();await store.stageDocument(id,tr.doc.toJSON(),mapped,p.author.comments);const protectionMs=performance.now()-begin;p=await store.commit({...p,documents:{...p.documents,[id]:tr.doc.toJSON()},author:{...p.author,comments:mapped}});measurements.push({mappingMs,protectionMs,rss:process.memoryUsage().rss});}
const result={root,comments:2000,initialWords:12000,serializedCommentBytes:Buffer.byteLength(JSON.stringify(p.author.comments)),measurements};await writeFile(path.join(root,'measurement.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));}finally{await store.release();}
