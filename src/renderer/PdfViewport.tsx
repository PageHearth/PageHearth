import {memo} from 'react';
// Scrolling belongs to Chromium's PDF viewer. Unrelated Research edits/status
// updates must not reconcile the plugin subtree. Only explicit viewer controls
// change its URL/key; that remount is required for repeated native fit/zoom.
export const PdfViewport=memo(function PdfViewport({preview,title}:{preview:string;title:string}){
  return <embed key={preview} title={title} src={preview} type="application/pdf"/>;
});
