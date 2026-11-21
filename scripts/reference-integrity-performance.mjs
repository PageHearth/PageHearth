import {performance} from 'node:perf_hooks';
import {randomUUID} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';
import {referenceRanges,remintReferences} from '../dist-main/shared/referenceIntegrity.js';
import {manuscriptOccurrences} from '../dist-main/shared/worldBible.js';
const target=randomUUID(),body={type:'doc',content:Array.from({length:2000},(_,i)=>{const mark={type:'entityReference',attrs:{targetId:target,occurrenceId:randomUUID()}};return {type:'paragraph',content:[{type:'text',text:'Mina',marks:[mark]},{type:'text',text:' of the valley',marks:[mark,{type:'italic'}]},{type:'text',text:' walked across the hills. '.repeat(20)}]};})};
const measure=fn=>{const start=performance.now(),value=fn();return {ms:performance.now()-start,count:value.length};};
const results={occurrences:2000,paragraphs:2000,characters:JSON.stringify(body).length,validate:measure(()=>referenceRanges(body)),cachedValidate:measure(()=>referenceRanges(body)),backlinks:measure(()=>manuscriptOccurrences({documents:{chapter:body}})),remint:measure(()=>referenceRanges(remintReferences(body)))};
await mkdir('.acceptance/reference-integrity',{recursive:true});await writeFile('.acceptance/reference-integrity/performance.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
