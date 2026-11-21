import {useEffect,useRef,useState} from 'react';
import {parseTags} from '../shared/author';

export function TagInput({label,value,placeholder,disabled,onChange}:{label:string;value:string[];placeholder?:string;disabled?:boolean;onChange:(tags:string[])=>void}){
  const canonical=value.join(', '),canonicalKey=value.join('\u0000'),editing=useRef(false),published=useRef(canonicalKey),change=useRef(onChange);change.current=onChange;
  const [text,setText]=useState(canonical);
  useEffect(()=>{published.current=canonicalKey;if(!editing.current)setText(canonical);},[canonical,canonicalKey]);
  useEffect(()=>{if(!editing.current)return;const tags=parseTags(text),key=tags.join('\u0000');if(key===published.current)return;const timer=setTimeout(()=>{published.current=key;change.current(tags);},400);return()=>clearTimeout(timer);},[text]);
  function commit(raw:string){const tags=parseTags(raw),key=tags.join('\u0000');editing.current=false;setText(tags.join(', '));if(key!==published.current){published.current=key;change.current(tags);}}
  return <input aria-label={label} value={text} placeholder={placeholder} disabled={disabled} onFocus={()=>{editing.current=true;}} onChange={event=>setText(event.target.value)} onBlur={event=>commit(event.target.value)}/>;
}
