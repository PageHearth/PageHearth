export type TextFocusMode='off'|'sentence'|'paragraph';
export type FocusPreferences={text:TextFocusMode;typewriter:boolean};
export function focusPreferences(value:unknown):FocusPreferences{
 const v=value as Partial<FocusPreferences>|undefined;
 return {text:v?.text==='sentence'||v?.text==='paragraph'?v.text:'off',typewriter:v?.typewriter===true};
}
