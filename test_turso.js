// test_turso.js
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const url = "libsql://machiovttdb-pbeeltje.aws-eu-west-1.turso.io";
const token = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Mzc0NzAwODAsImlkIjoiMzhhZDhmZDYtZmMwMy00M2NjLWFjZjktMWJiMTNiZDZiY2U0IiwicmlkIjoiMDU3M2UyZmYtZTg1MS00NDhlLThmNmItMzY5MTEwODZjOTZmIn0.RZdVCMWHWyWzC05oAcE3Buf0Px3MLfEs3zoHlHMKlwi8NGocNqg63c1DEIionZ7HGv0tGIXjOuI4GNbymH1yAw";


if (!url || !token) {
  console.error('Error: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in your environment variables or .env file.');
  process.exit(1);
}

const client = createClient({
  url: url,
  authToken: token,
});

async function testTable(tableName) {
  console.log(`\nAttempting to query table: ${tableName}`);
  try {
    // Use LIMIT 1 to just check if the table exists and is readable
    const result = await client.execute(`SELECT * FROM ${tableName} LIMIT 1`);
    console.log(`Success: Fetched ${result.rows.length} row(s) from ${tableName}.`);
    if (result.rows.length > 0) {
        console.log(`First row data:`, result.rows[0]);
    }
  } catch (error) {
    console.error(`Error querying ${tableName}:`, error.message);
     // Log the full error object for more details if needed
     // console.error(error);
  }
}

async function runTests() {
  await testTable('Character'); // Capitalized
  await testTable('inventory'); // Lowercase
  await testTable('Job');       // Capitalized

  console.log('\nTest finished.');
}

runTests();
