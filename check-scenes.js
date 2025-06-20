const { createClient } = require('@libsql/client');

const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "",
});

async function checkScenes() {
  try {
    const result = await client.execute({
      sql: "SELECT Id, Name, UserId, Category FROM DMImage WHERE Category='Scene'",
      args: [],
    });
    console.log('Scenes in DMImage:');
    for (const row of result.rows) {
      console.log(`Id: ${row.Id}, Name: ${row.Name}, UserId: ${row.UserId}, Category: ${row.Category}`);
    }
  } catch (error) {
    console.error('Error checking scenes:', error.message);
  }
}

checkScenes(); 