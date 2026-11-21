/** No persistent close latch: cancellation returns to the caller's normal finally cleanup. */
export async function closeWithProtection(save:()=>Promise<void>,quit:()=>Promise<void>,warning:(message:string)=>Promise<boolean>){
 for(;;){try{await save();await quit();return;}catch(error){if(!await warning(String(error)))return;}}
}
