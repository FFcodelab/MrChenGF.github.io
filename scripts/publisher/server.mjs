import http from "node:http"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { randomBytes, randomUUID } from "node:crypto"
import { prepareNote, parseNote, validTarget, sections } from "./core.mjs"
import { createPublisher, githubRequest, isOnline, repository, siteUrl, actionsUrl } from "./github.mjs"
import { downloadImage } from "./network.mjs"

const directory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(directory, "../..")
const pause = ms => new Promise(resolve => { const timer = setTimeout(resolve, ms); timer.unref() })

export async function createPublisherServer({ root = projectRoot, publisher, request = githubRequest, online = isOnline, remoteImage = downloadImage, pollInterval = 6000, monitorTimeout = 10 * 60 * 1000 } = {}) {
  const cacheDirectory = path.join(root, ".publisher-cache")
  let cached = []
  let history = []
  try { cached = JSON.parse(await fs.readFile(path.join(cacheDirectory, "blobs.json"), "utf8")) } catch {}
  try { history = JSON.parse(await fs.readFile(path.join(cacheDirectory, "history.json"), "utf8")) } catch {}
  let writes = Promise.resolve()
  const persist = (name, value) => {
    const text = JSON.stringify(value)
    writes = writes.catch(() => {}).then(async () => { await fs.mkdir(cacheDirectory, { recursive: true }); const file = path.join(cacheDirectory, name); await fs.writeFile(`${file}.tmp`, text); await fs.rename(`${file}.tmp`, file) })
    return writes
  }
  publisher ||= createPublisher(request, { cache: new Map(cached), onCache: cache => { persist("blobs.json", [...cache]).catch(() => {}) } })
  const csrf = randomBytes(32).toString("base64url")
  const jobs = new Map(history.map(item => [item.id, item]))
  const requests = new Map()
  let snapshot
  let activeJob
  let stopped = false
  const publicJob = job => ({ id: job.id, title: job.title, status: job.status, phase: job.phase, message: job.message, url: job.url, commit: job.commit, runUrl: job.runUrl, warning: job.warning, updated: job.updated, files: job.files })
  const remember = async job => {
    job.updated = new Date().toISOString()
    const items = [{ ...publicJob(job), version: job.version, markerPath: job.markerPath, targetPath: job.targetPath }, ...history.filter(item => item.id !== job.id)].slice(0, 20)
    history = items
    await persist("history.json", items)
  }
  const collection = async (refresh = false) => {
    if (!snapshot || refresh) {
      const repo = await request("GET", "")
      if (!repo.permissions?.push) throw new Error("当前 GitHub 登录没有这个博客仓库的写入权限")
      snapshot = await publisher.collection()
    }
    return snapshot
  }
  const prepare = async input => {
    const state = await collection()
    let previous = {}
    if (input.targetPath) {
      if (!validTarget(input.targetPath) || !input.expectedSha || state.files.get(input.targetPath) !== input.expectedSha) throw new Error("请重新选择要更新的文章，确认读取的是当前版本")
      previous = parseNote(await publisher.readBlob(input.expectedSha)).data
    }
    return prepareNote(input, { previous, resolveRemoteImage: remoteImage, existingPaths: new Set(state.files.keys()), siteUrl })
  }
  const saveLocal = async plan => {
    const realRoot = await fs.realpath(root)
    for (const file of plan.files) {
      const destination = path.resolve(root, file.path)
      if (!destination.startsWith(root + path.sep)) throw new Error("本地备份路径无效")
      let ancestor = path.dirname(destination)
      while (true) { try { const real = await fs.realpath(ancestor); if (real !== realRoot && !real.startsWith(realRoot + path.sep)) throw new Error("本地目录指向了项目以外的位置"); break } catch (error) { if (error.code !== "ENOENT") throw error; ancestor = path.dirname(ancestor) } }
      await fs.mkdir(path.dirname(destination), { recursive: true })
      await fs.writeFile(destination, file.bytes)
    }
  }
  const monitor = async job => {
    const start = Date.now()
    let lastActionsCheck = 0
    while (!stopped && Date.now() - start < monitorTimeout) {
      try {
        if (await online(job)) { job.status = "online"; job.phase = "已上线"; job.message = "网站已更新，可以打开文章了"; await remember(job); return }
      } catch {}
      if (Date.now() - lastActionsCheck >= 25000) {
        lastActionsCheck = Date.now()
        try {
          const runs = await request("GET", `/actions/runs?head_sha=${job.commit}&per_page=5`)
          const run = runs.workflow_runs.find(item => item.head_sha === job.commit)
          if (run) {
            job.runUrl = run.html_url
            if (run.status === "completed" && run.conclusion !== "success") { job.status = "failed"; job.phase = "构建未通过"; job.message = "文章已提交，但网站构建未通过。请查看构建详情，修改后选择更新这篇文章。"; await remember(job); return }
          }
        } catch {}
      }
      await pause(pollInterval)
    }
    if (!stopped) { job.status = "pending"; job.phase = "等待网站更新"; job.message = "文章已提交，GitHub 仍在处理。可以稍后检查上线，不需要重复发布。"; await remember(job) }
  }
  const publish = async (job, input) => {
    try {
      job.phase = "整理笔记"; job.message = "自动补充文章属性、整理图片与链接"
      const plan = await prepare(input)
      job.title = plan.title
      job.files = plan.files.map(file => ({ path: file.path, size: file.bytes.length }))
      const result = await publisher.publish(plan, { expectedSha: input.expectedSha || null, onProgress: (phase, message) => { job.phase = phase; job.message = message } })
      Object.assign(job, { commit: result.commit, version: plan.version, markerPath: plan.markerPath, targetPath: plan.targetPath, url: new URL(plan.targetPath.slice(8, -3), siteUrl).href, status: "deploying", phase: "网站更新中", message: "文章已提交，正在等待 GitHub 更新网站", runUrl: actionsUrl })
      try { await saveLocal(plan) } catch { job.warning = "GitHub 已保存文章，但本地副本写入失败；可从博客仓库取回。" }
      snapshot = undefined
      await remember(job)
      await monitor(job)
    } catch (error) {
      job.status = "failed"; job.phase = "未能完成发布"; job.message = error.message
      await remember(job).catch(() => {})
    } finally { if (activeJob === job.id) activeJob = undefined }
  }
  const json = (response, status, value) => { response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }); response.end(JSON.stringify(value)) }
  const readBody = async request => {
    if (!String(request.headers["content-type"] || "").startsWith("application/json")) throw Object.assign(new Error("请求格式无效"), { status: 415 })
    let size = 0
    const chunks = []
    for await (const chunk of request) { size += chunk.length; if (size > 60 * 1024 * 1024) throw Object.assign(new Error("一次选择的文件合计过大，请控制在 40 MB 内"), { status: 413 }); chunks.push(chunk) }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) } catch { throw new Error("请求内容无效") }
  }
  const server = http.createServer(async (incoming, response) => {
    const origin = `http://127.0.0.1:${server.address().port}`
    response.setHeader("Cache-Control", "no-store")
    response.setHeader("X-Content-Type-Options", "nosniff")
    response.setHeader("Referrer-Policy", "no-referrer")
    response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https://ffcodelab.github.io; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'")
    try {
      if (incoming.headers.host !== new URL(origin).host) return json(response, 403, { error: "只允许从本机打开发布助手" })
      if (incoming.method !== "GET" && (incoming.headers.origin !== origin || incoming.headers["x-publisher-token"] !== csrf)) return json(response, 403, { error: "请求校验失败，请重新打开发布助手" })
      const url = new URL(incoming.url, origin)
      if (incoming.method === "GET" && url.pathname === "/api/health") return json(response, 200, { app: "mrchengf-publisher-v1" })
      if (incoming.method === "GET" && url.pathname === "/api/state") { const state = await collection(url.searchParams.has("refresh")); return json(response, 200, { repository, siteUrl, sections, notes: state.notes, history: [...jobs.values()].sort((a, b) => String(b.updated).localeCompare(String(a.updated))).slice(0, 10).map(publicJob) }) }
      if (incoming.method === "GET" && url.pathname === "/api/note") {
        const target = url.searchParams.get("path")
        const state = await collection(true)
        if (!validTarget(target || "") || !state.files.has(target)) return json(response, 404, { error: "没有找到这篇文章" })
        const sha = state.files.get(target)
        const parsed = parseNote(await publisher.readBlob(sha))
        return json(response, 200, { body: parsed.content, title: parsed.data.title || target, description: parsed.data.description || "", tags: Array.isArray(parsed.data.tags) ? parsed.data.tags : [], sha })
      }
      if (incoming.method === "POST" && url.pathname === "/api/preview") { const plan = await prepare(await readBody(incoming)); return json(response, 200, { title: plan.title, html: plan.html, imageCount: plan.imageCount, targetPath: plan.targetPath, files: plan.files.map(file => ({ path: file.path, size: file.bytes.length })) }) }
      if (incoming.method === "POST" && url.pathname === "/api/publish") {
        const input = await readBody(incoming)
        if (input.requestId && requests.has(input.requestId)) return json(response, 202, { id: requests.get(input.requestId) })
        if (activeJob) return json(response, 409, { error: "上一篇文章仍在发布，请等它完成后再发布下一篇" })
        const job = { id: randomUUID(), status: "publishing", phase: "准备发布", message: "正在整理文章", title: input.title || "新笔记", updated: new Date().toISOString() }
        jobs.set(job.id, job); activeJob = job.id
        if (input.requestId) requests.set(input.requestId, job.id)
        json(response, 202, { id: job.id })
        void publish(job, input)
        return
      }
      if (incoming.method === "GET" && url.pathname.startsWith("/api/jobs/")) { const job = jobs.get(url.pathname.slice(10)); return json(response, job ? 200 : 404, job ? publicJob(job) : { error: "没有找到这次发布记录" }) }
      if (incoming.method === "POST" && url.pathname === "/api/check") {
        const { id } = await readBody(incoming)
        const job = jobs.get(id)
        if (!job?.commit) return json(response, 404, { error: "没有找到已提交的发布记录" })
        // Restore marker metadata from the saved record after a restart.
        if (!job.markerPath) { const slug = path.posix.basename(job.targetPath || new URL(job.url).pathname, ".md"); job.markerPath = `content/assets/${slug}/publication.json` }
        const visible = job.version && await online(job)
        if (visible) { job.status = "online"; job.phase = "已上线"; job.message = "网站已更新，可以打开文章了"; await remember(job) }
        return json(response, 200, publicJob(job))
      }
      if (incoming.method === "POST" && url.pathname === "/api/shutdown") { if (activeJob) return json(response, 409, { error: "文章仍在发布，请先等这次发布完成" }); json(response, 200, { ok: true }); setTimeout(() => server.close(), 200).unref(); return }
      if (incoming.method === "GET" && ["/", "/app.js", "/style.css"].includes(url.pathname)) {
        const filename = url.pathname === "/" ? "index.html" : url.pathname.slice(1)
        const bytes = await fs.readFile(path.join(directory, "ui", filename))
        response.writeHead(200, { "Content-Type": filename.endsWith(".html") ? "text/html; charset=utf-8" : filename.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/css; charset=utf-8" })
        response.end(filename === "index.html" ? bytes.toString().replace("__PUBLISHER_TOKEN__", csrf) : bytes)
        return
      }
      json(response, 404, { error: "没有找到这个页面" })
    } catch (error) { json(response, error.status || 400, { error: error.message }) }
  })
  server.on("close", () => { stopped = true })
  return server
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await createPublisherServer()
  server.on("error", error => { console.error(error.code === "EADDRINUSE" ? "发布助手端口已被占用，请关闭旧窗口后重试" : error.message); process.exitCode = 1 })
  server.listen(4179, "127.0.0.1", () => console.log("发布助手：http://127.0.0.1:4179"))
}
