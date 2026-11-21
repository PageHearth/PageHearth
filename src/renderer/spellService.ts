import {resolveVocabulary,vocabularyRules,vocabularyApproval,foldSpelling,type VocabularySnapshot,type SpellingToken} from '../shared/spelling';
import type {Project} from '../shared/model';

export class SpellService{
 snapshot:VocabularySnapshot={projectId:'',entries:[]};epoch=0;
 readonly listeners=new Set<()=>void>();private rules=vocabularyRules(this.snapshot);private fingerprint='';private previous:Project|null|undefined;
 constructor(private transport:(request:{words:string[]}|{word:string})=>Promise<boolean[]|string[]> = request=>window.pagehearth.spell(request)){}
 update(project:Project|null){if(this.previous?.manifest.id===project?.manifest.id&&this.previous?.author.projectDictionary===project?.author.projectDictionary&&this.previous?.author.worldBible?.entities===project?.author.worldBible?.entities)return;this.previous=project;const snapshot=project?resolveVocabulary(project.manifest.id,project.author):{projectId:'',entries:[]};const fingerprint=JSON.stringify(snapshot);
  if(fingerprint===this.fingerprint)return;this.fingerprint=fingerprint;this.snapshot=snapshot;this.rules=vocabularyRules(snapshot);this.epoch++;for(const listener of this.listeners)listener();
 }
 approves(word:string){return vocabularyApproval(this.rules,word)===true;}
 async check(tokens:SpellingToken[]){const rules=this.rules,unique=[...new Set(tokens.filter(t=>t.key.length<=256&&vocabularyApproval(rules,t.key)===undefined).map(t=>t.key))],accepted=new Set<string>();
  for(let i=0;i<unique.length;i+=4096){const batch=unique.slice(i,i+4096),reply=await this.transport({words:batch});if(reply.length!==batch.length||reply.some(v=>typeof v!=='boolean'))throw Error('Invalid spelling response.');reply.forEach((yes,j)=>{if(yes)accepted.add(batch[j]);});}
  return tokens.filter(t=>t.key.length<=256&&(vocabularyApproval(rules,t.key)===false||(vocabularyApproval(rules,t.key)===undefined&&!accepted.has(t.key))));
 }
 async suggest(word:string){const candidates=this.snapshot.entries.filter(e=>foldSpelling(e.key)===foldSpelling(word)&&this.approves(e.key)).map(e=>e.spelling);const base=await this.transport({word}) as string[];return [...new Set([...candidates,...base.filter(w=>vocabularyApproval(this.rules,w)!==false)])].slice(0,5);}
}
export const spellService=new SpellService();
