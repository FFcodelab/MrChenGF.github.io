import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"
import matter from "gray-matter"
import { unified } from "unified"
import remarkParse from "remark-parse"
import { visit } from "unist-util-visit"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const args = process.argv.slice(2)
const input = args.shift()
const options = {}
while (args.length) {
  const flag = args.shift()
  if (flag === "--update") options.update = true
  else if (["--slug", "--title", "--section", "--tags"].includes(flag)) {
    const value = args.shift()
    if (!value || value.startsWith("--")) throw new Error(`${flag} 需要一个值`)
    options[flag.slice(2)] = value
  } else throw new Error(`未知选项：${flag}`)
}
try {
  if (!input) throw new Error('用法：npm run import-note -- "文章.md" --slug my-note --title "文章标题"')
  const source = path.resolve(input)
  if (path.extname(source).toLowerCase() !== ".md") throw new Error("请导入 Markdown (.md) 文件")
  const section = options.section ?? "notes"
  if (!["notes", "research", "projects", "journal"].includes(section)) throw new Error("section 必须是 notes、research、projects 或 journal")
  const slug = options.slug
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug === "index") throw new Error("请用 --slug 指定小写英文、数字和连字符组成的稳定文件名；不能使用 index")
  const target = path.join(root, "content", section, `${slug}.md`)
  if (!options.update) {
    try { await fs.access(target); throw new Error("文章已存在；确认更新时增加 --update") }
    catch (error) { if (error.code !== "ENOENT") throw error }
  }
  const parsed = matter(await fs.readFile(source, "utf8"))
  const title = options.title ?? parsed.data.title ?? path.basename(source, ".md")
  const tree = unified().use(remarkParse).parse(parsed.content)
  const images = []
  visit(tree, "image", node => images.push(node))
  const replacements = []
  const copied = new Map()
  const sourceDirectory = await fs.realpath(path.dirname(source))
  for (const image of images) {
    const url = image.url
    if (/^(https?:|\/\/|data:)/i.test(url)) throw new Error("存在远程图片。请先下载图片并改成相对路径，再导入；正文尚未写入。")
    const imagePath = await fs.realpath(path.resolve(sourceDirectory, decodeURIComponent(url.split(/[?#]/)[0])))
    if (!imagePath.startsWith(sourceDirectory + path.sep)) throw new Error("图片必须位于导出 Markdown 所在目录或其子目录中")
    const bytes = await fs.readFile(imagePath)
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 12)
    const assetName = `${hash}${path.extname(imagePath).toLowerCase()}`
    const destination = path.join(root, "content", "assets", slug, assetName)
    copied.set(destination, bytes)
    replacements.push({ start: image.position.start.offset, end: image.position.end.offset, text: `![${image.alt?.replaceAll("]", "\\]") ?? ""}](../assets/${slug}/${assetName})` })
  }
  let body = parsed.content
  for (const replacement of replacements.sort((a, b) => b.start - a.start)) body = body.slice(0, replacement.start) + replacement.text + body.slice(replacement.end)
  let previous = {}
  if (options.update) {
    try { previous = matter(await fs.readFile(target, "utf8")).data } catch (error) { if (error.code !== "ENOENT") throw error }
  }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date())
  const metadata = { ...previous, ...parsed.data, title, description: parsed.data.description ?? previous.description ?? "", date: previous.date ?? parsed.data.date ?? today, modified: today, kind: "article", tags: options.tags ? options.tags.split(",").map(t => t.trim()).filter(Boolean) : parsed.data.tags ?? previous.tags ?? [], draft: false }
  await fs.mkdir(path.dirname(target), { recursive: true })
  for (const [destination, bytes] of copied) { await fs.mkdir(path.dirname(destination), { recursive: true }); await fs.writeFile(destination, bytes) }
  await fs.writeFile(target, matter.stringify(body, metadata), "utf8")
  console.log(`已导入：content/${section}/${slug}.md；复制图片 ${copied.size} 张。请预览后再提交。`)
} catch (error) { console.error(error.message); process.exitCode = 1 }
