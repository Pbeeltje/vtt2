import Database from 'better-sqlite3'

const db = new Database('./vttdatabase.db')

// Optional: Enable WAL mode for better concurrency, if needed.
// db.pragma('journal_mode = WAL'); 

export { db }
