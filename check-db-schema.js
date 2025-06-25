const { createClient } = require('@libsql/client');

const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "",
});

async function checkSchema() {
  try {
    console.log('Checking DMImage table schema...');
    
    const result = await client.execute({
      sql: "PRAGMA table_info(DMImage)",
      args: [],
    });
    
    console.log('DMImage table structure:');
    for (const row of result.rows) {
      console.log(`Column: ${row.name}, Type: ${row.type}, NotNull: ${row.notnull}, Default: ${row.dflt_value}`);
    }
    
    // Check what categories currently exist
    const categoriesResult = await client.execute({
      sql: "SELECT DISTINCT Category FROM DMImage",
      args: [],
    });
    
    console.log('\nCurrent categories in DMImage:');
    for (const row of categoriesResult.rows) {
      console.log(`Category: ${row.Category}`);
    }
    
  } catch (error) {
    console.error('Error checking schema:', error.message);
  }
}

checkSchema(); 