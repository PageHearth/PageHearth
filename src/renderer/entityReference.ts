import {referenceInputPlugin} from './referenceInput';
import {Mark,mergeAttributes} from '@tiptap/core';
import {registerReferenceEditor} from './referenceContext';

declare module '@tiptap/core'{interface Commands<ReturnType>{entityReference:{setEntityReference:(attrs:{targetId:string;occurrenceId:string})=>ReturnType;unsetEntityReference:()=>ReturnType}}}

export const EntityReferenceMark=Mark.create<{project:()=>string|null;exists:(id:string)=>boolean;refuse:(message:string)=>void}>({
  addOptions(){return {project:()=>null,exists:()=>true,refuse:message=>window.alert(message)};},
  addProseMirrorPlugins(){return [referenceInputPlugin(this.options.project,this.options.refuse,this.options.exists)];},
  addStorage(){return {stop:undefined as (()=>void)|undefined};},
  onCreate(){this.storage.stop=registerReferenceEditor(this.editor);},
  onDestroy(){this.storage.stop?.();},
  name:'entityReference',inclusive:false,excludes:'',
  addAttributes(){return {targetId:{default:null},occurrenceId:{default:null}};},
  parseHTML(){return [];},
  renderHTML({HTMLAttributes}){return ['span',mergeAttributes(HTMLAttributes,{'data-entity-reference':'','data-target-id':HTMLAttributes.targetId,'data-occurrence-id':HTMLAttributes.occurrenceId,class:'entity-reference'}),0];},
  addCommands(){return {setEntityReference:attrs=>({commands})=>commands.setMark(this.name,attrs),unsetEntityReference:()=>({commands})=>commands.unsetMark(this.name)};},
});
