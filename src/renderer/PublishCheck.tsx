import type {InputHTMLAttributes,ReactNode} from 'react';
/** One accessible inline checkbox contract for every PUBLISH surface. */
export function PublishCheck({children,...props}:Omit<InputHTMLAttributes<HTMLInputElement>,'type'|'children'> & {children:ReactNode}){return <label className="publish-check"><input {...props} type="checkbox"/><span>{children}</span></label>;}
