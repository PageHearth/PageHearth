import {parentPort,workerData} from 'node:worker_threads';
import {inspectCover} from './coverProduction.js';
try{parentPort!.postMessage({result:await inspectCover(Buffer.from(workerData.bytes),workerData.asset)});}catch(e){parentPort!.postMessage({error:String(e)});}
