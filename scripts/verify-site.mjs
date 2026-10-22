import fs from "node:fs/promises"
import path from "node:path"

const root = path.resolve("public")
const base = "https://ffcodelab.github.io/MrChenGF.github.io/"
const prefix = new URL(base).pathname
const errors = new Set()
let pages = 0
let links = 0
async function walk(dir) {
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name)
    if (item.isDirectory()) { await walk(file); continue }
    if (!file.endsWith(".html")) continue
    pages++
    const text = await fs.readFile(file, "utf8")
    const fileUrl = new URL(path.relative(root, file).split(path.sep).join("/"), base)
    for (const match of text.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const raw = match[1].replaceAll("&amp;", "&")
      if (/^(data:|mailto:|tel:|#)/i.test(raw)) continue
      let url
      try { url = new URL(raw, fileUrl) } catch { continue }
      if (url.origin !== fileUrl.origin) continue
      if (url.pathname !== prefix.slice(0, -1) && !url.pathname.startsWith(prefix)) { errors.add(`${path.relative(root, file)}: 引用离开项目路径 ${url.pathname}`); continue }
      const relative = url.pathname === prefix.slice(0, -1) ? "" : decodeURIComponent(url.pathname.slice(prefix.length))
      const target = path.resolve(root, relative)
      const candidates = [target, `${target}.html`, path.join(target, "index.html")]
      let exists = false
      for (const candidate of candidates) { try { if ((await fs.stat(candidate)).isFile()) exists = true } catch {} }
      links++
      if (!exists) errors.add(`${path.relative(root, file)}: 找不到 ${relative}`)
    }
  }
}
await walk(root)
const index = JSON.parse(await fs.readFile(path.join(root, "static", "contentIndex.json"), "utf8"))
if (!Object.keys(index).length) errors.add("搜索索引为空")
for (const entry of Object.values(index)) if (entry.title === "待填写") errors.add("模板内容意外公开")
if (errors.size) { console.error([...errors].join("\n")); process.exitCode = 1 }
else console.log(`站点检查通过：${pages} 个页面、${links} 个站内引用、${Object.keys(index).length} 条搜索记录。`)
