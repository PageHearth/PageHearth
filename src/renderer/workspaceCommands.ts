import {useEffect,useRef} from 'react';
import type {CommandId,CommandResult} from '../shared/commands';
type Action={run:()=>void|Promise<void>;reason?:string;opened?:boolean};
const mounted=new Map<CommandId,()=>Action>();
/** Window-local mounted owners; never exposes arbitrary functions over IPC. */
export function useWorkspaceCommands(actions:Partial<Record<CommandId,Action>>){const latest=useRef(actions);latest.current=actions;const keys=Object.keys(actions) as CommandId[];useEffect(()=>{const entries=keys.map(id=>[id,()=>latest.current[id]!] as const);for(const [id,get] of entries)mounted.set(id,get);return()=>{for(const [id,get] of entries)if(mounted.get(id)===get)mounted.delete(id);};},[keys.join('|')]);}
export function workspaceReason(id:CommandId){return mounted.get(id)?.().reason??(mounted.has(id)?'':'Open the owning workspace first.');}
export async function executeWorkspaceCommand(id:CommandId):Promise<CommandResult>{const a=mounted.get(id)?.();if(!a||a.reason)return {status:'refused',reason:a?.reason||'The workspace changed.'};await a.run();return {status:a.opened?'opened':'completed'};}
export const workspaceCommandIds=['corkboard-new','corkboard-clear','notebook-new','notebook-undo','notebook-redo','outliner-undo','outliner-redo','timeline-new','collection-new'] as const;
