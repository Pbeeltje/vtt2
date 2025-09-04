import { NextResponse } from "next/server"
import { createClient } from "@libsql/client"
import { requireAuth } from "@/lib/auth"

const client = createClient({
  url: "file:./vttdatabase.db", // Changed to local DB
  authToken: "", // No auth token needed for local file
})

export async function GET(req: Request) {
  try {
    // Require authentication for all users
    const user = await requireAuth()

    let sqlQuery: string;
    let queryArgs: any[] = [];

    if (user.role === 'DM') {
      // DMs can see all characters
      sqlQuery = "SELECT c.*, u.Username as ownerUsername FROM character c LEFT JOIN User u ON c.UserId = u.UserId";
    } else {
      // Players can only see their own characters
      sqlQuery = "SELECT c.*, u.Username as ownerUsername FROM character c LEFT JOIN User u ON c.UserId = u.UserId WHERE c.UserId = ?";
      queryArgs = [user.id];
    }

    const result = await client.execute({
      sql: sqlQuery,
      args: queryArgs,
    });

    // For each character, ensure they have an inventory
    for (const char of result.rows) {
      // Check for inventory
      const invResult = await client.execute({
        sql: 'SELECT * FROM inventory WHERE CharacterId = ?',
        args: [char.CharacterId],
      });
      if (invResult.rows.length === 0) {
        // Create inventory
        await client.execute({
          sql: 'INSERT INTO inventory (CharacterId) VALUES (?)',
          args: [char.CharacterId],
        });
      }
    }

    return NextResponse.json(result.rows);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
      }
    }
    console.error("Error fetching characters:", error)
    return NextResponse.json({ error: "Failed to fetch characters" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    // Require authentication for all users
    const user = await requireAuth()

    const { category } = await req.json()

    // Input validation
    if (!category || typeof category !== 'string') {
      return NextResponse.json({ error: "Category is required and must be a string" }, { status: 400 })
    }

    // Validate category
    const validCategories = ['Party', 'NPC', 'Monster'];
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: "Invalid category. Must be one of: Party, NPC, Monster" }, { status: 400 })
    }

    // Only DMs can create NPCs and Monsters
    if ((category === 'NPC' || category === 'Monster') && user.role !== 'DM') {
      return NextResponse.json({ error: "Only DMs can create NPCs and Monsters" }, { status: 403 })
    }

    // Create new inventory for the character
    const inventoryResult = await client.execute({
      sql: "INSERT INTO inventory DEFAULT VALUES",
      args: [],
    });

    if (!inventoryResult.lastInsertRowid) {
      return NextResponse.json({ error: "Failed to create inventory" }, { status: 500 })
    }

    const newInventoryId = inventoryResult.lastInsertRowid;

    // Create the character
    const characterResult = await client.execute({
      sql: "INSERT INTO character (Name, Description, Path, Category, UserId, InventoryId) VALUES (?, ?, ?, ?, ?, ?)",
      args: [`New ${category}`, "Description placeholder", "Warrior", category, user.id, newInventoryId],
    })

    if (!characterResult.lastInsertRowid) {
      return NextResponse.json({ error: "Failed to create character" }, { status: 500 })
    }

    // Fetch the newly created character
    const newCharacter = await client.execute({
      sql: "SELECT * FROM character WHERE CharacterId = ?",
      args: [characterResult.lastInsertRowid],
    })

    return NextResponse.json(newCharacter.rows[0])
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
      }
    }
    console.error("Error adding character:", error)
    return NextResponse.json({ error: "Failed to add character" }, { status: 500 })
  }
}
