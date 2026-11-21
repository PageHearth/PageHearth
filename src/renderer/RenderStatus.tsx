import React from 'react';
/** Commit feedback before serializing a large project into IPC. */
export function yieldToPreviewPaint(){return new Promise<void>(resolve=>{const fallback=setTimeout(resolve,50);requestAnimationFrame(()=>setTimeout(()=>{clearTimeout(fallback);resolve();},0));});}
export function RenderStatus({busy,children}:{busy:boolean;children:React.ReactNode}){return <p className="publication-render-status" role="status" aria-live="polite" aria-atomic="true">{busy&&<span className="publication-render-spinner" aria-hidden="true"/>}{children}</p>;}
