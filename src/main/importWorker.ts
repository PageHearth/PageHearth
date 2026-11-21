import {parentPort,workerData} from 'node:worker_threads';
import {analyzeImport} from './importAdapters.js';
analyzeImport(Buffer.from(workerData.bytes),workerData.filename,workerData.mtime,workerData.encoding).then(value=>parentPort!.postMessage({value}),error=>parentPort!.postMessage({error:String(error.message||error)}));
