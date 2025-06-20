const { createClient } = require('@libsql/client');

const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "",
});

async function checkUserTable() {
  try {
    console.log('🔍 Checking User table structure...\n');
    
    // Get table schema
    const schemaResult = await client.execute({
      sql: "PRAGMA table_info(User)",
      args: [],
    });
    
    console.log('User table schema:');
    console.log(JSON.stringify(schemaResult.rows, null, 2));
    
    console.log('\n📋 Sample users:');
    const usersResult = await client.execute({
      sql: "SELECT * FROM User LIMIT 5",
      args: [],
    });
    
    console.log(JSON.stringify(usersResult.rows, null, 2));
    
    console.log('\n📊 User count:');
    const countResult = await client.execute({
      sql: "SELECT COUNT(*) as count FROM User",
      args: [],
    });
    
    console.log(`Total users: ${countResult.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error checking User table:', error.message);
  }
}

checkUserTable(); 