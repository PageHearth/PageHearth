export class ProjectDirtyState{
  private changed=false;
  private serial=0;
  get dirty(){return this.changed;}
  get generation(){return this.serial;}
  markChanged(){this.changed=true;this.serial++;return this.serial;}
  acknowledge(generation:number){if(generation!==this.serial)return false;this.changed=false;return true;}
  reset(){this.changed=false;this.serial++;}
}

type EditableSurface={readonly isEditable:boolean;setEditable:(editable:boolean,emitUpdate?:boolean)=>void};

/** Interaction-mode changes are shell state, never manuscript edits. */
export function setEditorInteraction(editor:EditableSurface|null|undefined,editable:boolean){
  if(editor&&editor.isEditable!==editable)editor.setEditable(editable,false);
}
