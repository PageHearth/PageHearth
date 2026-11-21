import {parentPort} from 'node:worker_threads';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createCollection,createSpellingDictionaryFromTrieFile} from 'cspell-dictionary';

const config=new URL(import.meta.resolve('@cspell/dict-en_us/cspell-ext.json'));
const definition=JSON.parse(readFileSync(config,'utf8')).dictionaryDefinitions[0];
const dictionary=createCollection([createSpellingDictionaryFromTrieFile(gunzipSync(readFileSync(new URL('en_US.trie.gz',config))),'en_us','bundled en-US',definition)],'PageHearth prose');
parentPort!.on('message',({id,words,word,limit})=>{
 try{const result=words?words.map((w:string)=>dictionary.has(w,{ignoreCase:false})):dictionary.suggest(word,{numSuggestions:limit}).map(s=>s.word);parentPort!.postMessage({id,result});}
 catch(error){parentPort!.postMessage({id,error:String(error)});}
});
