import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { getUserFromCookie } from "@/lib/auth";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "",
  authToken: process.env.TURSO_AUTH_TOKEN || "",
});

export async function GET(req: Request) {
  const user = await getUserFromCookie();
  if (!user || user.role !== "DM") {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  try {
    const result = await client.execute({
      sql: "SELECT * FROM DMImage WHERE UserId = ?",
      args: [user.id],
    });
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Error fetching images:", error);
    return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 });
  }
}

export async function POST(req: Request) {
    const user = await getUserFromCookie();
    if (!user || user.role !== "DM") {
      return NextResponse.json({ error: "Not authorized" }, { status: 401 });
    }
  
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const category = formData.get("category") as string;
  
    if (!file || !category) {
      return NextResponse.json({ error: "File and category required" }, { status: 400 });
    }
  
    // Upload to Imgur
    const imgurForm = new FormData();
    imgurForm.append("image", file);
    const imgurResponse = await fetch("https://api.imgur.com/3/image", {
      method: "POST",
      headers: { Authorization: `Client-ID ${process.env.IMGUR_CLIENT_ID}` },
      body: imgurForm,
    });
    const { data } = await imgurResponse.json();
    if (!imgurResponse.ok) throw new Error("Imgur upload failed");
  
    // Insert into database
    const result = await client.execute({
      sql: "INSERT INTO DMImage (Name, Link, Category, UserId) VALUES (?, ?, ?, ?)",
      args: [file.name, data.link, category, user.id],
    });
  
    console.log("Insert result:", result); // Debug the result object
  
    if (!result.lastInsertRowid) {
      throw new Error("Failed to get last inserted row ID");
    }
  
    const lastId = Number(result.lastInsertRowid); // Ensure it’s a number
    const newImage = await client.execute({
      sql: "SELECT * FROM DMImage WHERE Id = ?",
      args: [lastId],
    });
  
    if (newImage.rows.length === 0) {
      throw new Error("Failed to retrieve newly inserted image");
    }
  
    return NextResponse.json(newImage.rows[0]);
  }