import { QuartzComponent, QuartzComponentConstructor } from "./types"
import { FullSlug, resolveRelative, simplifySlug } from "../util/path"

const entries = [["archives", "文章"], ["tags/index", "标签"], ["projects/index", "项目"], ["journal/index", "随记"], ["about", "关于"]]
export default (() => {
  const SiteNavigation: QuartzComponent = ({ fileData }) => <nav class="site-navigation" aria-label="网站导航">
    {entries.map(([slug, label]) => {
      const current = simplifySlug(fileData.slug!)
      const target = simplifySlug(slug as FullSlug)
      const active = current === target || current.startsWith(target + (target.endsWith("/") ? "" : "/")) || (slug === "archives" && fileData.frontmatter?.kind === "article" && /^(notes|research)\//.test(current))
      return <a href={resolveRelative(fileData.slug!, slug as FullSlug)} class={active ? "nav-item active" : "nav-item"} aria-current={active ? "page" : undefined}>{label}</a>
    })}
  </nav>
  return SiteNavigation
}) satisfies QuartzComponentConstructor
