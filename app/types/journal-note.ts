export interface JournalNote {
  Id: number
  UserId: number
  Title: string
  Content: string
  UpdatedAt: string
  CreatedAt: string
}

/** Maps a journal_note DB row to a plain JSON-safe object. */
export function toJournalNote(row: Record<string, unknown>): JournalNote {
  return {
    Id: Number(row.Id),
    UserId: Number(row.UserId),
    Title: String(row.Title ?? ""),
    Content: String(row.Content ?? ""),
    UpdatedAt: String(row.UpdatedAt ?? ""),
    CreatedAt: String(row.CreatedAt ?? ""),
  }
}
