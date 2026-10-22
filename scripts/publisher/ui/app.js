const $ = id => document.getElementById(id)
const token = document.querySelector('meta[name="publisher-token"]').content
const storageKey = "mrchengf.publisher.draft"
const state = { files: [], sourcePath: "", expectedSha: null, notes: [], connected: false, busy: false, job: null, requestId: null, tagsTouched: false }
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
async function api(method, route, body) {
  const response = await fetch(route, { method, headers: method === "GET" ? {} : { "Content-Type": "application/json", "X-Publisher-Token": token }, body: body === undefined ? undefined : JSON.stringify(body) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || "请求失败，请稍后重试")
  return data
}
function message(text = "") { $("globalMessage").hidden = !text; $("globalMessage").textContent = text }
function setBusy(busy) { state.busy = busy; $("publishButton").disabled = busy || !state.connected; $("previewButton").disabled = busy; for (const field of document.querySelectorAll(".editor-panel input, .editor-panel select, .editor-panel textarea")) field.disabled = busy; if (!busy) { $("section").disabled = !!$("existing").value; $("slug").disabled = !!$("existing").value } $("publishButton").firstChild.textContent = busy ? "正在发布… " : ($("existing").value ? "更新文章 " : "发布文章 ") }
function saveDraft() {
  const draft = Object.fromEntries(["title", "section", "tags", "markdown", "description", "slug"].map(id => [id, $(id).value]))
  draft.sourcePath = state.sourcePath
  try { localStorage.setItem(storageKey, JSON.stringify(draft)) } catch {}
  $("wordCount").textContent = $("markdown").value.length + " 字"
}
for (const id of ["title", "section", "tags", "markdown", "description", "slug"]) $(id).addEventListener("input", saveDraft)
$("tags").addEventListener("input", () => { state.tagsTouched = true })
try {
  const draft = JSON.parse(localStorage.getItem(storageKey) || "null")
  if (draft) { for (const id of ["title", "section", "tags", "markdown", "description", "slug"]) if (typeof draft[id] === "string") $(id).value = draft[id]; state.sourcePath = draft.sourcePath || ""; if (state.sourcePath) $("sourceInfo").textContent = "已恢复未完成的正文；如有本地图片，请再选择一次导出文件夹。"; $("wordCount").textContent = $("markdown").value.length + " 字" }
} catch {}
function filePath(file) { return file.publisherPath || file.webkitRelativePath || file.name }
function addFiles(files) { const map = new Map(state.files.map(file => [filePath(file), file])); for (const file of files) map.set(filePath(file), file); state.files = [...map.values()] }
async function loadSource(file) {
  $("markdown").value = await file.text(); state.sourcePath = filePath(file)
  $("sourceInfo").textContent = "已选择：" + state.sourcePath + "。图片会从已选文件中自动匹配。"
  $("title").value = ""; $("description").value = ""; $("slug").value = ""; saveDraft(); message()
}
$("folderInput").addEventListener("change", async event => {
  try {
    const files = [...event.target.files]
    const markdownFiles = files.filter(file => /\.(md|markdown)$/i.test(file.name))
    if (!markdownFiles.length) throw new Error("这个文件夹里没有找到 Markdown 文件")
    state.files = []; addFiles(files)
    $("sourceSelect").replaceChildren(...markdownFiles.map((file, index) => new Option(filePath(file), String(index))))
    $("sourcePicker").hidden = markdownFiles.length < 2
    $("sourceSelect").onchange = () => loadSource(markdownFiles[Number($("sourceSelect").value)])
    await loadSource(markdownFiles[0])
  } catch (error) { message(error.message) }
})
$("markdownInput").addEventListener("change", async event => { try { if (event.target.files[0]) await loadSource(event.target.files[0]) } catch (error) { message(error.message) } })
$("assetInput").addEventListener("change", event => { addFiles([...event.target.files]); $("sourceInfo").textContent = "已补充 " + event.target.files.length + " 个文件。只会发布正文用到的图片和附件。"; message() })
$("markdown").addEventListener("paste", event => {
  const images = [...event.clipboardData.files].filter(file => file.type.startsWith("image/"))
  if (!images.length) return
  event.preventDefault()
  let addition = event.clipboardData.getData("text/plain") || ""
  for (const image of images) { const extension = ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" })[image.type] || "png"; const filename = "pasted-" + crypto.randomUUID().slice(0, 8) + "." + extension; const file = new File([image], filename, { type: image.type }); addFiles([file]); addition += "\n![插图](" + filename + ")\n" }
  const field = $("markdown"); field.setRangeText(addition, field.selectionStart, field.selectionEnd, "end"); saveDraft()
})
async function toBase64(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = () => reject(new Error("无法读取 " + file.name)); reader.readAsDataURL(file) }) }
async function payload() {
  const markdown = $("markdown").value
  if (!markdown.trim()) throw new Error("请先选择文件或粘贴 Markdown 正文")
  const files = state.files.filter(file => !/\.(md|markdown)$/i.test(file.name) && (markdown.includes(file.name) || markdown.includes(encodeURIComponent(file.name))))
  if (files.reduce((total, file) => total + file.size, 0) > 40 * 1024 * 1024) throw new Error("本篇文章的附件合计请控制在 40 MB 内")
  return { markdown, sourcePath: state.sourcePath || "pasted.md", title: $("title").value, section: $("section").value, tags: state.tagsTouched ? $("tags").value : ($("tags").value || undefined), description: $("description").value, slug: $("slug").value, targetPath: $("existing").value || undefined, expectedSha: state.expectedSha, assets: await Promise.all(files.map(async file => ({ path: filePath(file), base64: await toBase64(file) }))) }
}
function renderHistory(items) {
  if (!items.length) return
  $("history").replaceChildren()
  for (const item of items.slice(0, 5)) {
    const row = document.createElement("div"); row.className = "history-row"
    const title = document.createElement("div"); title.className = "history-title"; title.textContent = item.title
    const meta = document.createElement("div"); meta.className = "history-meta"
    const status = document.createElement("span"); status.textContent = item.phase || "已提交"; meta.append(status)
    if (item.url && item.status === "online") { const link = document.createElement("a"); link.href = item.url; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = "打开文章 ↗"; meta.append(link) }
    if (item.commit && item.status !== "online") { const check = document.createElement("button"); check.type = "button"; check.className = "text-button"; check.textContent = "检查上线"; check.onclick = async () => { try { showJob(await api("POST", "/api/check", { id: item.id })); await connect() } catch (error) { message(error.message) } }; meta.append(check) }
    row.append(title, meta); $("history").append(row)
  }
}
async function connect(refresh = false) {
  try {
    $("connection").textContent = "正在连接 GitHub…"
    const result = await api("GET", "/api/state" + (refresh ? "?refresh=1" : ""))
    state.connected = true; state.notes = result.notes
    const selected = $("existing").value
    $("existing").replaceChildren(new Option("新建文章", ""), ...result.notes.map(note => new Option("更新：" + note.title, note.path)))
    $("existing").value = selected
    if (selected) state.expectedSha = result.notes.find(note => note.path === selected)?.sha || null
    $("connection").textContent = "GitHub 已连接 · 原博客"
    renderHistory(result.history); setBusy(state.busy)
  } catch (error) { state.connected = false; $("connection").textContent = "GitHub 尚未连接"; setBusy(state.busy); message(error.message) }
}
async function selectExisting(force = false) {
  const target = $("existing").value
  $("loadOriginal").hidden = !target; $("section").disabled = !!target; $("slug").disabled = !!target
  if (!target) { state.expectedSha = null; setBusy(false); return }
  try {
    const result = await api("GET", "/api/note?path=" + encodeURIComponent(target))
    state.expectedSha = result.sha; $("section").value = target.split("/")[1]
    if (force || !$("markdown").value.trim()) {
      $("markdown").value = result.body; $("title").value = result.title; $("description").value = result.description || ""; $("tags").value = (result.tags || []).join(", "); state.sourcePath = target
      state.files = []
    }
    $("sourceInfo").textContent = "将用编辑区内容更新所选文章，保留原来的文章地址和首次发布日期。"
    saveDraft(); setBusy(false); message()
  } catch (error) { message(error.message) }
}
$("existing").addEventListener("change", () => selectExisting())
$("loadOriginal").addEventListener("click", () => { if (confirm("用仓库中的原文替换当前编辑区内容？")) selectExisting(true) })
$("refresh").addEventListener("click", () => { message(); connect(true) })
$("previewButton").addEventListener("click", async () => {
  try { message(); $("previewButton").disabled = true; $("previewButton").textContent = "整理预览…"; const result = await api("POST", "/api/preview", await payload()); $("previewPlaceholder").hidden = true; $("previewTitle").hidden = false; $("previewTitle").textContent = result.title; $("previewContent").innerHTML = result.html; $("previewInfo").textContent = result.imageCount + " 张图片 · 自动排版" }
  catch (error) { message(error.message) }
  finally { $("previewButton").disabled = state.busy; $("previewButton").textContent = "预览" }
})
function showJob(job) {
  state.job = job
  const firstDisplay = $("jobPanel").hidden
  $("jobPanel").hidden = false; $("jobPanel").classList.toggle("failed", job.status === "failed")
  $("jobPhase").textContent = job.phase; $("jobTitle").textContent = job.title; $("jobMessage").textContent = job.message
  $("jobWarning").hidden = !job.warning; $("jobWarning").textContent = job.warning || ""
  $("runLink").hidden = !job.commit; $("runLink").href = job.runUrl || "https://github.com/FFcodelab/MrChenGF.github.io/actions"
  $("articleLink").hidden = job.status !== "online"; $("articleLink").href = job.url || "#"
  $("checkButton").hidden = !["pending", "failed"].includes(job.status) || !job.commit
  $("newButton").hidden = job.status !== "online"
  if (firstDisplay) $("jobPanel").scrollIntoView({ behavior: "smooth", block: "nearest" })
}
async function follow(id) {
  try {
    while (true) {
      const job = await api("GET", "/api/jobs/" + id); showJob(job)
      if (!["publishing", "deploying"].includes(job.status)) { setBusy(false); if (job.status === "online") localStorage.removeItem(storageKey); await connect(true); return }
      await sleep(1500)
    }
  } catch (error) { setBusy(false); message("无法读取发布进度：" + error.message + "。可刷新助手查看记录，不要重复发布。") }
}
$("publishButton").addEventListener("click", async () => {
  try { message(); setBusy(true); const input = await payload(); state.requestId ||= crypto.randomUUID(); const result = await api("POST", "/api/publish", { ...input, requestId: state.requestId }); state.requestId = null; await follow(result.id) }
  catch (error) { setBusy(false); message(error.message) }
})
$("checkButton").addEventListener("click", async () => { try { showJob(await api("POST", "/api/check", { id: state.job.id })); await connect(true) } catch (error) { message(error.message) } })
$("newButton").addEventListener("click", () => { for (const id of ["title", "tags", "markdown", "description", "slug"]) $(id).value = ""; $("existing").value = ""; $("section").value = "notes"; state.expectedSha = null; state.files = []; state.sourcePath = ""; $("section").disabled = false; $("slug").disabled = false; $("loadOriginal").hidden = true; $("previewContent").replaceChildren(); $("previewTitle").hidden = true; $("previewPlaceholder").hidden = false; $("jobPanel").hidden = true; localStorage.removeItem(storageKey); $("markdown").focus(); setBusy(false); saveDraft() })
$("newButton").addEventListener("click", () => { state.tagsTouched = false })
$("closeButton").addEventListener("click", async () => { try { await api("POST", "/api/shutdown", {}); $("connection").textContent = "发布助手已关闭"; state.connected = false; setBusy(false); message("助手已关闭，下次双击“发布笔记.cmd”即可重新打开。") } catch (error) { message(error.message) } })
await connect()
