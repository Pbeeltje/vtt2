import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { getUserFromCookie } from "@/lib/auth";

const IMGUR_CLIENT_ID = process.env.IMGUR_CLIENT_ID || "missing-client-id";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "",
  authToken: process.env.TURSO_AUTH_TOKEN || "",
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
    console.log("Images fetched:", result.rows);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Error fetching images:", error);
    return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  console.log("POST /api/images started");
  try {
    const user = await getUserFromCookie();
    console.log("User from cookie:", user);
    if (!user || user.role !== "DM") {
      console.log("Unauthorized access attempt");
      return NextResponse.json({ error: "Not authorized" }, { status: 401 });
    }

    console.log("Parsing form data");
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const category = formData.get("category") as string;
    console.log("Form data parsed:", { file: file?.name, category });

    if (!file || !category) {
      console.log("Missing file or category");
      return NextResponse.json({ error: "File and category required" }, { status: 400 });
    }

    if (!IMGUR_CLIENT_ID || IMGUR_CLIENT_ID === "missing-client-id") {
      throw new Error("IMGUR_CLIENT_ID is not configured in environment variables");
    }

    // Upload to Imgur
    console.log("Uploading to Imgur with Client-ID:", IMGUR_CLIENT_ID);
    const imgurForm = new FormData();
    imgurForm.append("image", file);
    const imgurResponse = await fetch("https://api.imgur.com/3/image", {
      method: "POST",
      headers: { Authorization: `Client-ID ${IMGUR_CLIENT_ID}` },
      body: imgurForm,
    });

    console.log("Imgur response status:", imgurResponse.status);
    if (!imgurResponse.ok) {
      const errorText = await imgurResponse.text();
      console.error("Imgur API error:", imgurResponse.status, errorText);
      try {
        const errorData = JSON.parse(errorText);
        const errorMessage = errorData.data?.error || "Unknown Imgur error";
        return NextResponse.json({ error: errorMessage }, { status: imgurResponse.status });
      } catch (parseError) {
        return NextResponse.json({ error: "Imgur upload failed", details: errorText }, { status: imgurResponse.status });
      }
    }

    const { data } = await imgurResponse.json();
    console.log("Imgur upload success:", data);

    // Insert into database
    console.log("Inserting into database");
    const result = await client.execute({
      sql: "INSERT INTO DMImage (Name, Link, Category, UserId) VALUES (?, ?, ?, ?) RETURNING *",
      args: [file.name, data.link, category, user.id],
    });

    if (result.rows.length === 0) {
      console.error("No rows returned from insert");
      throw new Error("Failed to insert image into database");
    }

    console.log("Inserted image:", result.rows[0]);
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("POST /api/images error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}