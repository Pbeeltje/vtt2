const { createClient } = require('@libsql/client');

const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "",
});

async function migrateDMImage() {
  try {
    console.log('Starting DMImage migration to allow Prop category...');
    
    // Disable foreign key constraints temporarily
    await client.execute("PRAGMA foreign_keys = OFF");
    console.log('Foreign key constraints disabled');
    
    // Create new table with updated constraint
    await client.execute(`
      CREATE TABLE DMImage_new (
        Id INTEGER PRIMARY KEY,
        Name TEXT NOT NULL,
        Link TEXT NOT NULL,
        Category TEXT NOT NULL CHECK (Category IN ('Image', 'Token', 'Scene', 'Prop')),
        UserId INTEGER NOT NULL,
        SceneData TEXT
      )
    `);
    console.log('Created new DMImage table with Prop category support');
    
    // Copy all data from old table to new table
    const copyResult = await client.execute(`
      INSERT INTO DMImage_new 
      SELECT Id, Name, Link, Category, UserId, SceneData 
      FROM DMImage
    `);
    console.log(`Copied ${copyResult.rowsAffected} rows to new table`);
    
    // Drop the old table
    await client.execute("DROP TABLE DMImage");
    console.log('Dropped old DMImage table');
    
    // Rename new table to original name
    await client.execute("ALTER TABLE DMImage_new RENAME TO DMImage");
    console.log('Renamed new table to DMImage');
    
    // Re-enable foreign key constraints
    await client.execute("PRAGMA foreign_keys = ON");
    console.log('Foreign key constraints re-enabled');
    
    // Verify the migration
    const verifyResult = await client.execute({
      sql: "SELECT DISTINCT Category FROM DMImage",
      args: [],
    });
    
    console.log('\nCategories now available in DMImage:');
    for (const row of verifyResult.rows) {
      console.log(`- ${row.Category}`);
    }
    
    // Test inserting a Prop
    try {
      const testResult = await client.execute({
        sql: "INSERT INTO DMImage (Name, Link, Category, UserId) VALUES (?, ?, ?, ?)",
        args: ['test-prop', 'test-link', 'Prop', 0],
      });
      console.log('\n✅ Successfully inserted test Prop category');
      
      // Clean up test record
      await client.execute({
        sql: "DELETE FROM DMImage WHERE Name = 'test-prop'",
        args: [],
      });
      console.log('Cleaned up test record');
      
    } catch (testError) {
      console.log('\n❌ Failed to insert test Prop:', testError.message);
    }
    
    console.log('\n🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    
    // Try to re-enable foreign keys if something went wrong
    try {
      await client.execute("PRAGMA foreign_keys = ON");
      console.log('Re-enabled foreign key constraints');
    } catch (fkError) {
      console.error('Failed to re-enable foreign keys:', fkError.message);
    }
  }
}

migrateDMImage(); 