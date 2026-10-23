function toggleToc(this: HTMLElement) {
  const collapsed = this.classList.toggle("collapsed")
  this.setAttribute("aria-expanded", String(!collapsed))
  this.nextElementSibling?.classList.toggle("collapsed", collapsed)
}

document.addEventListener("nav", () => {
  const tocs = Array.from(document.querySelectorAll<HTMLElement>(".toc"))
  const links = tocs.flatMap(toc => Array.from(toc.querySelectorAll<HTMLAnchorElement>("a[data-for]")))
  const ids = new Set(links.map(link => link.dataset.for))
  const headings = Array.from(document.querySelectorAll<HTMLElement>(".center > article h1[id], .center > article h2[id], .center > article h3[id], .center > article h4[id], .center > article h5[id], .center > article h6[id]"))
    .filter(heading => ids.has(heading.id))

  for (const toc of tocs) {
    const button = toc.querySelector<HTMLElement>(".toc-header")
    if (!button) continue
    button.addEventListener("click", toggleToc)
    window.addCleanup(() => button.removeEventListener("click", toggleToc))
  }
  if (!headings.length) return

  let activeId = ""
  let frame = 0
  const update = () => {
    const offset = (document.querySelector(".page > header")?.getBoundingClientRect().height ?? 76) + 40
    let current = headings[0]
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top > offset) break
      current = heading
    }
    if (current.id === activeId) return
    activeId = current.id
    for (const link of links) {
      const active = link.dataset.for === activeId
      link.classList.toggle("in-view", active)
      if (active) link.setAttribute("aria-current", "location")
      else link.removeAttribute("aria-current")
      const list = link.closest<HTMLElement>(".toc-content")
      if (!active || !list || list.classList.contains("collapsed") || !list.getClientRects().length) continue
      const entry = link.getBoundingClientRect()
      const bounds = list.getBoundingClientRect()
      if (entry.top < bounds.top || entry.bottom > bounds.bottom) {
        list.scrollTop += entry.top < bounds.top ? entry.top - bounds.top - 8 : entry.bottom - bounds.bottom + 8
      }
    }
  }
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; update() })
  }
  window.addEventListener("scroll", schedule, { passive: true })
  window.addEventListener("resize", schedule, { passive: true })
  window.addCleanup(() => {
    window.removeEventListener("scroll", schedule)
    window.removeEventListener("resize", schedule)
    if (frame) cancelAnimationFrame(frame)
  })
  schedule()
})
