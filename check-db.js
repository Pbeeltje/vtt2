const Database = require('better-sqlite3');

try {
  const db = new Database('./vttdatabase.db');
  
  console.log('Notes table schema:');
  const schema = db.prepare('PRAGMA table_info(notes)').all();
  console.log(schema);
  
  console.log('\nSample notes:');
  const notes = db.prepare('SELECT * FROM notes LIMIT 5').all();
  console.log(notes);
  
  db.close();
} catch (error) {
  console.error('Error:', error);
} 