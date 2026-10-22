import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { requestBytes } from "./network.mjs"
import { parseNote, validTarget } from "./core.mjs"

export const repository = "FFcodelab/MrChenGF.github.io"
export const siteUrl = "https://ffcodelab.github.io/MrChenGF.github.io/"
export const actionsUrl = `https://github.com/${repository}/actions`
let credential

async function readCredential() {
  if (credential) return credential
  const text = await new Promise((resolve, reject) => {
    const child = spawn("git", ["-c", "credential.interactive=false", "credential", "fill"], { windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "Never" }, stdio: ["pipe", "pipe", "pipe"] })
    let output = ""
    const timer = setTimeout(() => { child.kill(); reject(new Error("读取 GitHub 登录超时，请先在 GitHub Desktop 登录")) }, 15000)
    child.stdout.on("data", chunk => { output += chunk.toString() })
    child.stderr.resume()
    child.on("error", () => { clearTimeout(timer); reject(new Error("没有找到 Git，请先安装 Git 或 GitHub Desktop")) })
    child.on("close", code => { clearTimeout(timer); code === 0 ? resolve(output) : reject(new Error("没有检测到 GitHub 登录，请先在这台电脑上登录 GitHub Desktop")) })
    child.stdin.end("protocol=https\nhost=github.com\n\n")
  })
  const values = Object.fromEntries(text.split(/\r?\n/).filter(line => line.includes("=")).map(line => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1)] }))
  if (!values.password) throw new Error("没有检测到可用的 GitHub 登录")
  credential = values.password
  return credential
}

