const Database = require('better-sqlite3');

try {
  const db = new Database('./vttdatabase.db');
  
  console.log('Adding color column to notes table...');
  
  // Add the color column with default value of red-600 (#dc2626)
  db.prepare('ALTER TABLE notes ADD COLUMN color TEXT DEFAULT "#dc2626"').run();
  
  // Update existing notes to have the default red color
  db.prepare('UPDATE notes SET color = "#dc2626" WHERE color IS NULL').run();
  
  console.log('Color column added successfully!');
  
  // Verify the change
  console.log('\nUpdated notes table schema:');
  const schema = db.prepare('PRAGMA table_info(notes)').all();
  console.log(schema);
  
  console.log('\nSample notes with colors:');
  const notes = db.prepare('SELECT * FROM notes LIMIT 5').all();
  console.log(notes);
  
  db.close();
} catch (error) {
  console.error('Error:', error);
} 