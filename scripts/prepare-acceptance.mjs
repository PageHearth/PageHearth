// Isolated sample content for native Windows acceptance checks; never opens user projects.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Store } from '../dist-main/main/storage.js';
const root=path.resolve('.acceptance','Long Novel');
await fs.mkdir(root,{recursive:true});
if((await fs.readdir(root)).length===0){
  const store=new Store(root);await store.create('Phase 1 Acceptance');
  const project=structuredClone(store.project);
  project.documents[project.manifest.nodes[0].id]={type:'doc',content:Array.from({length:100},(_,i)=>({type:'paragraph',content:[{type:'text',text:`Passage ${i+1}. `+'The traveler stopped beside the river and opened the old notebook. '.repeat(8)}]}))};
  await store.commit(project);await store.release();
}
console.log(root);
