const Database = require('better-sqlite3');

// Open the existing database
const db = new Database('./vttdatabase.db');

try {
  // Sample notes for the ticker
  const sampleNotes = [
    'Welcome to the virtual tabletop!',
    'DM Notes: Players are exploring the forest',
    'Weather: Rain :: Drought :: Night',
    'Important: Check character sheets',
    'Next session: Continue with the quest',
    'Reminder: Update inventory items',
    'Scene: Ancient ruins discovered',
    'NPC: Village elder has information',
    'Combat: Prepare for upcoming battle',
    'Loot: Magic items found in chest'
  ];

  // Clear existing notes first
  const clearStmt = db.prepare('DELETE FROM notes WHERE Type = ?');
  clearStmt.run('notice');
  console.log('Cleared existing notice notes');

  // Insert sample notes
  const insertStmt = db.prepare('INSERT INTO notes (Content, Type) VALUES (?, ?)');
  
  sampleNotes.forEach((note, index) => {
    insertStmt.run(note, 'notice');
    console.log(`Added note ${index + 1}: ${note}`);
  });

  console.log('Sample notes added successfully!');
  
} catch (error) {
  console.error('Error adding sample notes:', error);
} finally {
  db.close();
} 