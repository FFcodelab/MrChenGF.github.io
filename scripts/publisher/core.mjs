import path from "node:path"
import { createHash } from "node:crypto"
import matter from "gray-matter"
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkGfm from "remark-gfm"
import remarkRehype from "remark-rehype"
import { toHtml } from "hast-util-to-html"
import { toString } from "mdast-util-to-string"
import { visit } from "unist-util-visit"

export const sections = { notes: "学习笔记", research: "问题分析", projects: "项目实践", journal: "随记" }
export const maxAssetBytes = 10 * 1024 * 1024
const extensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif", ".pdf", ".txt", ".csv", ".zip"])
const hash = bytes => createHash("sha256").update(bytes).digest("hex")
const parse = text => unified().use(remarkParse).use(remarkGfm).parse(text)

export function parseNote(text) {
  if (typeof text !== "string" || Buffer.byteLength(text) > 1024 * 1024) throw new Error("Markdown 正文不能为空或超过 1 MB")
  text = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n")
  if (/^---[^\n\r]*\S[^\n\r]*\n/.test(text) && !/^---\s*\n/.test(text)) throw new Error("文章属性只支持普通 YAML，请删除 --- 后的语言标记")
  const parsed = matter(text)
  if (!parsed.content.trim()) throw new Error("请先选择 Markdown 文件或粘贴笔记正文")
  return parsed
}

export function inferTitle(markdown, sourcePath = "") {
  const parsed = parseNote(markdown)
  const nodes = parse(parsed.content).children
  const heading = nodes.find(node => node.type === "heading" && node.depth === 1)
  const paragraph = nodes.find(node => node.type === "paragraph")
  const filename = path.posix.basename(sourcePath) === "pasted.md" ? "" : path.posix.basename(sourcePath, path.posix.extname(sourcePath))
  return String(parsed.data.title || (heading && toString(heading)) || filename || (paragraph && toString(paragraph).slice(0, 60)) || "未命名笔记").trim()
}

export function defaultSlug(title) {
  const latin = title.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60).replace(/-$/, "")
  return /[\p{Script=Han}]/u.test(title) || !latin || latin === "index" ? `note-${hash(title.trim()).slice(0, 10)}` : latin
}

