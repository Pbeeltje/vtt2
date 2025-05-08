import Database from 'better-sqlite3'

const db = new Database('./vttdatabase.db')

export { db }
