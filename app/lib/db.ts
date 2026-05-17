import Database from 'better-sqlite3'

const db = new Database('./vttdatabase.db')

// Optional: Enable WAL mode for better concurrency, if needed.
// db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS journal_note (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  UserId INTEGER NOT NULL,
  Title TEXT NOT NULL DEFAULT '',
  Content TEXT NOT NULL DEFAULT '',
  UpdatedAt TEXT NOT NULL,
  CreatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_journal_note_user_updated ON journal_note (UserId, UpdatedAt DESC);
`)

export { db }
