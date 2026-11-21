import {parentPort,workerData} from 'node:worker_threads';
import {renderCover} from './coverProduction.js';
const controller=new AbortController();parentPort!.on('message',()=>controller.abort());
try{parentPort!.postMessage({result:await renderCover(workerData,controller.signal)});}catch(e){parentPort!.postMessage({error:String(e)});}finally{parentPort!.close();}