export async function githubRequest(method, route, data) {
  // Authentication is sent only to this fixed repository on api.github.com.
  if ((route !== "" && !route.startsWith("/")) || route.includes("..") || route.includes("\\")) throw new Error("GitHub 请求路径无效")
  const token = await readCredential()
  const body = data === undefined ? undefined : Buffer.from(JSON.stringify(data))
  const response = await requestBytes(new URL(`https://api.github.com/repos/${repository}${route}`), { method, body, timeout: 90000, maxBytes: 25 * 1024 * 1024, headers: { "User-Agent": "MrChenGF-Note-Publisher", Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28", ...(body ? { "Content-Type": "application/json", "Content-Length": body.length } : {}) } })
  let result
  try { result = JSON.parse(response.bytes.toString("utf8")) } catch { throw new Error("GitHub 返回了无法识别的响应，请稍后重试") }
  if (response.status >= 400) {
    if (response.status === 401) credential = undefined
    const error = new Error(response.status === 401 ? "GitHub 登录已失效，请重新登录 GitHub Desktop" : response.status === 403 ? "GitHub 暂时拒绝了请求，请检查仓库写入权限或稍后重试" : `GitHub 请求失败（HTTP ${response.status}）：${result.message || "请稍后重试"}`)
    error.status = response.status
    throw error
  }
  return result
}

export function gitBlobSha(bytes) {
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex")
}

export function createPublisher(request = githubRequest, { cache = new Map(), onCache = () => {} } = {}) {
  const readBlob = async sha => {
    if (cache.has(sha)) return cache.get(sha)
    const blob = await request("GET", `/git/blobs/${sha}`)
    if (blob.encoding !== "base64" || blob.size > 1024 * 1024) throw new Error("文章内容无效或超过 1 MB")
    const text = Buffer.from(blob.content, "base64").toString("utf8")
    // Validate before caching: JavaScript frontmatter must never be evaluated.
    parseNote(text)
    cache.set(sha, text)
    onCache(cache)
    return text
  }
  const readTree = async () => {
    const ref = await request("GET", "/git/ref/heads/main")
    const commit = await request("GET", `/git/commits/${ref.object.sha}`)
    const tree = await request("GET", `/git/trees/${commit.tree.sha}?recursive=1`)
    if (tree.truncated) throw new Error("仓库目录不完整，已停止发布，避免覆盖其他文件")
    return { commit: ref.object.sha, tree: commit.tree.sha, files: new Map(tree.tree.filter(item => item.type === "blob").map(item => [item.path, item.sha])) }
  }
  const collection = async () => {
    const snapshot = await readTree()
    const notes = []
    for (const [targetPath, sha] of snapshot.files) {
      if (!validTarget(targetPath)) continue
      const parsed = parseNote(await readBlob(sha))
      notes.push({ path: targetPath, sha, title: String(parsed.data.title || targetPath), section: targetPath.split("/")[1], date: String(parsed.data.modified || parsed.data.date || "") })
    }
    notes.sort((a, b) => b.date.localeCompare(a.date))
    return { ...snapshot, notes }
  }
  const publish = async (plan, { expectedSha = null, onProgress = () => {} } = {}) => {
    if (!validTarget(plan.targetPath)) throw new Error("文章路径无效")
    const assetPrefix = `content/assets/${plan.slug}/`
    for (const file of plan.files) if (file.path !== plan.targetPath && (!file.path.startsWith(assetPrefix) || !/^(?:[a-f0-9]{16}\.[a-z0-9]+|publication\.json)$/.test(file.path.slice(assetPrefix.length)))) throw new Error("发布范围只能包括当前文章与附件")
    const uploaded = new Set()
    for (let attempt = 0; attempt < 3; attempt++) {
      onProgress("同步", "核对 GitHub 最新版本")
      const snapshot = await readTree()
      const current = snapshot.files.get(plan.targetPath)
      if (!expectedSha && current) { const error = new Error("同名文章已存在。请先在“更新已有文章”中选择它，再发布。"); error.code = "EXISTS"; throw error }
      if (expectedSha && current !== expectedSha) { const error = new Error("这篇文章刚刚在其他地方修改过，请重新选择文章、合并修改后再发布。"); error.code = "CONFLICT"; throw error }
      const entries = []
      let position = 0
      for (const file of plan.files) {
        position++
        const sha = gitBlobSha(file.bytes)
        if (snapshot.files.get(file.path) === sha) continue
        onProgress("上传", `正在保存文章与附件（${position}/${plan.files.length}）`)
        if (file.binary) {
          if (!uploaded.has(sha)) { await request("POST", "/git/blobs", { content: file.bytes.toString("base64"), encoding: "base64" }); uploaded.add(sha) }
          entries.push({ path: file.path, mode: "100644", type: "blob", sha })
        } else entries.push({ path: file.path, mode: "100644", type: "blob", content: file.bytes.toString("utf8") })
      }
      if (!entries.length) return { commit: snapshot.commit, unchanged: true }
      const tree = await request("POST", "/git/trees", { base_tree: snapshot.tree, tree: entries })
      const commit = await request("POST", "/git/commits", { message: `${expectedSha ? "Update" : "Publish"} note: ${plan.title}`, tree: tree.sha, parents: [snapshot.commit] })
      onProgress("提交", "保存发布版本，触发网站自动更新")
      try {
        await request("PATCH", "/git/refs/heads/main", { sha: commit.sha, force: false })
        return { commit: commit.sha, unchanged: false }
      } catch (error) {
        // A connection can drop after GitHub accepted the update; check before retrying.
        const ref = await request("GET", "/git/ref/heads/main")
        if (ref.object.sha === commit.sha) return { commit: commit.sha, unchanged: false }
        if (![409, 422].includes(error.status) || attempt === 2) throw error
      }
    }
  }
  return { readBlob, readTree, collection, publish }
}

export async function isOnline(plan) {
  const marker = await requestBytes(new URL(`${plan.markerPath.slice(8)}?v=${plan.version}`, siteUrl), { headers: { "Cache-Control": "no-cache" }, maxBytes: 4096, timeout: 12000 })
  if (marker.status !== 200) return false
  try { if (JSON.parse(marker.bytes.toString()).version !== plan.version) return false } catch { return false }
  const article = await requestBytes(new URL(`${plan.targetPath.slice(8, -3)}?v=${plan.version.slice(0, 12)}`, siteUrl), { headers: { "Cache-Control": "no-cache" }, maxBytes: 5 * 1024 * 1024, timeout: 12000 })
  return article.status === 200
}
