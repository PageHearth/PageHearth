// Trusted template. User content enters only through JSON and text(), never eval().
#let book = json("book.json")
#let p = book.print
#let s = book.style.print
#let o = book.production
#let align-for(v) = if v == "center" { center } else if v == "right" { right } else { left }
#let starts() = query(<ph-start>)
#let body-page() = {let body = starts().filter(x => x.value.zone == "body"); if body.len() > 0 {body.first().location().page()} else {1}}
#let number-on(n) = if n < body-page() {numbering("i", n)} else {str(n - body-page() + 1)}
#let section-on(n) = {let ss=starts().filter(x=>x.location().page()<=n);if ss.len()==0 {none} else {let sec=ss.last();let end=query(<ph-end>).find(x=>x.value==sec.value.id);if end!=none and end.location().page()>=n {sec}else{none}}}
#let head-value(key, sec) = if key == "author" {book.metadata.author} else if key == "title" {book.metadata.title} else if key == "chapter" {let cs=starts().filter(x=>x.value.kind=="chapter" and x.location().page()<=here().page());if cs.len()>0 {cs.last().value.title} else {""}} else {""}
#set document(title:book.metadata.title, author:book.metadata.author, date:none)
#set align(align-for(s.alignment))
#set text(font:book.bodyFont,style:if s.at("italic",default:false){"italic"}else{"normal"},size:s.sizePt*1pt,lang:book.metadata.language.split("-").first(),hyphenate:s.hyphenation,fill:black,costs:(widow:100%,orphan:100%,runt:100%))
#set par(justify:s.alignment=="justify",leading:(s.lineHeight - 1)*s.sizePt*1pt,spacing:((s.lineHeight - 1)*s.sizePt+s.paragraphSpacePt)*1pt,first-line-indent:s.indentPt*1pt,linebreaks:"optimized")
#set page(width:p.width*1pt,height:p.height*1pt,binding:left,fill:white,margin:(top:p.margins.top*1pt,bottom:p.margins.bottom*1pt,inside:(p.margins.inside+p.gutter)*1pt,outside:p.margins.outside*1pt),bleed:if p.bleed {(top:9pt,bottom:9pt,outside:9pt,inside:0pt)} else {0pt},header:context {
 let n=here().page();let sec=section-on(n)
 if sec!=none and sec.value.zone=="body" and not starts().any(x=>x.location().page()==n and x.value.kind in ("chapter","part")) {text(size:9pt,align(if calc.odd(n){right}else{left},text(head-value(if calc.odd(n){o.headerRight}else{o.headerLeft},sec))))}
},footer:context {
 let n=here().page();let sec=section-on(n)
 if sec!=none and o.footer!="none" and not (sec.value.generator in ("title","copyright") or sec.value.kind=="part") {align(if o.footer=="center" {center} else if calc.odd(n){right}else{left},text(size:9pt,number-on(n)))}
})
#show heading: it => block(width:100%,sticky:true,inset:(top:o.chapterAbove*1pt),below:o.chapterBelow*1pt)[#align(align-for(o.chapterAlign),text(font:book.chapterFont,style:if o.at("chapterItalic",default:false){"italic"}else{"normal"},size:if it.level==1{o.chapterSize*1pt}else{14pt},weight:"regular",it.body))]
#let nodes(items) = {
 for n in items {
 let kids = n.at("children",default:())
 if n.kind=="text" {let c=text(n.at("text",default:""));for m in n.at("marks",default:()) {c=if m.kind=="strong" {strong(c)} else if m.kind=="emphasis" {emph(c)} else if m.kind=="underline" {underline(c)} else if m.kind=="strike" {strike(c)} else if m.kind=="code" {text(font:"DejaVu Sans Mono",c)} else if m.kind=="link" {link(m.href,c)} else {c}};c}
 else if n.kind=="paragraph" {nodes(kids);parbreak()}
 else if n.kind=="heading" {heading(level:calc.max(2,n.at("level",default:2)),outlined:false,nodes(kids))}
 else if n.kind=="lineBreak" {linebreak()}
 else if n.kind=="sceneBreak" and book.style.shared.sceneBreak!="none" {block(above:12pt,below:12pt,sticky:true,align(center,if book.style.shared.sceneBreak=="ornament" {text("* * *")}else{v(8pt)}))}
 else if n.kind in ("specialText","blockquote") {
 let t=book.specialText.at(n.at("printStyleKey",default:n.role))
 block(width:100%,breakable:true,inset:(left:t.leftPt*1pt,right:t.rightPt*1pt),above:t.spacePt*1pt,below:t.spacePt*1pt)[
 #set text(font:t.font,size:t.sizePt*1pt,style:if t.italic {"italic"}else{"normal"})
 #set par(justify:t.alignment=="justify",first-line-indent:t.indentPt*1pt,leading:(t.lineHeight - 1)*t.sizePt*1pt,spacing:((t.lineHeight - 1)*t.sizePt+t.spacePt)*1pt)
 #align(align-for(t.alignment),nodes(kids))
 ]
 }
 else if n.kind=="blockquote" {block(inset:(left:18pt,right:18pt),nodes(kids))}
 else if n.kind=="bulletList" {list(..kids.map(k=>nodes(k.at("children",default:()))))}
 else if n.kind=="orderedList" {enum(start:n.at("start",default:1),..kids.map(k=>nodes(k.at("children",default:()))))}
 else if n.kind=="codeBlock" {block(nodes(kids))}
 else if n.kind=="image" {
 let im=n.image; let width=if "placedWidth" in im {im.placedWidth*1pt} else if im.sizing=="inline" {60%}else{100%}
 let alignment=if im.at("alignment",default:"center")=="left"{left}else if im.at("alignment",default:"center")=="right"{right}else{center}
 block(width:100%,breakable:im.caption.len()>500,above:12pt,below:12pt)[#align(alignment,image(im.local,width:width,height:if "placedHeight" in im {im.placedHeight*1pt} else if im.sizing=="full-page"{(p.height - p.margins.top - p.margins.bottom - 36)*1pt}else{auto},fit:"contain",alt:im.alt))#if im.caption!="" {align(center,text(size:9pt,im.caption))}]
 } else {nodes(kids)}
 }
}
#let chapter=0
#for (i,sec) in book.sections.enumerate() {
 if i>0 and sec.kind!="scene" and sec.kind!="folder" {pagebreak(to:if sec.kind in ("chapter","part") and p.chapterStart=="recto" {"odd"}else{none})}
 [#metadata((id:sec.id,title:sec.title,kind:sec.kind,zone:sec.zone,generator:sec.at("generator",default:""))) <ph-start>]
 context [#metadata((id:sec.id,page:here().page(),number:number-on(here().page()))) <ph-map>]
 if sec.at("generator",default:"")=="title" {v(60pt);align(center)[#set par(first-line-indent:0pt,spacing:18pt)
 #text(font:book.chapterFont,size:28pt,book.metadata.title)#parbreak()
 #text(size:16pt,book.metadata.subtitle)#parbreak()#text(size:14pt,book.metadata.author)#parbreak()#for contributor in book.metadata.contributors {text(size:12pt,contributor);parbreak()}#text(book.metadata.publisher)
 ]}
 else if sec.at("generator",default:"")=="copyright" {set par(first-line-indent:0pt);text(size:9pt,nodes(sec.nodes))}
 else if sec.at("generator",default:"")=="contents" {heading(level:1,outlined:false,text(sec.title));context {for nav in sec.navigation {let dest=starts().find(x=>x.value.id==nav.id);if dest!=none {block(width:100%)[#link(dest.location())[#text(nav.title) #box(width:1fr,repeat[.]) #number-on(dest.location().page())]]}}}}
 else {if sec.kind in ("chapter","part") {if sec.kind=="chapter" {chapter+=1};heading(level:1,if sec.kind=="chapter" and book.style.shared.chapterHeading=="number-title" {text(str(chapter)+". "+sec.title)}else{text(sec.title)})}else if sec.kind=="page" {heading(level:1,outlined:false,text(sec.title))};nodes(sec.nodes)}
 [#metadata(sec.id) <ph-end>]
}
