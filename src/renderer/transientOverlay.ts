/** Window-local focus transfer, never a project preference. Suppress only the
 * synthetic blur caused by entering this transient overlay. Existing pending
 * debounce work continues normally. */
let release:(()=>void)|undefined;
export function beginTransientOverlay(){
 if(release)return;
 document.documentElement.dataset.commandPalette='open';
 const block=(event:FocusEvent)=>{if(!(event.target as Element)?.closest?.('dialog[data-command-palette]'))event.stopImmediatePropagation();};
 window.addEventListener('blur',block,true);window.addEventListener('focusout',block,true);
 release=()=>{window.removeEventListener('blur',block,true);window.removeEventListener('focusout',block,true);};
}
export function endTransientOverlay(){release?.();release=undefined;delete document.documentElement.dataset.commandPalette;}
