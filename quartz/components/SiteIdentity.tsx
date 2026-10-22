import { QuartzComponent, QuartzComponentConstructor } from "./types"
import { pathToRoot } from "../util/path"

export default (() => {
  const SiteIdentity: QuartzComponent = ({ fileData }) => (
    <div class="site-identity">
      <a href={pathToRoot(fileData.slug!)} class="brand-link" aria-label="MrChenGF 首页">
        <span class="brand-mark" aria-hidden="true">M<span>_</span></span>
        <span class="brand-copy"><strong>MrChenGF</strong><small>嵌入式 · 学习 · 实践</small></span>
      </a>
      <div class="brand-caption">A PERSONAL ENGINEERING NOTEBOOK</div>
    </div>
  )
  return SiteIdentity
}) satisfies QuartzComponentConstructor
