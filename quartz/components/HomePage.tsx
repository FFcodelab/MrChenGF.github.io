import { QuartzComponent, QuartzComponentConstructor } from "./types"
import { FullSlug, resolveRelative } from "../util/path"
import { Date as DisplayDate, getDate } from "./Date"
import readingTime from "reading-time"

export default (() => {
  const HomePage: QuartzComponent = ({ fileData, allFiles, cfg }) => {
    const href = (slug: string) => resolveRelative(fileData.slug!, slug as FullSlug)
    const articles = allFiles.filter(f => f.frontmatter?.kind === "article" && f.frontmatter?.draft !== true)
      .sort((a, b) => (b.dates?.modified?.getTime() ?? 0) - (a.dates?.modified?.getTime() ?? 0))
    const topics = [["notes/index", "学习笔记"], ["research/index", "问题分析"], ["projects/index", "项目实践"]]
    return <div class="home-page">
      <section class="home-hero" aria-label="关于这个博客">
        <div class="home-intro">
          <p class="intro-eyebrow"><span aria-hidden="true" />嵌入式软件工程师的技术笔记</p>
          <h1>记录，理解，再实践。</h1>
          <p class="intro-description">记录学习中弄懂的知识，也留下调试时走过的弯路。<br />关于 C / C++、RTOS、接口协议，以及还在琢磨的问题。</p>
          <div class="intro-links"><a href={href("about")}>关于我 <span aria-hidden="true">↗</span></a><a href="https://github.com/FFcodelab">GitHub <span aria-hidden="true">↗</span></a></div>
        </div>
      </section>
      <nav class="topic-links" aria-label="按主题浏览">{topics.map(([slug, title]) => <a href={href(slug)}>{title}<span aria-hidden="true">↗</span></a>)}</nav>
      <section class="home-entries" aria-label="最新文章">
        <div class="feed-heading"><h2>最近的记录 <span>{articles.length}</span></h2><a href={href("archives")}>全部文章 <span aria-hidden="true">→</span></a></div>
        {articles.length ? articles.slice(0, 10).map(note => {
          const date = getDate(cfg, note)
          const minutes = Math.max(1, Math.ceil(readingTime(note.text ?? "").minutes))
          return <article class="post-entry">
            <div class="entry-content">
              <div class="entry-heading"><h3><a class="post-title-link" href={href(note.slug!)}>{String(note.frontmatter?.title)}</a></h3><span class="entry-arrow" aria-hidden="true">↗</span></div>
              <p class="post-description">{String(note.frontmatter?.description ?? note.description ?? "")}</p>
              <div class="post-meta">{date && <DisplayDate date={date} locale={cfg.locale} />}<span>约 {minutes} 分钟阅读</span>{note.frontmatter?.category && <span class="entry-category">{String(note.frontmatter.category)}</span>}</div>
            </div>
          </article>
        }) : <p class="empty-state">这里还没有文章。<a href={href("guides/publishing")}>从第一篇笔记开始。</a></p>}
      </section>
    </div>
  }
  return HomePage
}) satisfies QuartzComponentConstructor
