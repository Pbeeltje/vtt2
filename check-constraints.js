const { createClient } = require('@libsql/client');

const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "",
});

async function checkConstraints() {
  try {
    console.log('Checking for CHECK constraints...');
    
    const result = await client.execute({
      sql: "SELECT sql FROM sqlite_master WHERE type='table' AND name='DMImage'",
      args: [],
    });
    
    if (result.rows.length > 0) {
      console.log('DMImage table definition:');
      console.log(result.rows[0].sql);
    } else {
      console.log('DMImage table not found or no definition available');
    }
    
    // Try to add a test record with 'Prop' category to see the exact error
    console.log('\nTrying to insert a test record with Prop category...');
    try {
      const testResult = await client.execute({
        sql: "INSERT INTO DMImage (Name, Link, Category, UserId) VALUES (?, ?, ?, ?)",
        args: ['test-prop', 'test-link', 'Prop', 0],
      });
      console.log('Successfully inserted test record with Prop category');
      
      // Clean up the test record
      await client.execute({
        sql: "DELETE FROM DMImage WHERE Name = 'test-prop'",
        args: [],
      });
      console.log('Cleaned up test record');
      
    } catch (insertError) {
      console.log('Error inserting Prop category:', insertError.message);
    }
    
  } catch (error) {
    console.error('Error checking constraints:', error.message);
  }
}

checkConstraints(); 