export function validTarget(target) {
  return /^content\/(notes|research|projects|journal)\/(?!index\.md$)[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(target)
}

export async function prepareNote(input, { previous = {}, resolveRemoteImage, existingPaths = new Set(), siteUrl = "", today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date()) } = {}) {
  const parsed = parseNote(input.markdown)
  const sourcePath = String(input.sourcePath || "").replaceAll("\\", "/")
  const title = String(input.title?.trim() || inferTitle(input.markdown, sourcePath)).trim()
  if (!title || title.length > 200 || /[\x00-\x1f]/.test(title)) throw new Error("标题需要是 1 至 200 个正常字符")
  const section = input.section || "notes"
  if (!sections[section]) throw new Error("请选择有效的文章栏目")
  const slug = input.targetPath ? path.posix.basename(input.targetPath, ".md") : (input.slug?.trim() || defaultSlug(title))
  const targetPath = input.targetPath || `content/${section}/${slug}.md`
  if (!validTarget(targetPath)) throw new Error("文章路径无效；文件名只能包含小写英文、数字和连字符")
  if (input.targetPath && !targetPath.startsWith(`content/${section}/`)) throw new Error("更新文章时不能直接更换栏目，请保持原栏目")
  const attached = new Map()
  for (const file of input.assets || []) {
    if (attached.size >= 100) throw new Error("一次最多选择 100 个附件")
    const name = String(file.path).replaceAll("\\", "/").replace(/^\.\//, "")
    if (path.posix.isAbsolute(name) || name.split("/").includes("..")) throw new Error("附件路径无效")
    if (typeof file.base64 !== "string" || !/^[a-z0-9+/]*={0,2}$/i.test(file.base64) || file.base64.length > Math.ceil(maxAssetBytes * 4 / 3) + 4) throw new Error(`附件内容无效或超过 10 MB：${name}`)
    const bytes = Buffer.from(file.base64, "base64")
    if (bytes.length > maxAssetBytes) throw new Error(`附件超过 10 MB：${name}`)
    attached.set(name, { bytes, extension: path.posix.extname(name).toLowerCase() })
  }
  const files = new Map()
  const resolved = new Map()
  const imageUrls = new Map()
  const resolveAsset = async (url, image) => {
    if (resolved.has(url)) return resolved.get(url)
    let asset
    if (/^https?:\/\//i.test(url)) {
      if (!image) return url
      if (!resolveRemoteImage) throw new Error(`这张图片需要先下载或一起选择：${url}`)
      asset = await resolveRemoteImage(url)
    } else {
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url)) throw new Error(`不支持的图片地址：${url}`)
      const clean = decodeURIComponent(url.split(/[?#]/)[0])
      const key = path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath || "pasted.md"), clean))
      asset = attached.get(key) || attached.get(clean)
      if (!asset) {
        const matches = [...attached].filter(([name]) => path.posix.basename(name) === path.posix.basename(clean))
        if (matches.length === 1) asset = matches[0][1]
        else if (matches.length > 1) throw new Error(`发现同名附件，请选择完整导出文件夹：${clean}`)
      }
      if (!asset) {
        // Updating an article already stored in the blog can retain its existing assets.
        const retained = path.posix.normalize(path.posix.join(path.posix.dirname(targetPath), clean))
        if (retained.startsWith("content/") && existingPaths.has(retained)) return url
        if (!image) return url
        throw new Error(`没有找到图片 ${clean}。请选包含图片的导出文件夹，或用“补充图片”一起选择。`)
      }
    }
    if (!extensions.has(asset.extension)) throw new Error(`不支持这个附件格式：${asset.extension || url}`)
    if (!asset.bytes.length || asset.bytes.length > maxAssetBytes) throw new Error(`图片或附件为空或超过 10 MB：${url}`)
    const name = `${hash(asset.bytes).slice(0, 16)}${asset.extension}`
    const destination = `content/assets/${slug}/${name}`
    files.set(destination, { path: destination, bytes: asset.bytes, binary: true })
    if ([...files.values()].reduce((sum, file) => sum + file.bytes.length, 0) > 40 * 1024 * 1024) throw new Error("本篇文章的附件合计不能超过 40 MB")
    const replacement = `../assets/${slug}/${name}`
    imageUrls.set(replacement, asset)
    resolved.set(url, replacement)
    return replacement
  }
  const tree = parse(parsed.content)
  visit(tree, node => {
    if (node.type === "html" && (/<\s*\/?\s*(script|iframe|object|embed|style|link|meta|base)\b/i.test(node.value) || /\s+on[a-z]+\s*=/i.test(node.value))) throw new Error("正文包含可执行 HTML。代码示例请放在 Markdown 代码块中，再发布。")
    if (["link", "definition"].includes(node.type) && /^(javascript|vbscript|data|file):/i.test(node.url)) throw new Error("正文包含不能公开发布的链接，请改成普通网页链接或本地附件。")
  })
  const definitions = new Map()
  const normalizeId = id => id.toLowerCase().replace(/\s+/g, " ")
  visit(tree, "definition", node => definitions.set(normalizeId(node.identifier), node))
  const references = []
  visit(tree, node => {
    if (node.type === "image") references.push({ node, image: true })
    if (node.type === "link") references.push({ node, image: false })
    if (node.type === "imageReference") {
      const definition = definitions.get(normalizeId(node.identifier))
      if (definition) references.push({ node: definition, image: true })
    }
  })
  const replacements = new Map()
  for (const { node, image } of references) {
    if (!image && (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(node.url) || !extensions.has(path.posix.extname(node.url.split(/[?#]/)[0]).toLowerCase()))) continue
    const url = await resolveAsset(node.url, image)
    if (url === node.url) continue
    const titleSuffix = node.title ? ` "${node.title.replaceAll('"', '\\"')}"` : ""
    const text = node.type === "definition" ? `[${node.label || node.identifier}]: ${url}${titleSuffix}` : (image ? `![${String(node.alt || "").replaceAll("]", "\\]")}](${url}${titleSuffix})` : `[${toString(node)}](${url}${titleSuffix})`)
    replacements.set(node.position.start.offset, { start: node.position.start.offset, end: node.position.end.offset, text })
  }
  // HTML images are common in exported notes; keep them portable as Markdown images.
  const htmlImages = []
  visit(tree, "html", node => {
    for (const match of node.value.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) htmlImages.push({ start: node.position.start.offset + match.index, end: node.position.start.offset + match.index + match[0].length, url: match[1].replaceAll("&amp;", "&"), alt: match[0].match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1] || "" })
  })
  for (const image of htmlImages) replacements.set(image.start, { ...image, text: `![${image.alt.replaceAll("]", "\\]")}](${await resolveAsset(image.url, true)})` })
  let body = parsed.content
  for (const edit of [...replacements.values()].sort((a, b) => b.start - a.start)) body = body.slice(0, edit.start) + edit.text + body.slice(edit.end)
  const bodyTree = parse(body)
  const first = bodyTree.children[0]
  if (first?.type === "heading" && first.depth === 1 && toString(first).trim() === title) body = body.slice(first.position.end.offset).trimStart()
  let summary = ""
  visit(parse(body), "paragraph", node => { if (!summary) summary = toString(node).replace(/\s+/g, " ").trim().slice(0, 150) })
  const previousTags = Array.isArray(previous.tags) ? previous.tags.join(",") : previous.tags || ""
  const metadata = { ...previous, title, description: String(input.description?.trim() || parsed.data.description || previous.description || summary), date: previous.date || parsed.data.date || today, modified: today, kind: "article", category: parsed.data.category || previous.category || sections[section], tags: String(input.tags ?? (Array.isArray(parsed.data.tags) ? parsed.data.tags.join(",") : parsed.data.tags || previousTags)).split(/[,，]/).map(t => t.trim().slice(0, 40)).filter(Boolean).slice(0, 24), draft: false }
  const markdown = matter.stringify(body.trim() + "\n", metadata)
  files.set(targetPath, { path: targetPath, bytes: Buffer.from(markdown), binary: false })
  const available = new Set([...existingPaths, ...files.keys()])
  const missing = []
  visit(parse(body), node => {
    if (!["image", "link", "definition"].includes(node.type) || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(node.url)) return
    const clean = decodeURIComponent(node.url.split(/[?#]/)[0])
    if (!clean) return
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(targetPath), clean))
    if (!target.startsWith("content/") || !available.has(target)) missing.push(node.url)
  })
  if (missing.length) throw new Error(`找不到这些本地链接或附件：${[...new Set(missing)].join("、")}`)
  const version = hash(Buffer.concat([...files.values()].sort((a, b) => a.path.localeCompare(b.path)).flatMap(file => [Buffer.from(file.path), file.bytes])))
  const markerPath = `content/assets/${slug}/publication.json`
  files.set(markerPath, { path: markerPath, bytes: Buffer.from(JSON.stringify({ version, path: targetPath.slice(8, -3) })), binary: false })
  const previewTree = parse(body)
  const previewUrl = url => {
    const asset = imageUrls.get(url)
    if (asset) return `data:${imageMime(asset.extension)};base64,${asset.bytes.toString("base64")}`
    const retained = path.posix.normalize(path.posix.join(path.posix.dirname(targetPath), url.split(/[?#]/)[0]))
    return siteUrl && existingPaths.has(retained) ? new URL(retained.slice(8), siteUrl).href : ""
  }
  let imageCount = 0
  visit(previewTree, node => { if (node.type === "image" || node.type === "imageReference") imageCount++ })
  visit(previewTree, "image", node => { node.url = previewUrl(node.url) })
  visit(previewTree, "definition", node => { if (imageUrls.has(node.url) || existingPaths.has(path.posix.normalize(path.posix.join(path.posix.dirname(targetPath), node.url)))) node.url = previewUrl(node.url) })
  visit(previewTree, "link", node => { if (!/^(https?:|mailto:|#)/i.test(node.url)) node.url = "#" })
  const renderer = unified().use(remarkRehype)
  const rendered = await renderer.run(previewTree)
  visit(rendered, "element", node => {
    if (node.tagName === "a" && !/^(https?:|mailto:|#)/i.test(String(node.properties.href || ""))) node.properties.href = "#"
    if (node.tagName === "a") { node.properties.target = "_blank"; node.properties.rel = "noreferrer noopener" }
  })
  const html = toHtml(rendered)
  return { title, section, slug, targetPath, markdown, version, markerPath, files: [...files.values()], html, imageCount }
}

export function imageMime(extension) {
  return ({ ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml", ".avif": "image/avif" })[extension] || "application/octet-stream"
}
