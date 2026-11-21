import {parentPort,workerData} from 'node:worker_threads';
import {interchange} from './interchange.js';
void interchange(workerData.document,workerData.format,workerData.root).then(result=>parentPort!.postMessage({result}),error=>parentPort!.postMessage({error:String(error)}));
