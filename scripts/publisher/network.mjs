import http from "node:http"
import https from "node:https"
import dns from "node:dns/promises"
import net from "node:net"

export function requestBytes(url, { method = "GET", headers = {}, body, maxBytes = 16 * 1024 * 1024, timeout = 30000, lookup, agent } = {}) {
  return new Promise((resolve, reject) => {
    const request = (url.protocol === "https:" ? https : http).request(url, { method, headers, timeout, lookup, agent }, response => {
      let size = 0
      const chunks = []
      response.on("data", chunk => { size += chunk.length; if (size > maxBytes) response.destroy(new Error("下载内容超过大小限制")); else chunks.push(chunk) })
      response.on("error", reject)
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, bytes: Buffer.concat(chunks) }))
    })
    request.on("error", reject)
    request.on("timeout", () => request.destroy(new Error("网络连接超时，请稍后重试")))
    if (body) request.write(body)
    request.end()
  })
}

export function isPublicAddress(address) {
  if (net.isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number)
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 2 && c === 0))) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113))
  }
  if (net.isIP(address) === 6) {
    const first = parseInt(address.split(":")[0], 16)
    return first >= 0x2000 && first < 0x4000 && !/^2001:(?:0:|db8:)/i.test(address) && !/^2002:/i.test(address)
  }
  return false
}

export async function downloadImage(raw, redirects = 0) {
  const url = new URL(raw)
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || (url.port && !["80", "443"].includes(url.port))) throw new Error("图片只支持普通 HTTP/HTTPS 公网地址")
  const hostname = url.hostname.replace(/^\[|\]$/g, "")
  const addresses = net.isIP(hostname) ? [{ address: hostname, family: net.isIP(hostname) }] : await dns.lookup(hostname, { all: true })
  if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) throw new Error("不会下载本机或内网地址的图片，请把图片作为本地附件选择")
  const ordered = addresses.sort((a, b) => a.family - b.family)
  const lookup = (_host, options, callback) => options?.all ? callback(null, ordered) : callback(null, ordered[0].address, ordered[0].family)
  const response = await requestBytes(url, { headers: { "User-Agent": "MrChenGF-Note-Publisher" }, maxBytes: 10 * 1024 * 1024, lookup, agent: false })
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    if (redirects >= 4 || !response.headers.location) throw new Error("图片重定向次数过多")
    return downloadImage(new URL(response.headers.location, url).href, redirects + 1)
  }
  if (response.status !== 200) throw new Error(`图片无法下载（HTTP ${response.status}），请从语雀/飞书导出并选择本地图片：${url.hostname}`)
  const mime = String(response.headers["content-type"] || "").split(";")[0].toLowerCase()
  const extension = ({ "image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif", "image/webp": ".webp", "image/svg+xml": ".svg", "image/avif": ".avif" })[mime]
  if (!extension) throw new Error(`这个链接没有返回图片，可能需要登录；请选择本地图片：${url.hostname}`)
  return { bytes: response.bytes, extension }
}
