// /uploads serving (lib/uploads-server.ts) and thumbnail URLs (lib/upload-url.ts).
import fs from "fs"
import os from "os"
import path from "path"
import http from "http"
import type { AddressInfo } from "net"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { handleUploadRequest } from "@/lib/uploads-server"
import { parseThumbPath, thumbUrl } from "@/lib/upload-url"

describe("thumbUrl", () => {
  it("picks the smallest copy at least three times the shown size", () => {
    expect(thumbUrl("/uploads/Token/1-a.png", 40)).toBe("/uploads/_thumbs/128/Token/1-a.png")
    expect(thumbUrl("/uploads/Token/1-a.png", 50)).toBe("/uploads/_thumbs/256/Token/1-a.png")
    expect(thumbUrl("/uploads/Image/1-a.jpg", 300)).toBe("/uploads/_thumbs/1024/Image/1-a.jpg")
  })

  it("keeps the original when shown bigger than the largest copy, or when it isn't an upload", () => {
    expect(thumbUrl("/uploads/Image/1-a.jpg", 400)).toBe("/uploads/Image/1-a.jpg")
    expect(thumbUrl("/placeholder.svg", 40)).toBe("/placeholder.svg")
    expect(thumbUrl("https://example.com/a.png", 40)).toBe("https://example.com/a.png")
    expect(thumbUrl("/uploads/_thumbs/128/Token/1-a.png", 40)).toBe("/uploads/_thumbs/128/Token/1-a.png")
  })

  it("parses only known sizes", () => {
    expect(parseThumbPath("/uploads/_thumbs/256/Token/a.png")).toEqual({ size: 256, path: "Token/a.png" })
    expect(parseThumbPath("/uploads/_thumbs/300/Token/a.png")).toBeNull()
    expect(parseThumbPath("/uploads/Token/a.png")).toBeNull()
  })
})

describe("handleUploadRequest", () => {
  let root: string
  let server: http.Server
  let base: string

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "vtt-uploads-"))
    const dir = path.join(root, "public", "uploads", "Token")
    fs.mkdirSync(dir, { recursive: true })
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sharp = require("sharp")
    await sharp({ create: { width: 800, height: 400, channels: 3, background: "#336699" } }).png().toFile(path.join(dir, "big.png"))
    fs.writeFileSync(path.join(dir, "notes.html"), "<script>alert(1)</script>")
    fs.writeFileSync(path.join(root, "public", "secret.png"), "outside uploads")

    server = http.createServer((req, res) => {
      const pathname = new URL(req.url ?? "/", "http://x").pathname
      void handleUploadRequest(req, res, pathname, root).then((handled) => {
        if (!handled) {
          res.writeHead(418)
          res.end()
        }
      })
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(() => {
    server.close()
    fs.rmSync(root, { recursive: true, force: true })
  })

  it("serves an upload with its type and a long-lived cache", async () => {
    const res = await fetch(`${base}/uploads/Token/big.png`)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("image/png")
    expect(res.headers.get("cache-control")).toContain("immutable")
    expect(res.headers.get("x-content-type-options")).toBe("nosniff")
  })

  it("answers 304 when the browser's copy is current", async () => {
    const first = await fetch(`${base}/uploads/Token/big.png`)
    const res = await fetch(`${base}/uploads/Token/big.png`, { headers: { "If-Modified-Since": first.headers.get("last-modified")! } })
    expect(res.status).toBe(304)
  })

  it("serves a resized webp copy and caches it on disk", async () => {
    const res = await fetch(`${base}/uploads/_thumbs/256/Token/big.png`)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("image/webp")
    const body = Buffer.from(await res.arrayBuffer())
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const meta = await require("sharp")(body).metadata()
    expect(meta.width).toBe(256)
    expect(meta.height).toBe(128)
    expect(fs.existsSync(path.join(root, ".cache", "thumbs", "256", "Token", "big.png.webp"))).toBe(true)
  })

  it("never serves files outside public/uploads or that aren't images", async () => {
    for (const url of ["/uploads/..%2Fsecret.png", "/uploads/Token/..%2F..%2Fsecret.png", "/uploads/Token/notes.html", "/uploads/Token/missing.png", "/uploads/_thumbs/128/..%2F..%2Fsecret.png"]) {
      const res = await fetch(`${base}${url}`)
      expect(res.status, url).toBe(404)
    }
  })

  it("leaves other paths and methods to Next", async () => {
    expect((await fetch(`${base}/api/scenes`)).status).toBe(418)
    expect((await fetch(`${base}/uploads/Token/big.png`, { method: "POST" })).status).toBe(418)
  })
})
