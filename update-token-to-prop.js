const { createClient } = require('@libsql/client');

const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "",
});

async function updateTokenToProp() {
  try {
    console.log('Updating Token category to Prop in DMImage table...');
    
    const result = await client.execute({
      sql: "UPDATE DMImage SET Category = 'Prop' WHERE Category = 'Token'",
      args: [],
    });
    
    console.log(`Updated ${result.rowsAffected} rows from Token to Prop`);
    
    // Verify the changes
    const verifyResult = await client.execute({
      sql: "SELECT Id, Name, Category FROM DMImage WHERE Category = 'Prop'",
      args: [],
    });
    
    console.log('Items now with Prop category:');
    for (const row of verifyResult.rows) {
      console.log(`Id: ${row.Id}, Name: ${row.Name}, Category: ${row.Category}`);
    }
    
  } catch (error) {
    console.error('Error updating Token to Prop:', error.message);
  }
}

updateTokenToProp(); 