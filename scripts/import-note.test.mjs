import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { spawnSync } from "node:child_process"
import matter from "gray-matter"

test("导入本地图片、拒绝覆盖、保留更新日期并阻止远程图片", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "mrchengf-note-"))
  const slug = `test-import-${Date.now()}`
  const target = path.resolve("content/notes", `${slug}.md`)
  const assets = path.resolve("content/assets", slug)
  const run = (...args) => spawnSync(process.execPath, ["scripts/import-note.mjs", ...args], { encoding: "utf8" })
  try {
    await fs.writeFile(path.join(temp, "figure.svg"), '<svg xmlns="http://www.w3.org/2000/svg"/>')
    const source = path.join(temp, "article.md")
    await fs.writeFile(source, "---\ntitle: 导入验证\ndate: 2020-01-02\n---\n\n![图](figure.svg)\n")
    const first = run(source, "--slug", slug)
    assert.equal(first.status, 0, first.stderr)
    const initial = matter(await fs.readFile(target, "utf8"))
    assert.equal(initial.data.title, "导入验证")
    assert.equal(initial.data.kind, "article")
    assert.match(initial.content, new RegExp(`../assets/${slug}/[a-f0-9]+\\.svg`))
    assert.equal((await fs.readdir(assets)).length, 1)
    assert.notEqual(run(source, "--slug", slug).status, 0)
    assert.equal(run(source, "--slug", slug, "--update", "--title", "更新验证").status, 0)
    const updated = matter(await fs.readFile(target, "utf8"))
    assert.equal(updated.data.title, "更新验证")
    assert.deepEqual(updated.data.date, initial.data.date)
    await fs.writeFile(source, "![远程](https://example.com/private.png)")
    assert.notEqual(run(source, "--slug", `${slug}-remote`).status, 0)
    await assert.rejects(fs.access(path.resolve("content/notes", `${slug}-remote.md`)))
  } finally {
    await fs.unlink(target).catch(() => {})
    for (const file of await fs.readdir(assets).catch(() => [])) await fs.unlink(path.join(assets, file))
    await fs.rmdir(assets).catch(() => {})
    for (const file of await fs.readdir(temp)) await fs.unlink(path.join(temp, file))
    await fs.rmdir(temp)
  }
})
