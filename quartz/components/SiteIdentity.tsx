import { QuartzComponent, QuartzComponentConstructor } from "./types"
import { pathToRoot } from "../util/path"

export default (() => {
  const SiteIdentity: QuartzComponent = ({ fileData }) => (
    <div class="site-identity">
      <a href={pathToRoot(fileData.slug!)} class="brand-link" aria-label="MrChenGF 首页">
        <strong>MrChenGF</strong><span class="brand-caption">的笔记</span>
      </a>
    </div>
  )
  return SiteIdentity
}) satisfies QuartzComponentConstructor
