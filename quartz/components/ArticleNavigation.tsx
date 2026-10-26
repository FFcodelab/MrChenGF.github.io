import { QuartzComponent, QuartzComponentConstructor } from "./types"
import { FullSlug, resolveRelative } from "../util/path"

export default (() => {
  const ArticleNavigation: QuartzComponent = ({ fileData, allFiles }) => {
    const notes = allFiles.filter(note => note.frontmatter?.kind === "article" && note.frontmatter?.draft !== true)
      .sort((a, b) => (b.dates?.modified?.getTime() ?? 0) - (a.dates?.modified?.getTime() ?? 0))
    const index = notes.findIndex(note => note.slug === fileData.slug)
    const newer = notes[index - 1]
    const older = index >= 0 ? notes[index + 1] : undefined
    const href = (slug: FullSlug) => resolveRelative(fileData.slug!, slug)
    const sourcePath = fileData.relativePath?.replaceAll("\\", "/")
    const section = sourcePath?.split("/")[0]
    const editUrl = sourcePath && section && ["notes", "research", "projects", "journal"].includes(section)
      ? `https://app.pagescms.org/FFcodelab/MrChenGF.github.io/main/collection/${section}/edit/${encodeURIComponent(`content/${sourcePath}`)}`
      : undefined
    return <nav class="article-navigation" aria-label="继续阅读">
      <div class="article-return"><a href={href("archives" as FullSlug)}>← 所有文章</a>{editUrl && <a href={editUrl} target="_blank" rel="noopener noreferrer">编辑这篇文章 ↗</a>}<a href="#quartz-root">回到顶部 ↑</a></div>
      <div class="adjacent-articles">
        {newer && <a href={href(newer.slug!)}><span>较新的记录</span><strong>{String(newer.frontmatter?.title)}</strong></a>}
        {older && <a href={href(older.slug!)}><span>较早的记录</span><strong>{String(older.frontmatter?.title)}</strong></a>}
      </div>
    </nav>
  }
  return ArticleNavigation
}) satisfies QuartzComponentConstructor
