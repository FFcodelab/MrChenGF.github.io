import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"
import SiteIdentity from "./quartz/components/SiteIdentity"
import SiteNavigation from "./quartz/components/SiteNavigation"
import HomePage from "./quartz/components/HomePage"

const isArticle = (page: { fileData: { slug?: string } }) => page.fileData.slug !== "index"
const navigation = [
  SiteIdentity(),
  Component.Flex({ components: [
    { Component: Component.Search(), grow: true },
    { Component: Component.Darkmode() },
  ] }),
  SiteNavigation(),
  Component.ConditionalRender({ component: Component.DesktopOnly(Component.Explorer()), condition: isArticle }),
]
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(), header: [], afterBody: [],
  footer: Component.Footer({ links: { "文章源码": "https://github.com/FFcodelab/MrChenGF.github.io", "RSS 订阅": "https://ffcodelab.github.io/MrChenGF.github.io/index.xml" } }),
}
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({ component: HomePage(), condition: page => page.fileData.slug === "index" }),
    ...[Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta(), Component.TagList()].map(component => Component.ConditionalRender({ component, condition: isArticle })),
  ],
  left: navigation,
  right: [
    Component.ConditionalRender({ component: Component.DesktopOnly(Component.TableOfContents()), condition: isArticle }),
    Component.ConditionalRender({ component: Component.Backlinks(), condition: isArticle }),
  ],
}
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle()],
  left: navigation, right: [],
}
