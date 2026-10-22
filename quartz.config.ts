import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "MrChenGF",
    pageTitleSuffix: " · 嵌入式技术笔记",
    enableSPA: true,
    enablePopovers: true,
    analytics: null,
    locale: "zh-CN",
    baseUrl: "ffcodelab.github.io/MrChenGF.github.io",
    ignorePatterns: ["private", "templates", ".obsidian"],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "local",
      cdnCaching: false,
      typography: {
        header: "Microsoft YaHei",
        body: "Microsoft YaHei",
        code: "Consolas",
      },
      colors: {
        lightMode: {
          light: "#fafbf9",
          lightgray: "#e4e8e4",
          gray: "#858585",
          darkgray: "#666666",
          dark: "#202020",
          secondary: "#32655d",
          tertiary: "#55867c",
          highlight: "rgba(50, 101, 93, 0.06)",
          textHighlight: "#dcebe2",
        },
        darkMode: {
          light: "#1d1d1d",
          lightgray: "#343434",
          gray: "#9a9a9a",
          darkgray: "#c6c6c6",
          dark: "#ededed",
          secondary: "#9ac2b5",
          tertiary: "#bad8ce",
          highlight: "rgba(140, 199, 165, 0.1)",
          textHighlight: "#395e41",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "mathjax" }),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
      // Comment out CustomOgImages to speed up build time
    ],
  },
}

export default config

