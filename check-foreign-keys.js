const { createClient } = require('@libsql/client');

const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "",
});

async function checkForeignKeys() {
  try {
    console.log('Checking foreign key constraints...');
    
    // Check what tables reference DMImage
    const result = await client.execute({
      sql: "PRAGMA foreign_key_list(DMImage)",
      args: [],
    });
    
    console.log('Foreign keys FROM DMImage:');
    for (const row of result.rows) {
      console.log(`Table: ${row.table}, Column: ${row.from}, References: ${row.to}`);
    }
    
    // Check what tables reference DMImage (reverse lookup)
    const allTables = await client.execute({
      sql: "SELECT name FROM sqlite_master WHERE type='table'",
      args: [],
    });
    
    console.log('\nChecking all tables for references TO DMImage:');
    for (const tableRow of allTables.rows) {
      const tableName = tableRow.name;
      if (tableName === 'sqlite_sequence' || tableName === 'sqlite_master') continue;
      
      try {
        const fkResult = await client.execute({
          sql: `PRAGMA foreign_key_list(${tableName})`,
          args: [],
        });
        
        for (const fkRow of fkResult.rows) {
          if (fkRow.table === 'DMImage') {
            console.log(`Table ${tableName} has foreign key to DMImage: ${fkRow.from} -> ${fkRow.to}`);
          }
        }
      } catch (error) {
        // Some tables might not exist or have issues
        console.log(`Could not check foreign keys for table ${tableName}: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('Error checking foreign keys:', error.message);
  }
}

checkForeignKeys(); 