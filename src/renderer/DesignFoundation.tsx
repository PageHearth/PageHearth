import type {ButtonHTMLAttributes, ReactNode} from 'react';
import './designFoundation.css';
export function StudioButton({variant='secondary',className='',...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'secondary'|'quiet'|'danger'}) {
  return <button type="button" {...props} className={`studio-button studio-button-${variant} ${className}`}/>;
}
export function StudioCard({children,className=''}:{children:ReactNode;className?:string}) {return <article className={`studio-card ${className}`}>{children}</article>;}
export function EmptyState({title,children}:{title:string;children:ReactNode}) {return <div className="studio-empty"><h3>{title}</h3>{children}</div>;}
