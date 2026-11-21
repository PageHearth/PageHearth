import {parentPort,workerData} from 'node:worker_threads';
import {TypstPrintRenderer} from './typstPrint.js';
const abort=new AbortController();parentPort!.on('message',()=>abort.abort());
new TypstPrintRenderer(workerData.resources,workerData.temporary).render(workerData.document,{root:workerData.root},abort.signal).then(result=>parentPort!.postMessage({result}),error=>parentPort!.postMessage({error:error instanceof Error?error.message:String(error)})).finally(()=>parentPort!.close());
