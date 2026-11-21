import {useState} from 'react';

export function LicenseInformation(){
 const [error,setError]=useState('');
 return <details><summary>License information</summary>
  <p>Copyright © 2026 PixelFF.</p>
  <p>PageHearth’s original application source is licensed under the Mozilla Public License 2.0 (MPL-2.0). PixelFF is the developer’s personal brand, not a separate company.</p>
  <p>Third-party components retain their own licenses. PageHearth and PixelFF branding is protected separately; the branding policy does not restrict MPL-2.0 software rights.</p>
  <p>Installed offline notices include the license, branding policy and matching-source availability instructions.</p>
  <button onClick={()=>{setError('');void window.pagehearth.openLicenseInformation().catch(()=>setError('Could not open the installed notices. Find them in the installation folder under resources/documentation/legal.'));}}>Open offline licenses and source information</button>
  {error&&<p role="alert">{error}</p>}
 </details>;
}
