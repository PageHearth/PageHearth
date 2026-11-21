import React from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import PublicationPreflight from '../src/renderer/PublicationPreflight';
import PublicationMetadata from '../src/renderer/PublicationMetadata';
import {PublicationContentRow} from '../src/renderer/PublicationContentRow';
import {exportActionLabel} from '../src/renderer/ExportWorkspace';
import {defaultPublication} from '../src/shared/publication';
import type {PreflightIssue} from '../src/shared/publicationCompiler';
const issue=(blocking=false):PreflightIssue=>({severity:blocking?'error':'warning',blocking,code:'image-resolution',message:'Cover resolution is low',fix:'Use a larger source image.',target:'print',profile:'kdp'});
describe('PUBLISH production presentation',()=>{
 it('names the actual six export artifacts and separates print interior from cover',()=>{expect(['pdf','epub','docx','html','md','txt'].map(f=>exportActionLabel(f as 'pdf'))).toEqual(['Export Interior PDF…','Export EPUB…','Export DOCX…','Export HTML…','Export Markdown…','Export Plain Text…'])});
 it('keeps current state, hierarchy and complete accessible title without truncating stored labels',()=>{const title='雪 '+ 'Long chapter '.repeat(30),html=render(React.createElement(PublicationContentRow,{title,kind:'Scene · Manuscript',depth:2,current:true,onChoose:()=>{}}));expect(html).toContain('aria-current="true"');expect(html).toContain('data-depth="2"');expect(html).toContain(title);expect(render(React.createElement(PublicationContentRow,{title,kind:'Chapter',current:false,onChoose:()=>{}}))).not.toContain('aria-current')});
 it('keeps metadata grouped without mutating the publication',()=>{const plan=defaultPublication('Title'),before=JSON.stringify(plan),html=render(React.createElement(PublicationMetadata,{plan,update:()=>{throw Error('No edits during render')},onCovers:()=>{}}));for(const label of ['Book identity','Author &amp; publisher','Language &amp; edition','Edition identifiers','Publisher / imprint','Choose artwork in Covers'])expect(html).toContain(label);expect(JSON.stringify(plan)).toBe(before)});
 it('keeps warnings initially collapsed and deduplicates occurrences with guidance',()=>{const html=render(React.createElement(PublicationPreflight,{issues:[issue(),issue()]}));expect(html).toContain('0 errors · 1 warnings');expect(html).toContain('2 occurrences');expect(html).toContain('Use a larger source image.');expect(html).not.toContain(' open=');expect(html).toContain('Technical details');expect(html).toContain('has-warnings')});
 it('keeps blocking errors prominent and never labels them ready',()=>{const html=render(React.createElement(PublicationPreflight,{issues:[issue(true)]}));expect(html).toContain('role="alert"');expect(html).toContain('Needs attention');expect(html).not.toContain('Ready to export')});
 it('does not claim final export readiness from draft-only content checks',()=>{const html=render(React.createElement(PublicationPreflight,{issues:[],readyLabel:'Content checks clear'}));expect(html).toContain('Content checks clear');expect(html).not.toContain('Ready to export')});
});
