import React from 'react';

export function DetachedPlaceholder({label,onBring,onDock}:{label:string;onBring:()=>Promise<void>;onDock:()=>Promise<void>}){
  return <section className="docked-surface"><h2>{label} is open in its own window</h2><p>Only one live copy is shown. Closing the detached window docks it here again.</p><div><button onClick={()=>void onBring()}>Bring to front</button><button onClick={()=>void onDock()}>Dock here</button></div></section>;
}
