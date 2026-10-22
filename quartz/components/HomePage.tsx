import { QuartzComponent, QuartzComponentConstructor } from "./types"
import { FullSlug, resolveRelative } from "../util/path"
import { Date as DisplayDate, getDate } from "./Date"
import readingTime from "reading-time"

export default (() => {
  const HomePage: QuartzComponent = ({ fileData, allFiles, cfg }) => {
    const href = (slug: string) => resolveRelative(fileData.slug!, slug as FullSlug)
    const articles = allFiles.filter(f => f.frontmatter?.kind === "article" && f.frontmatter?.draft !== true)
      .sort((a, b) => (b.dates?.modified?.getTime() ?? 0) - (a.dates?.modified?.getTime() ?? 0))
    const directions = [
      { slug: "notes/index", title: "学习笔记", detail: "C / C++ · RTOS · 驱动基础" },
      { slug: "research/index", title: "问题分析", detail: "现象、线索、推导与验证" },
      { slug: "projects/index", title: "项目实践", detail: "设计取舍、调试过程与复盘" },
    ]
    return <div class="home-page">
      <section class="home-hero" aria-label="个人介绍与笔记方向">
        <div class="home-intro">
          <div class="intro-eyebrow">嵌入式软件工程师的学习记录</div>
          <h1>把问题想明白，<br /><span>把过程记下来。</span></h1>
          <p>整理学过的知识，也留下还在琢磨的问题。<br />从原理、源码到实践，让每一次探索都有迹可循。</p>
          <div class="intro-links"><a href={href("archives")}>阅读文章 →</a><a href={href("about")}>关于我</a></div>
        </div>
        <aside class="note-directions" aria-label="笔记方向">
          <p class="directions-label">笔记方向</p>
          {directions.map(direction => <a href={href(direction.slug)} class="direction-link"><strong>{direction.title}<span aria-hidden="true">↗</span></strong><span>{direction.detail}</span></a>)}
        </aside>
      </section>
      <section class="home-entries" aria-label="最新文章">
        <div class="feed-heading"><h2>最近更新</h2><span>共 {articles.length} 篇文章</span></div>
        {articles.length ? articles.slice(0, 10).map(note => {
          const date = getDate(cfg, note)
          const minutes = Math.max(1, Math.ceil(readingTime(note.text ?? "").minutes))
          return <article class="post-entry">
            <div class="entry-date"><span>更新于</span>{date && <DisplayDate date={date} locale={cfg.locale} />}</div>
            <div class="entry-content">
              <h3><a href={href(note.slug!)}>{String(note.frontmatter?.title)}</a></h3>
              <p class="post-description">{String(note.frontmatter?.description ?? note.description ?? "")}</p>
              <div class="post-meta">{note.frontmatter?.category && <span class="entry-category">{String(note.frontmatter.category)}</span>}<span>约 {minutes} 分钟阅读</span></div>
            </div>
          </article>
        }) : <p class="empty-state">这里还没有文章。<a href={href("guides/publishing")}>从第一篇笔记开始。</a></p>}
      </section>
      <div class="writing-note"><div><strong>写作，从熟悉的工具开始。</strong><p>在语雀、飞书里记录，整理后发布到这里。</p></div><a href={href("guides/publishing")}>查看发布指南 →</a></div>
    </div>
  }
  return HomePage
}) satisfies QuartzComponentConstructor
