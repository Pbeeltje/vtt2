import { NextResponse } from "next/server";
import { db as client } from "@/lib/db"
import { requireAuth, getUserFromCookie } from "@/lib/auth";
import fs from 'fs';
import path from 'path';


/** Identify an image by its magic bytes; returns the file extension to use, or null. */
function detectImageExtension(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG') return 'png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.toString('ascii', 0, 6) === 'GIF87a' || buffer.toString('ascii', 0, 6) === 'GIF89a') return 'gif';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

export async function GET(req: Request) {
  try {
    // Only DMs can access images
    const user = await requireAuth('DM');

    const result = await client.execute({
      sql: "SELECT * FROM DMImage",
      args: [],
    });
    
    // No translation needed, just return the result as is
    const imagesWithTranslatedCategory = result.rows;
    
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
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

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
    const validCategories = ['Image', 'Prop', 'Scene'];
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: "Invalid category. Must be one of: Image, Prop, Scene" }, { status: 400 });
    }

    // Players may only upload generic images (e.g. portraits); DM can upload all categories.
    if (user.role !== 'DM' && category !== 'Image') {
      return NextResponse.json({ error: "Only DMs can upload this category" }, { status: 403 });
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File size must be less than 5MB" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate the actual file content (not the browser-supplied type) and force a matching
    // extension, so nothing like .html or .svg can be served from /uploads.
    const extension = detectImageExtension(buffer);
    if (!extension) {
      return NextResponse.json({ error: "File must be a PNG, JPEG, GIF or WebP image" }, { status: 400 });
    }

    // Sanitize filename
    const baseName = file.name.replace(/\.[^.]*$/, '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100) || 'image';
    const originalFilename = `${baseName}.${extension}`;

    // No translation needed, just use category as is
    const dbCategory = category;

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
    
    // No translation needed, just return the result as is
    const responseImage = result.rows[0];
    
    return NextResponse.json(responseImage);

  } catch (error) {
    console.error("Error uploading image:", error);
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }
}