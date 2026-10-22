import { QuartzComponent, QuartzComponentConstructor } from "./types"
import { FullSlug, resolveRelative } from "../util/path"

export default (() => {
  const HomePage: QuartzComponent = ({ fileData, allFiles }) => {
    const href = (slug: string) => resolveRelative(fileData.slug!, slug as FullSlug)
    const notes = allFiles.filter(f => f.frontmatter?.kind === "article" && f.frontmatter?.draft !== true).sort((a, b) => (b.dates?.modified?.getTime() ?? 0) - (a.dates?.modified?.getTime() ?? 0)).slice(0, 5)
    return <div class="home-page">
      <div class="home-topline"><span><i /> 持续记录，保持好奇</span><span>MRCHENGF / FIELD NOTES</span></div>
      <section class="home-hero">
        <div class="hero-copy"><div class="eyebrow">从代码出发，向原理深入</div><h1>把问题追到底。<br /><span>把经验留下来。</span></h1><p>一个嵌入式软件工程师的技术笔记。<br />记录学习中的理解、实践中的问题，以及值得留下的思考。</p><div class="hero-actions"><a class="primary-link" href={href("notes/index")}>翻开技术笔记 <span>↗</span></a><a class="quiet-link" href={href("about")}>关于这个网站 →</a></div></div>
        <div class="hero-sketch" aria-hidden="true"><div class="sketch-label">ENGINEERING / IN PROGRESS</div><div class="signal-lines"><svg viewBox="0 0 300 100"><path d="M0 70H35V30H70V70H105V30H140V70H175V30H210V70H245V30H280V70H300" /><path class="signal-muted" d="M0 85H300M0 15H300" /></svg></div><div class="code-note"><span class="code-comment">// keep asking why</span><br /><span class="code-keyword">while</span> (curious) {'{'}<br /><span class="code-indent">observe();</span><br /><span class="code-indent">understand();</span><br /><span class="code-indent">write_it_down();</span><br />{'}'}</div><div class="sketch-foot"><span>从现象 → 证据 → 原理</span><span>01 / ∞</span></div></div>
      </section>
      <div class="section-heading"><div><span class="eyebrow">EXPLORE THE NOTEBOOK</span><h2>沿着问题，慢慢积累</h2></div><span class="section-aside">笔记可以零散，思考保持连贯。</span></div>
      <div class="topic-grid">{[["notes/index", "01", "技术笔记", "理解原理，整理知识。", "C / C++ · RTOS · 驱动 · 通信"], ["research/index", "02", "问题分析", "追踪现象，留下证据。", "调试 · 实验 · 根因 · 验证"], ["projects/index", "03", "项目实践", "记录过程，也记录取舍。", "设计 · 实现 · 测试 · 复盘"], ["journal/index", "04", "随记", "给尚未成形的想法留个位置。", "阅读 · 灵感 · 日常学习"]].map(([url, num, title, subtitle, meta]) => <a class="topic-card" href={href(url)}><span class="topic-top"><span>{num}</span><span>↗</span></span><h3>{title}</h3><p>{subtitle}</p><small>{meta}</small></a>)}</div>
      <div class="section-heading latest-heading"><div><span class="eyebrow">RECENT ENTRIES</span><h2>最近留下的记录</h2></div><a href={href("notes/index")}>查看笔记 →</a></div>
      {notes.length > 0 ? <div class="home-entries">{notes.map(note => <a class="home-entry" href={href(note.slug!)}><div><span class="entry-label">{String(note.frontmatter?.category ?? "技术记录")}</span><h3>{String(note.frontmatter?.title)}</h3><p>{String(note.frontmatter?.description ?? "")}</p></div><span class="entry-arrow">↗</span></a>)}</div> : <div class="empty-entry"><span>✎</span><div><h3>下一篇记录，从一个真实问题开始。</h3><p>把写好的语雀或飞书笔记整理进来，它就会出现在这里。</p></div><a href={href("guides/publishing")}>开始发布 →</a></div>}
      <a class="writing-banner" href={href("guides/publishing")}><div><span class="eyebrow">KEEP YOUR WRITING HABIT</span><h3>继续在语雀、飞书写作。</h3><p>把值得分享的内容，留在自己的技术博客。</p></div><span class="banner-arrow">↗</span></a>
    </div>
  }
  return HomePage
}) satisfies QuartzComponentConstructor
