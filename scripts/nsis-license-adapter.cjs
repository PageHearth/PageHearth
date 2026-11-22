// SPDX-License-Identifier: MPL-2.0
const crypto=require('node:crypto');
function requireInteractiveLicense(text){
 if(crypto.createHash('sha256').update(text).digest('hex')!=='8aa1230e9717b428664d613fcc5c6a060883410b34cb7853b517fe11b4ee0a76')throw Error('Unreviewed assisted installer license template');
 const old='!ifmacrodef licensePage\n    !insertmacro skipPageIfUpdated\n    !insertmacro licensePage';
 if(text.split(old).length!==2)throw Error('Unexpected license-page structure');
 return text.replace(old,'!ifmacrodef licensePage\n    ; Recipient terms require an explicit choice, including --updated runs.\n    !insertmacro licensePage');
}
module.exports={requireInteractiveLicense};
