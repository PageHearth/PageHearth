import {validRevisionId} from './revisionPasses.js';
import {Mark} from '@tiptap/core';
import Code from '@tiptap/extension-code';
import CodeBlock from '@tiptap/extension-code-block';
export const RevisionMark=Mark.create({name:'revisionPass',inclusive:false,excludes:'revisionPass',addAttributes(){return {slotId:{default:null}};},parseHTML(){return [{tag:'span[data-revision-slot]',getAttrs:el=>{const slotId=(el as HTMLElement).dataset.revisionSlot;return validRevisionId(slotId)?{slotId}:false;}}];},renderHTML({HTMLAttributes}){return ['span',{'data-revision-slot':HTMLAttributes.slotId},0];}});
// Preserve code's existing exclusions except the workflow-only revision mark.
export const RevisionCode=Code.extend({excludes:'bold italic strike underline link textStyle fontSize entityReference code'});
export const RevisionCodeBlock=CodeBlock.extend({marks:'revisionPass'});
export const revisionSchemaExtensions=[RevisionMark,RevisionCode,RevisionCodeBlock];
