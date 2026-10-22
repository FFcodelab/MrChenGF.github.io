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
        header: "system-ui",
        body: "system-ui",
        code: "Consolas",
      },
      colors: {
        lightMode: {
          light: "#f7f8f5",
          lightgray: "#e0e5dd",
          gray: "#9aa59b",
          darkgray: "#526057",
          dark: "#1e3028",
          secondary: "#28745b",
          tertiary: "#439a77",
          highlight: "rgba(40, 116, 91, 0.08)",
          textHighlight: "#e2efc3",
        },
        darkMode: {
          light: "#14201b",
          lightgray: "#2a3b32",
          gray: "#849b8d",
          darkgray: "#bdcec3",
          dark: "#e4eee7",
          secondary: "#8cc7a5",
          tertiary: "#b1d9ab",
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
