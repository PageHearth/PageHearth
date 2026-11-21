import {performance} from 'node:perf_hooks';
import {appCommands} from '../dist-main/shared/commands.js';
import {paletteResults} from '../dist-main/shared/commandPalette.js';
const context={project:true,manuscript:true,selection:true,singleDocument:true,busy:false,composing:false,workspace:'editor',focus:false,typewriter:false,revisionActive:true,revisionVisible:true,revisionAll:false,split:true,locked:false,undo:true,redo:false,tree:true,inspector:true,pages:false};
const synthetic=Array.from({length:1000},(_,i)=>({...appCommands[i%appCommands.length],id:'synthetic-'+i,label:appCommands[i%appCommands.length].label+' '+i}));
function measure(commands){const samples=[];for(let i=0;i<150;i++){const start=performance.now();paletteResults(['foc mod','rev mark','stats','Align Left','unknown xyz'][i%5],context,Object.fromEntries(commands.map(c=>[c.id,c.shortcut])),[],commands);samples.push(performance.now()-start);}samples.sort((a,b)=>a-b);return {count:commands.length,medianMs:samples[75],p95Ms:samples[142],maxMs:samples.at(-1)};}
console.log(JSON.stringify({method:'150 synchronous metadata-only filter calls; five queries; Node runtime',actual:measure(appCommands),synthetic:measure(synthetic)},null,2));
