// URLs of uploaded images and their resized copies, shared by the browser and server.ts.
// No Node or React imports: both sides use these helpers.

/** Widths (and heights) a resized copy can have; server.ts makes them on first request. */
export const THUMB_SIZES = [128, 256, 512, 1024] as const
export type ThumbSize = (typeof THUMB_SIZES)[number]

export const UPLOADS_PREFIX = "/uploads/"
export const THUMBS_PREFIX = "/uploads/_thumbs/"

/**
 * A copy of an uploaded image just big enough to show at `displayPx` CSS pixels (three times
 * that, so it stays sharp at the map's 3x zoom). Anything that isn't one of our uploads, or is
 * shown too big for the largest copy, keeps its own URL.
 */
export function thumbUrl(url: string, displayPx: number): string {
  if (!url.startsWith(UPLOADS_PREFIX) || url.startsWith(THUMBS_PREFIX)) return url
  const size = THUMB_SIZES.find((s) => s >= displayPx * 3)
  return size ? `${THUMBS_PREFIX}${size}/${url.slice(UPLOADS_PREFIX.length)}` : url
}

/** `/uploads/_thumbs/<size>/<path>` → { size, path }, or null for any other URL. */
export function parseThumbPath(pathname: string): { size: ThumbSize; path: string } | null {
  const match = /^\/uploads\/_thumbs\/(\d+)\/(.+)$/.exec(pathname)
  if (!match) return null
  const size = Number(match[1]) as ThumbSize
  return THUMB_SIZES.includes(size) ? { size, path: match[2] } : null
}
