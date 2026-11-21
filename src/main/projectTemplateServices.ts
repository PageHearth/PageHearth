import path from 'node:path';
import {TemplateStore} from './templateStore.js';
import {userContentPaths,ensureContentDirectory} from './userContent.js';
import {SettingsStore,directoryAvailable,browseDirectory} from './settings.js';
import {createTemplateProject,type CreationHooks} from './templateCreation.js';
import type {ProjectTemplate} from '../shared/projectTemplates.js';
import {requireTemplate} from '../shared/templateSafety.js';
import type {Project} from '../shared/model.js';

/** Main composition seam. TemplateWorkflow owns renderer review receipts; main
 * supplies app.getPath('home'), native dialogs and shell.trashItem. */
export class ProjectTemplateServices{
  readonly paths;readonly templates:TemplateStore;
  constructor(private home:string,private settings:SettingsStore,trash:(file:string)=>Promise<void>){this.paths=userContentPaths(home);this.templates=new TemplateStore(this.paths.templates,trash);}
  async browse(operation:'create'|'templateExport'|'templateImport'|'manuscriptImport'){
    const keys={create:'lastCreateDirectory',templateExport:'lastTemplateExportDirectory',templateImport:'lastTemplateImportDirectory',manuscriptImport:'lastManuscriptImportDirectory'} as const;
    const remembered=this.settings.value[keys[operation]];if(remembered&&await directoryAvailable(remembered))return remembered;
    const fallback=operation==='create'?this.paths.projects:operation==='templateExport'?this.paths.templates:this.home;
    try{return await ensureContentDirectory(fallback);}catch{return browseDirectory(undefined,this.home,this.home);}
  }
  async rememberBrowse(operation:'templateExport'|'templateImport'|'manuscriptImport',directory:string){requireTemplate(path.isAbsolute(directory),'PATH','Choose an absolute directory.');const keys={templateExport:'lastTemplateExportDirectory',templateImport:'lastTemplateImportDirectory',manuscriptImport:'lastManuscriptImportDirectory'} as const;await this.settings.update({[keys[operation]]:directory});}
  async rememberCreation(project:Project,root:string){await this.settings.update(current=>({lastCreateDirectory:path.dirname(root),recentProjects:[{title:project.manifest.title,path:root,lastOpened:new Date().toISOString()},...current.recentProjects.filter(r=>path.resolve(r.path).toLowerCase()!==root.toLowerCase())].slice(0,20)}));}
  async create(template:ProjectTemplate,title:string,parent:string,hooks:Omit<CreationHooks,'remember'>={}){return createTemplateProject(template,title,parent,{...hooks,remember:(project,root)=>this.rememberCreation(project,root)});}
}
