const { createClient } = require('@libsql/client');

const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "",
});

async function main() {
  const result = await client.execute(`
    SELECT InventoryId FROM Character
    WHERE InventoryId IS NOT NULL
      AND InventoryId NOT IN (SELECT InventoryId FROM inventory)
  `);

  if (result.rows.length === 0) {
    console.log("No missing inventory rows. All Character.InventoryId values are valid.");
  } else {
    console.log("Missing inventory rows for InventoryId(s):");
    for (const row of result.rows) {
      console.log(row.InventoryId);
    }
  }
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}); 