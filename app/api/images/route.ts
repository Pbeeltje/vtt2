import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { getUserFromCookie } from "@/lib/auth";
import fs from 'fs';
import path from 'path';

const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "",
});

export async function GET(req: Request) {
  console.log("GET /api/images started");
  const user = await getUserFromCookie();
  if (!user || user.role !== "DM") {
    console.log("Unauthorized access attempt");
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  try {
    const result = await client.execute({
      sql: "SELECT * FROM DMImage WHERE UserId = ?",
      args: [user.id],
    });
    
    // Translate "Token" to "Props" for frontend display
    const imagesWithTranslatedCategory = result.rows.map(row => ({
      ...row,
      Category: row.Category === "Token" ? "Props" : row.Category
    }));
    
    console.log("Images fetched:", imagesWithTranslatedCategory);
    return NextResponse.json(imagesWithTranslatedCategory);
  } catch (error) {
    console.error("Error fetching images:", error);
    return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  console.log("POST /api/images started (local upload)");
  try {
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

    // Translate "Props" to "Token" for database storage to match DB constraint
    const dbCategory = category === "Props" ? "Token" : category;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const originalFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '');
    const uniqueFilename = `${Date.now()}-${originalFilename}`;

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', category);
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const savePath = path.join(uploadDir, uniqueFilename);
    fs.writeFileSync(savePath, buffer);
    console.log(`File saved to: ${savePath}`);

    const publicPath = `/uploads/${category}/${uniqueFilename}`;

    console.log("Inserting into database with publicPath:", publicPath);
    const result = await client.execute({
      sql: "INSERT INTO DMImage (Name, Link, Category, UserId) VALUES (?, ?, ?, ?) RETURNING *",
      args: [file.name, publicPath, dbCategory, user.id],
    });

    if (result.rows.length === 0) {
      console.error("No rows returned from insert");
      try {
        if (fs.existsSync(savePath)) {
          fs.unlinkSync(savePath);
          console.log(`Cleaned up saved file: ${savePath}`);
        }
      } catch (cleanupError) {
        console.error("Error during file cleanup:", cleanupError);
      }
      throw new Error("Failed to insert image into database");
    }

    console.log("Inserted image metadata:", result.rows[0]);
    
    // Translate the response back to frontend format
    const responseImage = {
      ...result.rows[0],
      Category: result.rows[0].Category === "Token" ? "Props" : result.rows[0].Category
    };
    
    return NextResponse.json(responseImage);

  } catch (error) {
    console.error("POST /api/images error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}