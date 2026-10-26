import { QuartzComponent, QuartzComponentConstructor } from "./types"
import { FullSlug, resolveRelative } from "../util/path"
import { getDate } from "./Date"

export default (() => {
  const ArticleArchive: QuartzComponent = ({ fileData, allFiles, cfg }) => {
    const notes = allFiles.filter(f => f.frontmatter?.kind === "article" && f.frontmatter?.draft !== true)
      .sort((a, b) => (b.dates?.modified?.getTime() ?? 0) - (a.dates?.modified?.getTime() ?? 0))
    const years = [...new Set(notes.map(note => getDate(cfg, note)?.getFullYear().toString() ?? "未标注日期"))]
    return <section class="article-archive" aria-label="文章归档">
      <p class="archive-count">共 {notes.length} 篇文章</p>
      {years.map(year => <section class="archive-year">
        <h2>{year}</h2>
        <div class="archive-list">{notes.filter(note => (getDate(cfg, note)?.getFullYear().toString() ?? "未标注日期") === year).map(note => {
          const date = getDate(cfg, note)
          return <div class="archive-row">
            {date && <time dateTime={date.toISOString()}>{new Intl.DateTimeFormat(cfg.locale, { month: "2-digit", day: "2-digit" }).format(date)}</time>}
            <a href={resolveRelative(fileData.slug!, note.slug as FullSlug)}>{String(note.frontmatter?.title)}</a>
            <span class="archive-category">{String(note.frontmatter?.category ?? "")}</span>
          </div>
        })}</div>
      </section>)}
      {!notes.length && <p class="empty-state">还没有公开的文章。</p>}
    </section>
  }
  return ArticleArchive
}) satisfies QuartzComponentConstructor
