import {ebookRegions,matchingOverride,setRegion} from './ebookRegions.js';
import {findVariant} from './publicationVariants.js';
import {specialTextStyle,type SpecialTextStyle} from './specialText.js';
import type {Project} from './model.js';
import type {PublicationDocument} from './publicationCompiler.js';
/** Stable shared assignment records retain their historical ebook.options location.
 * printStyle is independent of style; no migration or implicit eBook typography copy. */
export function setPrintRegionStyle(project:Project,key:string,printStyle:SpecialTextStyle|undefined){return setRegion(project,key,old=>({...old,printStyle}));}
export function printRegionStyles(document:PublicationDocument){const regions=ebookRegions(document);return regions.map(region=>{const assignment=matchingOverride(region,regions,document.ebook.options?.regions);const variant=findVariant(document.specialTextVariants,assignment?.variantId,region.role);return {region,style:{...specialTextStyle(region.role,document.style.specialText,document.style.print),...variant?.treatments.print,...assignment?.printStyle}};});}
