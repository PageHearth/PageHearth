import {expect,type Page} from '@playwright/test';
/** Caller supplies the native parent-directory dialog result. */
export async function createProject(page:Page,name:string,builtin='Novel'){
 await page.getByRole('button',{name:'New Project…',exact:true}).click();
 const form=page.getByRole('dialog',{name:'New Project',exact:true});
 await form.locator('label.template-option').filter({has:page.getByText(builtin,{exact:true})}).getByRole('radio').check();
 await form.getByLabel('Project Name *',{exact:true}).fill(name);
 await form.getByRole('button',{name:'Change Location…',exact:true}).click();
 await form.getByRole('button',{name:'Create Project',exact:true}).click();
 await expect(form).toHaveCount(0);
}
