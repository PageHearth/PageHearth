import {useState} from 'react';
import cup from '../../assets/branding/kofi/cup.avif';

// Official account declared in .github/FUNDING.yml. No remote content is loaded.
export const SUPPORT_URL='https://ko-fi.com/pagehearth';

export function SupportDevelopment(){
 const [failed,setFailed]=useState(false);
 return <section aria-labelledby="support-development-title">
  <h3 id="support-development-title">Support development</h3>
  <p>If PageHearth helps your writing, you can support its development. Contributions are completely optional.</p>
  <p><a className="about-support-link" href={SUPPORT_URL} title="Open Ko-fi in your default browser" onClick={event=>{
   event.preventDefault();setFailed(false);
   void window.pagehearth.openExternalUrl(SUPPORT_URL).catch(()=>setFailed(true));
  }}><img src={cup} width="20" height="20" alt=""/>Support PageHearth on Ko-fi</a></p>
  {failed&&<p role="alert">Your browser could not be opened. Please try the link again.</p>}
 </section>;
}
