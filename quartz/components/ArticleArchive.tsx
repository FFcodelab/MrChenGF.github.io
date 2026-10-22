import { QuartzComponent, QuartzComponentConstructor } from "./types"
import { FullSlug, resolveRelative } from "../util/path"
import { Date as DisplayDate, getDate } from "./Date"

export default (() => {
  const ArticleArchive: QuartzComponent = ({ fileData, allFiles, cfg }) => {
    const notes = allFiles.filter(f => f.frontmatter?.kind === "article" && f.frontmatter?.draft !== true)
      .sort((a, b) => (b.dates?.modified?.getTime() ?? 0) - (a.dates?.modified?.getTime() ?? 0))
    return <section class="article-archive" aria-label="文章归档">
      <p class="archive-count">共 {notes.length} 篇文章</p>
      {notes.map(note => {
        const date = getDate(cfg, note)
        return <div class="archive-row">{date && <DisplayDate date={date} locale={cfg.locale} />}<a href={resolveRelative(fileData.slug!, note.slug as FullSlug)}>{String(note.frontmatter?.title)}</a></div>
      })}
    </section>
  }
  return ArticleArchive
}) satisfies QuartzComponentConstructor
