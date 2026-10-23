import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"
import SiteIdentity from "./quartz/components/SiteIdentity"
import SiteNavigation from "./quartz/components/SiteNavigation"
import HomePage from "./quartz/components/HomePage"
import ArticleArchive from "./quartz/components/ArticleArchive"
import { QuartzComponentProps } from "./quartz/components/types"

const isContent = (page: QuartzComponentProps) => page.fileData.slug !== "index"
const isArticle = (page: QuartzComponentProps) => page.fileData.frontmatter?.kind === "article" || page.fileData.slug === "guides/publishing"
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [SiteIdentity(), Component.Darkmode(), SiteNavigation(), Component.Search()],
  afterBody: [],
  footer: Component.Footer({ links: { "文章源码": "https://github.com/FFcodelab/MrChenGF.github.io", "RSS 订阅": "https://ffcodelab.github.io/MrChenGF.github.io/index.xml" } }),
}
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({ component: HomePage(), condition: page => page.fileData.slug === "index" }),
    Component.ConditionalRender({ component: Component.ArticleTitle(), condition: isContent }),
    Component.ConditionalRender({ component: Component.ContentMeta({ showComma: false }), condition: isArticle }),
    Component.ConditionalRender({ component: Component.TagList(), condition: isArticle }),
    Component.ConditionalRender({ component: Component.MobileOnly(Component.TableOfContents()), condition: isArticle }),
    Component.ConditionalRender({ component: ArticleArchive(), condition: page => page.fileData.slug === "archives" }),
  ],
  left: [Component.ConditionalRender({ component: Component.TableOfContents(), condition: isArticle })],
  right: [],
}
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.ArticleTitle()], left: [], right: [],
}
