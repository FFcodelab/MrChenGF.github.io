import { QuartzComponent, QuartzComponentConstructor } from "./types"
import { FullSlug, resolveRelative, simplifySlug } from "../util/path"

const entries = [["index", "01", "首页"], ["notes/index", "02", "技术笔记"], ["research/index", "03", "问题分析"], ["projects/index", "04", "项目实践"], ["journal/index", "05", "随记"], ["about", "06", "关于我"]]
export default (() => {
  const SiteNavigation: QuartzComponent = ({ fileData }) => <nav class="site-navigation" aria-label="网站导航">
    {entries.map(([slug, number, label]) => {
      const current = simplifySlug(fileData.slug!)
      const target = simplifySlug(slug as FullSlug)
      const active = target === "/" ? current === "/" : current === target || current.startsWith(target)
      return <a href={resolveRelative(fileData.slug!, slug as FullSlug)} class={active ? "nav-item active" : "nav-item"} aria-current={active ? "page" : undefined}><span class="nav-number">{number}</span><span>{label}</span><span class="nav-arrow" aria-hidden="true">↗</span></a>
    })}
    <a class="nav-guide" href={resolveRelative(fileData.slug!, "guides/publishing" as FullSlug)}>写作与发布指南 <span aria-hidden="true">↗</span></a>
  </nav>
  return SiteNavigation
}) satisfies QuartzComponentConstructor
