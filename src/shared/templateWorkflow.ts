import type {Project} from './model.js';
import type {TemplateSelection} from './projectTemplates.js';
export type TemplateTarget={id:string;revision:string};
export type TemplateCard={warning?:string;id:string;revision:string;builtIn:boolean;name:string;creator:string;description:string;createdWith:string;minimumVersion:string;nodes:{title:string;kind:string;key:string;parent:string|null}[];notes:string[];schemas:number};
export type TemplateMetadata={name:string;creator:string;description:string};
export type TemplateRequest=
 |{kind:'catalog'}|{kind:'location'}|{kind:'import-preview'}|{kind:'open-folder'}
 |{kind:'create';source:TemplateTarget;location:string;name:string}
 |{kind:'review';metadata:TemplateMetadata;selection:TemplateSelection;target?:TemplateTarget}
 |{kind:'install';token:string;mode:'new'|'copy'|'replace';name?:string;target?:TemplateTarget}
 |{kind:'metadata';target:TemplateTarget;metadata:TemplateMetadata}
 |{kind:'export';target:TemplateTarget}
 |{kind:'delete';target:TemplateTarget;permanentToken?:string};
export type TemplateReply={ok:true;value:unknown}|{ok:false;error:{code:string;message:string;field:string}};
export type TemplateCatalog={builtIns:TemplateCard[];custom:TemplateCard[];issues:string[];location:{token:string;path:string};creator:string;projectTitle:string|null;starters:{id:string;title:string;folder:string}[]};
export type TemplateReview={token:string;card:TemplateCard;warnings:string[];conflicts:TemplateCard[];target?:TemplateTarget};
export type TemplateCreated={project:Project;activeDocumentId:string};
