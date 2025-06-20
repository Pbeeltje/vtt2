import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { requireAuth } from "@/lib/auth";
import fs from 'fs';
import path from 'path';

const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "",
});

export async function GET(req: Request) {
  try {
    // Only DMs can access images
    const user = await requireAuth('DM');

    const result = await client.execute({
      sql: "SELECT * FROM DMImage",
      args: [],
    });
    
    // Translate "Token" to "Props" for frontend display
    const imagesWithTranslatedCategory = result.rows.map(row => ({
      ...row,
      Category: row.Category === "Token" ? "Props" : row.Category
    }));
    
    return NextResponse.json(imagesWithTranslatedCategory);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
      }
      if (error.message === "Insufficient permissions") {
        return NextResponse.json({ error: "Not authorized - DM access required" }, { status: 403 })
      }
    }
    console.error("Error fetching images:", error);
    return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // Only DMs can upload images
    const user = await requireAuth('DM');

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const category = formData.get("category") as string;

    // Input validation
    if (!file || !category) {
      return NextResponse.json({ error: "File and category required" }, { status: 400 });
    }

    if (typeof category !== 'string') {
      return NextResponse.json({ error: "Category must be a string" }, { status: 400 });
    }

    // Validate category
    const validCategories = ['Image', 'Props', 'Scene'];
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: "Invalid category. Must be one of: Image, Props, Scene" }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File size must be less than 5MB" }, { status: 400 });
    }

    // Sanitize filename
    const originalFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '');
    if (originalFilename.length === 0) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    // Translate "Props" to "Token" for database storage to match DB constraint
    const dbCategory = category === "Props" ? "Token" : category;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uniqueFilename = `${Date.now()}-${originalFilename}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', category);
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const savePath = path.join(uploadDir, uniqueFilename);
    fs.writeFileSync(savePath, buffer);

    const publicPath = `/uploads/${category}/${uniqueFilename}`;

    const result = await client.execute({
      sql: "INSERT INTO DMImage (Name, Link, Category, UserId) VALUES (?, ?, ?, ?) RETURNING *",
      args: [originalFilename, publicPath, dbCategory, user.id],
    });

    if (result.rows.length === 0) {
      // Clean up file if database insert failed
      try {
        if (fs.existsSync(savePath)) {
          fs.unlinkSync(savePath);
        }
      } catch (cleanupError) {
        console.error("Error during file cleanup:", cleanupError);
      }
      return NextResponse.json({ error: "Failed to save image" }, { status: 500 });
    }
    
    // Translate the response back to frontend format
    const responseImage = {
      ...result.rows[0],
      Category: result.rows[0].Category === "Token" ? "Props" : result.rows[0].Category
    };
    
    return NextResponse.json(responseImage);

  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
      }
      if (error.message === "Insufficient permissions") {
        return NextResponse.json({ error: "Not authorized - DM access required" }, { status: 403 })
      }
    }
    console.error("Error uploading image:", error);
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }
}