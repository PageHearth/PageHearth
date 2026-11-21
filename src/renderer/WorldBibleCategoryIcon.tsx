/** The shell's quiet, currentColor outline convention. Decorative; the adjacent name is the label. */
const paths:Record<string,string>={
 character:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M18 8v6m-3-3h6',
 location:'M12 22s8-8 8-14a8 8 0 0 0-16 0c0 6 8 14 8 14ZM12 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
 bestiary:'M5 3l4 5h6l4-5v13l-7 6-7-6ZM8 12h1m6 0h1m-6 5h4',
 faction:'M3 21V7l6-4v18m0-10 6-4v14m0-6 6-4v10M3 21h18',
 lore:'M4 3h12l4 4v14H4ZM16 3v5h4M8 12h8m-8 4h6',
 glossary:'M3 4h7l2 2 2-2h7v16h-7l-2 1-2-1H3ZM12 6v15',
 system:'M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3M5 19l3-3m8-8 3-3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
 archive:'M3 3h18v5H3ZM5 8v13h14V8M9 12h6',book:'M4 3h16v18H4ZM8 3v18',
 compass:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M16 8l-3 5-5 3 3-5Z',
 crown:'M3 6l5 4 4-7 4 7 5-4-2 14H5Z',gem:'M6 3h12l4 7-10 12L2 10ZM2 10h20M6 3l6 19 6-19',
 key:'M9 3a6 6 0 1 0 0 12 6 6 0 0 0 0-12M13 13l8 8m-4-4 3-3',
 leaf:'M20 3C4 2 0 15 8 20c8 5 14-5 12-17ZM5 21l10-12',
 star:'m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1Z',
 sun:'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2',
 sword:'M20 3v6L8 21l-5-5L15 3ZM4 12l8 8',vessel:'M7 3h10l-2 5c8 8 5 13-3 13S1 16 9 8ZM7 3h10'
};
export function WorldBibleCategoryIcon({kind}:{kind:string}){return <svg className="world-category-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]||paths.book}/></svg>;}
