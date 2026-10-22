import fs from "node:fs/promises"
import path from "node:path"
import matter from "gray-matter"
import { unified } from "unified"
import remarkParse from "remark-parse"
import { visit } from "unist-util-visit"

const root = path.resolve("content")
const errors = []
let count = 0
async function walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) { await walk(file); continue }
    if (!entry.name.endsWith(".md")) continue
    const { data, content } = matter(await fs.readFile(file, "utf8"))
    if (data.draft === true) continue
    count++
    const name = path.relative(root, file)
    if (!data.title || typeof data.title !== "string") errors.push(`${name}: 缺少文章标题`)
    const tree = unified().use(remarkParse).parse(content)
    const references = []
    visit(tree, node => { if (node.type === "image" || node.type === "link") references.push(node) })
    for (const node of references) {
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(node.url)) continue
      const destination = decodeURIComponent(node.url.split(/[?#]/)[0])
      if (!destination) continue
      const resolved = path.resolve(path.dirname(file), destination)
      if (!resolved.startsWith(root + path.sep)) { errors.push(`${name}: 本地引用超出 content 目录`); continue }
      try { await fs.access(resolved) } catch { errors.push(`${name}: 找不到 ${destination}`) }
    }
  }
}
await walk(root)
if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1 }
else console.log(`文章检查通过：${count} 篇公开页面，本地引用完整。`)
