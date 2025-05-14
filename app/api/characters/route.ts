import { NextResponse } from "next/server"
import { createClient } from "@libsql/client"
import { getUserFromCookie } from "@/lib/auth"

const client = createClient({
  url: "file:./vttdatabase.db", // Changed to local DB
  authToken: "", // No auth token needed for local file
})

export async function GET(req: Request) {
  console.log("Entering GET function in /api/characters/route.ts")

  const user = await getUserFromCookie()

  if (!user) {
    console.log("User is not authenticated")
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  console.log("User authenticated:", user)

  try {
    let sqlQuery: string;
    let queryArgs: any[] = [];

    if (user.role === 'DM') {
      console.log("User is DM, fetching all characters");
      sqlQuery = "SELECT c.*, u.Username as ownerUsername FROM character c LEFT JOIN User u ON c.UserId = u.UserId";
    } else {
      console.log("User is Player, fetching their characters");
      sqlQuery = "SELECT c.*, u.Username as ownerUsername FROM character c LEFT JOIN User u ON c.UserId = u.UserId WHERE c.UserId = ?";
      queryArgs = [user.id];
    }

    // Log the SQL query and arguments
    console.log("Executing SQL:", sqlQuery, "with args:", queryArgs);

    const result = await client.execute({
      sql: sqlQuery,
      args: queryArgs,
    });

    console.log("Characters fetched:", result.rows);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Error fetching characters:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch characters",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  console.log("Entering POST function in /api/characters/route.ts")

  const user = await getUserFromCookie()

  if (!user) {
    console.log("User is not authenticated")
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  console.log("User authenticated:", user)

  try {
    const { category } = await req.json()
    console.log(`Attempting to add new character in category: ${category}`)

    if (!category) {
      return NextResponse.json({ error: "Category is required" }, { status: 400 })
    }

    console.log("Creating new inventory for the character")
    const inventoryResult = await client.execute({
      sql: "INSERT INTO inventory DEFAULT VALUES",
      args: [],
    });

    if (!inventoryResult.lastInsertRowid) {
      throw new Error("Failed to create new inventory");
    }

    const newInventoryId = inventoryResult.lastInsertRowid;
    console.log("New inventory created with ID:", newInventoryId);

    console.log("Executing SQL insert for character with inventory ID")
    const characterResult = await client.execute({
      sql: "INSERT INTO character (Name, Description, Path, Category, UserId, InventoryId) VALUES (?, ?, ?, ?, ?, ?)",
      args: [`New ${category}`, "Description placeholder", "Warrior", category, user.id, newInventoryId],
    })

    console.log("SQL insert result:", characterResult)

    if (!characterResult.lastInsertRowid) {
      throw new Error("Failed to insert new character")
    }

    console.log("Fetching newly inserted character")
    const newCharacter = await client.execute({
      sql: "SELECT * FROM character WHERE CharacterId = ?",
      args: [characterResult.lastInsertRowid],
    })

    console.log("New character fetched:", newCharacter.rows[0])

    return NextResponse.json(newCharacter.rows[0])
  } catch (error) {
    console.error("Error adding character:", error)
    return NextResponse.json(
      { error: "Failed to add character", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
