import {useEffect} from 'react';
import type {Editor} from '@tiptap/core';
import type {SearchRequest,SearchTarget} from '../shared/search';
import {selectSearchOccurrence} from './searchSelection';
export function announceSearch(request:SearchRequest){requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>window.dispatchEvent(new CustomEvent('pagehearth-search-reveal',{detail:request})))));}
export function useSearchReveal(kind:SearchTarget['kind'],reveal:(request:SearchRequest)=>void){useEffect(()=>{const listener=(e:Event)=>{const r=(e as CustomEvent<SearchRequest>).detail;if(r.target.kind===kind)reveal(r);};window.addEventListener('pagehearth-search-reveal',listener);return()=>window.removeEventListener('pagehearth-search-reveal',listener);},[kind,reveal]);}
export function revealEditor(editor:Editor|null,request:SearchRequest){if(!editor||request.stale)return;requestAnimationFrame(()=>{if(!selectSearchOccurrence(editor,request))window.dispatchEvent(new CustomEvent('pagehearth-search-message',{detail:'Match changed or no longer exists.'}));});}
