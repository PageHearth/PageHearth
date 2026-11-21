import {revisionSchemaExtensions} from './revisionSchema.js';
import {Extension,Mark,getSchema} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
/** Canonical schema attributes shared by storage-side structural operations.
 * DOM rendering/commands remain renderer concerns. Schema parity is regression tested. */
export const manuscriptAttributes=Extension.create({name:'manuscriptAttributes',addGlobalAttributes(){return [{types:['paragraph','heading'],attributes:{indent:{default:0},textAlign:{default:null}}},{types:['paragraph'],attributes:{specialText:{default:null},specialRegionId:{default:null}}}];}});
export const manuscriptMarks=[
 Mark.create({name:'textStyle',addAttributes(){return {fontFamily:{default:null}};}}),
 Mark.create({name:'fontSize',addAttributes(){return {points:{default:null}};}}),
 Mark.create({name:'entityReference',inclusive:false,excludes:'',addAttributes(){return {targetId:{default:null},occurrenceId:{default:null}};}})
];
export const manuscriptSchema=getSchema([StarterKit.configure({code:false,codeBlock:false}),...revisionSchemaExtensions,manuscriptAttributes,...manuscriptMarks]);
