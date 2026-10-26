import { QuartzTransformerPlugin } from "../types"
import { unified } from "unified"
import rehypeParse from "rehype-parse"
import { defaultHandlers, toMdast } from "hast-util-to-mdast"
import { toHtml } from "hast-util-to-html"
import { toString as htmlText } from "hast-util-to-string"
import remarkGfm from "remark-gfm"
import remarkStringify from "remark-stringify"
import { load } from "js-yaml"
import { visit } from "unist-util-visit"

// Pages CMS saves HTML directly, avoiding a lossy editor-side Markdown conversion.
// Only marked articles use this adapter; ordinary Markdown follows the existing path.
export const visualHtmlToMarkdown = (source: string): string => {
  const match = source.match(/^(---\r?\n[\s\S]*?\r?\n---)(?:\r?\n|$)([\s\S]*)$/)
  if (!match) return source
  const data = load(match[1].replace(/^---\r?\n/, "").replace(/\r?\n---$/, ""))
  if (!data || typeof data !== "object" || !("editor" in data) || data.editor !== "visual-html") return source

  const html = unified().use(rehypeParse, { fragment: true }).parse(match[2])
  const markdown = toMdast(html, {
    handlers: {
      // Keep the original exported notes' colored text until it is edited.
      font: (_state, node) => ({ type: "html", value: toHtml(node) }),
      pre: (state, node) => {
        const code = defaultHandlers.pre(state, node)
        if (code && !Array.isArray(code) && code.type === "code") {
          code.value = htmlText(node).replace(/\r?\n$/, "")
        }
        return code
      },
    },
  })
  if (markdown.type !== "root") throw new Error("Expected an HTML document fragment")
  visit(markdown, "paragraph", node => {
    if (!node.children.every(child => child.type === "text")) return
    const text = node.children.map(child => "value" in child ? child.value : "").join("").trim()
    if (text.startsWith("$$") && text.endsWith("$$") && text.length > 4) {
      node.children = [{ type: "text", value: `$$\n${text.slice(2, -2).trim()}\n$$` }]
    }
  })
  const compiler = unified().use(remarkGfm).use(remarkStringify, { fences: true })
  return `${match[1]}\n\n${compiler.stringify(markdown)}`
}

export const VisualHtml: QuartzTransformerPlugin = () => ({
  name: "VisualHtml",
  textTransform: (_ctx, source) => visualHtmlToMarkdown(source),
})
