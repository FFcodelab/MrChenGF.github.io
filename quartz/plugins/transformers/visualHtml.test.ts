import test from "node:test"
import assert from "node:assert/strict"
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import { visit } from "unist-util-visit"
import { visualHtmlToMarkdown } from "./visualHtml"

const header = "---\neditor: visual-html\ntitle: 协议测试\nkind: article\n---\n\n"
const parse = (source: string) => unified().use(remarkParse).use(remarkGfm).use(remarkMath).parse(source.replace(/^---\n[\s\S]*?\n---\n/, ""))

test("ordinary Markdown remains byte-for-byte unchanged", () => {
  const source = "---\ntitle: 普通文章\n---\n\n# 标题\n\n```c\nint value = 1;\n```\n"
  assert.equal(visualHtmlToMarkdown(source), source)
  assert.equal(visualHtmlToMarkdown("<p>No frontmatter</p>"), "<p>No frontmatter</p>")
})

test("HTML preserves technical headings, code, table cells, links and metadata", () => {
  const code = '#include <stdint.h>\nuint32_t mask = 1U << 3;\n// 中文说明'
  const source = header + '<h2>通信原理</h2><p>正文 <code>A &lt; B</code></p>' +
    '<pre><code class="language-c">#include &lt;stdint.h&gt;\nuint32_t mask = 1U &lt;&lt; 3;\n// 中文说明</code></pre>' +
    '<table><thead><tr><th>协议</th><th>时钟</th></tr></thead><tbody><tr><td>I2C</td><td>SCL</td></tr></tbody></table>' +
    '<p><a href="../guides/publishing.md">指南</a><img src="../assets/uploads/test.png" alt="波形"></p>'
  const result = visualHtmlToMarkdown(source)
  assert.ok(result.startsWith(header))
  const tree = parse(result)
  const codes: string[] = [], cells: string[] = [], headings: number[] = [], links: string[] = [], images: string[] = []
  visit(tree, "code", node => { assert.equal(node.lang, "c"); codes.push(node.value) })
  visit(tree, "tableCell", node => { visit(node, "text", text => { cells.push(text.value) }) })
  visit(tree, "heading", node => { headings.push(node.depth) })
  visit(tree, "link", node => { links.push(node.url) })
  visit(tree, "image", node => { images.push(node.url) })
  assert.deepEqual(codes, [code])
  assert.deepEqual(cells, ["协议", "时钟", "I2C", "SCL"])
  assert.deepEqual(headings, [2])
  assert.deepEqual(links, ["../guides/publishing.md"])
  assert.deepEqual(images, ["../assets/uploads/test.png"])
})

test("display math remains a math block after HTML editor whitespace normalization", () => {
  const tree = parse(visualHtmlToMarkdown(header + '<p>$$ E = mc^2 $$</p><p>正文</p>'))
  const equations: string[] = []
  visit(tree, "math", node => { equations.push(node.value) })
  assert.deepEqual(equations, ["E = mc^2"])
})

test("code indentation and terminal blank lines survive conversion", () => {
  const tree = parse(visualHtmlToMarkdown(header + '<pre><code class="language-c">int main(void) {\n    return 0;\n}\n\n\n</code></pre>'))
  const codes: string[] = []
  visit(tree, "code", node => { codes.push(node.value) })
  assert.deepEqual(codes, ['int main(void) {\n    return 0;\n}\n\n'])
})
