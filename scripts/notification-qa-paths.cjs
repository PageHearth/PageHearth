const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
// Invoked before app.whenReady; launch switches also establish these paths before main loads.
module.exports=function configureQaPaths(app){
 const base=path.join(process.env.LOCALAPPDATA||path.join(path.dirname(app.getPath('appData')),'Local'),'PageHearth-Notification-QA','runs');
 const root=process.env.PAGEHEARTH_NOTIFICATION_QA_RUN||path.join(base,crypto.randomUUID());
 if(path.dirname(path.resolve(root)).toLowerCase()!==path.resolve(base).toLowerCase())throw Error('Invalid isolated Notification QA run directory');
 const paths={};for(const key of ['userData','sessionData','temp','logs','crashDumps']){paths[key]=path.join(root,key);fs.mkdirSync(paths[key],{recursive:true});app.setPath(key,paths[key]);}
 const cache=path.join(root,'cache');fs.mkdirSync(cache,{recursive:true});app.commandLine.appendSwitch('disk-cache-dir',cache);
 const info={root,...paths,cache,gpuCache:path.join(paths.sessionData,'GPUCache'),identity:'com.pagehearth.notification.qa',pid:process.pid};
 fs.writeFileSync(path.join(root,'paths.json'),JSON.stringify(info,null,2));console.log('QA_PATHS '+JSON.stringify(info));return root;
};
