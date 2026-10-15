/**
 * Chat and ticker text is rendered as plain text (never as HTML).
 * Older messages contain formatting like <strong> or <br>; strip it so it doesn't show up raw.
 */
const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
}

export function toPlainText(content: unknown): string {
  if (typeof content !== "string") return ""
  return content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)
}
