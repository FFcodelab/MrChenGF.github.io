import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import matter from "gray-matter"
import { prepareNote, parseNote, defaultSlug } from "./core.mjs"
import { createPublisher, gitBlobSha } from "./github.mjs"
import { isPublicAddress, downloadImage } from "./network.mjs"
import { createPublisherServer } from "./server.mjs"

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=", "base64")
const asset = { path: "导出/images/trace.png", base64: png.toString("base64") }

test("中文标题自动生成稳定地址，移除重复一级标题，保留代码中的图片语法", async () => {
  const markdown = "# 串口学习笔记\n\n正文摘要。\n\n~~~c\n// ![示例](not-a-real-image.png)\n~~~\n"
  const plan = await prepareNote({ markdown, tags: "STM32，调试" }, { today: "2026-10-22" })
  const parsed = matter(plan.markdown)
  assert.equal(plan.title, "串口学习笔记")
  assert.equal(plan.slug, defaultSlug("串口学习笔记"))
  assert.equal(parsed.data.date, "2026-10-22")
  assert.deepEqual(parsed.data.tags, ["STM32", "调试"])
  assert.equal(parsed.data.kind, "article")
  assert.equal(parsed.data.draft, false)
  assert.doesNotMatch(parsed.content, /^# 串口学习笔记/)
  assert.match(parsed.content, /not-a-real-image.png/)
  assert.equal(plan.files.length, 2)
})

test("导出文件夹中的引用图片和 HTML 图片一起保存，不上传未引用附件", async () => {
  const plan = await prepareNote({ sourcePath: "导出/笔记.md", markdown: '# 波形\n\n![波形][figure]\n\n[figure]: images/trace.png\n\n<img src="images/trace.png" alt="另一个视图">\n', assets: [asset, { path: "secret.txt", base64: Buffer.from("not selected for publication").toString("base64") }] })
  assert.equal(plan.imageCount, 2)
  assert.equal(plan.files.filter(file => file.binary).length, 1)
  assert.match(plan.markdown, /\.\.\/assets\/note-[a-f0-9]+\/[a-f0-9]+\.png/)
  assert.match(plan.html, /data:image\/png;base64,/)
  assert.ok(plan.files.every(file => !file.path.includes("secret")))
})

test("远程图片下载一次并改为站内路径；缺少本地图片时不生成残缺文章", async () => {
  let downloads = 0
  const plan = await prepareNote({ markdown: "# 图片\n\n![一](https://example.com/a.png)\n![二](https://example.com/a.png)" }, { resolveRemoteImage: async () => { downloads++; return { bytes: png, extension: ".png" } } })
  assert.equal(downloads, 1)
  assert.doesNotMatch(plan.markdown, /https:\/\/example.com/)
  await assert.rejects(prepareNote({ markdown: "# 缺图\n\n![波形](missing.png)" }), /没有找到图片/)
  await assert.rejects(prepareNote({ markdown: "# 坏链接\n\n[附件](missing.pdf)" }), /找不到/)
})

test("更新保留首次日期和已有图片，预览不执行原始 HTML", async () => {
  const existing = "content/assets/uart/old.png"
  const plan = await prepareNote({ targetPath: "content/notes/uart.md", section: "notes", markdown: '# UART\n\n![旧图](../assets/uart/old.png)\n\n<span>安全的格式文字</span>\n' }, { previous: { date: "2020-01-02", tags: "旧标签" }, today: "2026-10-22", existingPaths: new Set([existing]), siteUrl: "https://example.com/blog/" })
  assert.equal(matter(plan.markdown).data.date, "2020-01-02")
  assert.equal(matter(plan.markdown).data.modified, "2026-10-22")
  assert.match(plan.html, /https:\/\/example.com\/blog\/assets\/uart\/old.png/)
  assert.doesNotMatch(plan.html, /<script|href="javascript:/)
  assert.equal(plan.targetPath, "content/notes/uart.md")
})

test("拒绝可执行 frontmatter、路径越界和内网图片", async () => {
  globalThis.publisherUnexpectedExecution = false
  assert.throws(() => parseNote("---javascript\n{title: (globalThis.publisherUnexpectedExecution = true)}\n---\nbody"), /YAML/)
  assert.equal(globalThis.publisherUnexpectedExecution, false)
  await assert.rejects(prepareNote({ markdown: "# 脚本\n\n<script>alert(1)</script>" }), /可执行 HTML/)
  await assert.rejects(prepareNote({ markdown: "# 链接\n\n[点击](javascript:alert)" }), /不能公开发布/)
  await assert.rejects(prepareNote({ markdown: "# 文章\n\n正文", slug: "../../outside" }), /路径无效/)
  for (const ip of ["127.0.0.1", "10.1.2.3", "169.254.169.254", "192.168.1.2", "::1", "::ffff:127.0.0.1", "fc00::1", "2001:db8::1"]) assert.equal(isPublicAddress(ip), false, ip)
  assert.equal(isPublicAddress("8.8.8.8"), true)
  await assert.rejects(downloadImage("http://127.0.0.1/secret"), /内网/)
})

function fakeGitHub({ race = false, existing = false } = {}) {
  const calls = []
  const blobs = new Map()
  const commits = new Map()
  const trees = new Map()
  let next = 1
  let head = "head-0"
  let raced = false
  const original = new Map([["quartz.config.ts", "framework-sha"]])
  if (existing) original.set("content/notes/uart.md", "old-note-sha")
  commits.set(head, { tree: "tree-0", parent: null })
  trees.set("tree-0", original)
  const request = async (method, route, body) => {
    calls.push({ method, route, body })
    if (method === "GET" && route === "") return { permissions: { push: true } }
    if (method === "GET" && route === "/git/ref/heads/main") return { object: { sha: head } }
    if (method === "GET" && route.startsWith("/git/commits/")) return { tree: { sha: commits.get(route.slice(13)).tree } }
    if (method === "GET" && route.startsWith("/git/trees/")) return { tree: [...trees.get(route.slice(11).split("?")[0])].map(([path, sha]) => ({ path, sha, type: "blob" })), truncated: false }
    if (method === "POST" && route === "/git/blobs") { const sha = gitBlobSha(Buffer.from(body.content, "base64")); blobs.set(sha, body); return { sha } }
    if (method === "POST" && route === "/git/trees") { const sha = "tree-" + next++; const tree = new Map(trees.get(body.base_tree)); for (const file of body.tree) tree.set(file.path, file.sha || gitBlobSha(Buffer.from(file.content))); trees.set(sha, tree); return { sha } }
    if (method === "POST" && route === "/git/commits") { const sha = "head-" + next++; commits.set(sha, { tree: body.tree, parent: body.parents[0] }); return { sha } }
    if (method === "PATCH" && route === "/git/refs/heads/main") {
      assert.equal(body.force, false)
      if (race && !raced) { raced = true; const tree = new Map(trees.get(commits.get(head).tree)); tree.set("content/journal/concurrent.md", "concurrent-sha"); trees.set("tree-concurrent", tree); commits.set("head-concurrent", { tree: "tree-concurrent", parent: head }); head = "head-concurrent"; throw Object.assign(new Error("concurrent update"), { status: 422 }) }
      assert.equal(commits.get(body.sha).parent, head)
      head = body.sha; return { object: { sha: head } }
    }
    throw new Error("Unexpected fake API request: " + method + " " + route)
  }
  return { request, calls, current: () => trees.get(commits.get(head).tree) }
}

test("一次提交文章和所用附件，保留框架与并发更新，不强制推送", async () => {
  const fake = fakeGitHub({ race: true })
  const publisher = createPublisher(fake.request)
  const plan = await prepareNote({ markdown: "# 笔记\n\n![图](images/trace.png)", sourcePath: "导出/笔记.md", assets: [asset] })
  const result = await publisher.publish(plan)
  assert.ok(result.commit)
  assert.equal(fake.current().get("quartz.config.ts"), "framework-sha")
  assert.equal(fake.current().get("content/journal/concurrent.md"), "concurrent-sha")
  for (const file of plan.files) assert.equal(fake.current().get(file.path), gitBlobSha(file.bytes))
  assert.equal(fake.calls.filter(call => call.route === "/git/blobs").length, 1)
  assert.ok(fake.calls.filter(call => call.method === "POST" && call.route === "/git/trees").every(call => call.body.tree.every(file => file.path.startsWith("content/"))))
})

test("同名新建和过期更新在写入前停止", async () => {
  const fake = fakeGitHub({ existing: true })
  const publisher = createPublisher(fake.request)
  const plan = await prepareNote({ markdown: "# UART\n\n正文", slug: "uart" })
  await assert.rejects(publisher.publish(plan), error => error.code === "EXISTS")
  await assert.rejects(publisher.publish(plan, { expectedSha: "stale-sha" }), error => error.code === "CONFLICT")
  assert.equal(fake.calls.filter(call => call.method === "POST").length, 0)
})

test("本机接口拒绝跨站请求；发布、进度、落盘备份和重开检查完整联通", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "mrchengf-publisher-test-"))
  const fake = fakeGitHub()
  const publisher = createPublisher(fake.request)
  publisher.collection = async () => ({ notes: [], files: new Map() })
  let server
  try {
    server = await createPublisherServer({ root: temp, publisher, request: fake.request, online: async () => true })
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
    const origin = "http://127.0.0.1:" + server.address().port
    const page = await (await fetch(origin)).text()
    const token = page.match(/name="publisher-token" content="([^"]+)"/)[1]
    const body = JSON.stringify({ markdown: "# 接口测试\n\n只在临时目录中测试，不提交到真实 GitHub。", requestId: "same-request" })
    const wrong = await fetch(origin + "/api/publish", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://untrusted.example", "X-Publisher-Token": token }, body })
    assert.equal(wrong.status, 403)
    const headers = { "Content-Type": "application/json", Origin: origin, "X-Publisher-Token": token }
    const first = await (await fetch(origin + "/api/publish", { method: "POST", headers, body })).json()
    const duplicate = await (await fetch(origin + "/api/publish", { method: "POST", headers, body })).json()
    assert.equal(first.id, duplicate.id)
    let job
    for (let i = 0; i < 100; i++) { job = await (await fetch(origin + "/api/jobs/" + first.id)).json(); if (job.status === "online" || job.status === "failed") break; await new Promise(resolve => setTimeout(resolve, 10)) }
    assert.equal(job.status, "online", job.message)
    assert.ok(await fs.stat(path.join(temp, "content/notes", defaultSlug("接口测试") + ".md")))
    await new Promise(resolve => server.close(resolve))
    server = await createPublisherServer({ root: temp, publisher, request: fake.request, online: async job => Boolean(job.version && job.markerPath && job.targetPath) })
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
    const reopened = "http://127.0.0.1:" + server.address().port
    const reopenedToken = (await (await fetch(reopened)).text()).match(/name="publisher-token" content="([^"]+)"/)[1]
    const checked = await (await fetch(reopened + "/api/check", { method: "POST", headers: { ...headers, Origin: reopened, "X-Publisher-Token": reopenedToken }, body: JSON.stringify({ id: job.id }) })).json()
    assert.equal(checked.status, "online")
  } finally {
    if (server?.listening) await new Promise(resolve => server.close(resolve))
    assert.equal(path.dirname(temp), os.tmpdir())
    assert.ok(path.basename(temp).startsWith("mrchengf-publisher-test-"))
    await fs.rm(temp, { recursive: true, force: true })
  }
})
