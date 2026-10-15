// Serves /uploads/* from server.ts, before Next sees the request. Next only serves files that
// were in public/ at build time, so in production a fresh upload would be a 404 without this.
// Upload names start with a timestamp and are never rewritten, so browsers may cache them forever.
import fs from "fs"
import path from "path"
import type { IncomingMessage, ServerResponse } from "http"
import { parseThumbPath, UPLOADS_PREFIX, type ThumbSize } from "./upload-url"

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
}

// Same rules next.config.mjs gives /uploads: images only, never sniffed or run as a page.
const UPLOAD_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox; frame-ancestors 'none'",
  "Referrer-Policy": "same-origin",
  "Cache-Control": "public, max-age=31536000, immutable",
}

/** The bit of sharp used here (its typings resolve differently under the two tsconfigs). */
type SharpImage = {
  metadata(): Promise<{ pages?: number }>
  rotate(): SharpImage
  resize(width: number, height: number, options: { fit: "inside"; withoutEnlargement: boolean }): SharpImage
  webp(options: { quality: number }): SharpImage
  toFile(file: string): Promise<unknown>
}
type Sharp = (input: string) => SharpImage
let sharpModule: Sharp | null | undefined
/** sharp ships with Next, but is optional there; without it, thumbnails fall back to the original. */
function loadSharp(): Sharp | null {
  if (sharpModule === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      sharpModule = require("sharp") as Sharp
    } catch {
      sharpModule = null
    }
  }
  return sharpModule
}

/** The file under `root` that `relative` (still URL-encoded) names, or null if it escapes it. */
function resolveInside(root: string, relative: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(relative)
  } catch {
    return null
  }
  if (decoded.includes("\0")) return null
  const file = path.resolve(root, decoded)
  return file.startsWith(root + path.sep) ? file : null
}

function sendFile(req: IncomingMessage, res: ServerResponse, file: string, stat: fs.Stats, contentType: string): void {
  const lastModified = stat.mtime.toUTCString()
  const since = req.headers["if-modified-since"]
  if (since && Date.parse(since) >= Math.floor(stat.mtimeMs / 1000) * 1000) {
    res.writeHead(304, { ...UPLOAD_HEADERS, "Last-Modified": lastModified })
    res.end()
    return
  }
  res.writeHead(200, { ...UPLOAD_HEADERS, "Content-Type": contentType, "Content-Length": stat.size, "Last-Modified": lastModified })
  if (req.method === "HEAD") {
    res.end()
    return
  }
  fs.createReadStream(file)
    .on("error", () => res.destroy())
    .pipe(res)
}

function notFound(res: ServerResponse): void {
  res.writeHead(404, { "Content-Type": "text/plain", "X-Content-Type-Options": "nosniff" })
  res.end("Not found")
}

/** One resize per file at a time, even when a whole party opens the scene at once. */
const pendingThumbs = new Map<string, Promise<string | null>>()

/**
 * The cached copy of `original` at most `size` px on each side, made if missing. Null when it
 * can't be made, or shouldn't be: animated images would lose their animation.
 */
async function ensureThumb(original: string, originalStat: fs.Stats, cacheFile: string, size: ThumbSize): Promise<string | null> {
  const cached = await fs.promises.stat(cacheFile).catch(() => null)
  if (cached && cached.mtimeMs >= originalStat.mtimeMs) return cacheFile
  const sharp = loadSharp()
  if (!sharp) return null
  const metadata = await sharp(original).metadata()
  if ((metadata.pages ?? 1) > 1) return null
  await fs.promises.mkdir(path.dirname(cacheFile), { recursive: true })
  const temp = `${cacheFile}.${process.pid}.tmp`
  await sharp(original)
    .rotate()
    .resize(size, size, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(temp)
  await fs.promises.rename(temp, cacheFile)
  return cacheFile
}

/**
 * Answers GET/HEAD requests for /uploads/... and returns true; returns false for anything else.
 * `/uploads/_thumbs/<size>/<path>` is `/uploads/<path>` resized (see lib/upload-url.ts).
 */
export async function handleUploadRequest(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  projectRoot: string
): Promise<boolean> {
  if (!pathname.startsWith(UPLOADS_PREFIX) || (req.method !== "GET" && req.method !== "HEAD")) return false

  const uploadsDir = path.join(projectRoot, "public", "uploads")
  const thumb = parseThumbPath(pathname)
  const original = resolveInside(uploadsDir, thumb ? thumb.path : pathname.slice(UPLOADS_PREFIX.length))
  const contentType = original ? CONTENT_TYPES[path.extname(original).toLowerCase()] : undefined
  const stat = original && contentType ? await fs.promises.stat(original).catch(() => null) : null
  if (!original || !contentType || !stat?.isFile()) {
    notFound(res)
    return true
  }

  if (thumb) {
    const thumbsDir = path.join(projectRoot, ".cache", "thumbs")
    const cacheFile = path.join(thumbsDir, String(thumb.size), `${path.relative(uploadsDir, original)}.webp`)
    let pending = pendingThumbs.get(cacheFile)
    if (!pending) {
      pending = ensureThumb(original, stat, cacheFile, thumb.size)
        .catch((error) => {
          console.error("[uploads] thumbnail failed:", original, error)
          return null
        })
        .finally(() => pendingThumbs.delete(cacheFile))
      pendingThumbs.set(cacheFile, pending)
    }
    const file = await pending
    const thumbStat = file ? await fs.promises.stat(file).catch(() => null) : null
    if (file && thumbStat) {
      sendFile(req, res, file, thumbStat, "image/webp")
      return true
    }
  }

  sendFile(req, res, original, stat, contentType)
  return true
}
