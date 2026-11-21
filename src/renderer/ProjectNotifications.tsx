import React,{useEffect,useRef} from 'react';
export const safeMergeNotice='PageHearth safely combined this save with newer non-conflicting project changes.';
export function ProjectNotifications({error,notice,onRetry,onRecover,onDismiss,onOpen}:{error:string;notice:string;onRetry:()=>void;onRecover:()=>void;onDismiss:()=>void;onOpen?:()=>void}){
 const dismiss=useRef(onDismiss);dismiss.current=onDismiss;
 useEffect(()=>{if(notice!==safeMergeNotice)return;const timer=setTimeout(()=>dismiss.current(),8000);return()=>clearTimeout(timer);},[notice]);
 return <div className="project-notifications" aria-label="Project notifications">{error&&<div className="error" role="alert"><strong>PageHearth couldn’t finish this operation. Your open text is retained.</strong><div>{error}</div><button onClick={onRetry}>Retry save</button><button onClick={onRecover}>Save recovery copy and refresh</button></div>}{notice&&<div className="notice" role="status">{notice}{onOpen&&<button onClick={onOpen}>Open</button>}<button aria-label="Dismiss notice" onClick={onDismiss}>Dismiss</button></div>}</div>;
}

