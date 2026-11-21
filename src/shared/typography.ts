export const fontSizes=[8,9,10,11,12,14,16,18,20,24,30,36,48,60,72] as const;
export function validFontSize(value:unknown):value is number{return typeof value==='number'&&Number.isFinite(value)&&value>=6&&value<=144&&Math.round(value*10)===value*10;}
export function parseFontSize(value:string):number|null{const text=value.trim();if(!/^\d+(?:\.\d)?$/.test(text))return null;const size=Number(text);return validFontSize(size)?size:null;}
export const textAlignments=['left','center','right'] as const;
export type TextAlignment=typeof textAlignments[number];
export function validAlignment(value:unknown):value is TextAlignment{return textAlignments.includes(value as TextAlignment);}
export function nextAlignment(value:TextAlignment|'Mixed'):TextAlignment{return value==='left'?'center':value==='center'?'right':'left';}
