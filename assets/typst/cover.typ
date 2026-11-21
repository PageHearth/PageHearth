#let d = json("cover.json")
#let g = d.g
#set page(width:g.width * 1pt,height:g.height * 1pt,margin:0pt)
#set document(title:"Cover")
#place(top + left, rect(width:g.width * 1pt,height:g.height * 1pt,fill:rgb(d.c.backColor),stroke:none))
#place(top + left, dx:(g.bleed + g.trimWidth) * 1pt, rect(width:g.spine * 1pt,height:g.height * 1pt,fill:rgb(d.c.spineColor),stroke:none))
#for p in d.panels {
 place(top + left,dx:p.x * 1pt,box(width:p.width * 1pt,height:p.height * 1pt,clip:true)[#place(top + left,dx:p.placement.x * 1pt,dy:p.placement.y * 1pt,image(p.file,width:p.placement.width * 1pt,height:p.placement.height * 1pt,fit:"stretch"))])
}
#if d.text != "" {
 set text(font:d.c.spine.font,size:d.c.spine.size * 1pt,weight:if d.c.spine.bold {"bold"} else {"regular"},fill:rgb(d.c.spine.color))
 context {
 let t = text(d.text)
 let m = measure(t)
 assert(m.width <= (g.trimHeight - 36) * 1pt, message:"Spine text is too long. Shorten it or reduce font size.")
 assert(m.height <= (g.spine - 2 * g.spineSafe) * 1pt, message:"Spine text is too wide for the safe area. Reduce font size or hide it.")
 place(top + left,dx:(g.bleed + g.trimWidth + g.spine / 2) * 1pt - m.height / 2,dy:g.height / 2 * 1pt - m.width / 2,rotate(90deg,reflow:true,box(t)))
 }
}
