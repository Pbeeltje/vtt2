import { NextResponse } from "next/server";

// Use environment variable with a fallback
const IMGUR_CLIENT_ID = process.env.IMGUR_CLIENT_ID || "missing-client-id";

export async function POST(request: Request) {
  console.log("POST /api/imgur-upload started");
  const formData = await request.formData();
  const file = formData.get("file") as File;

  if (!file) {
    console.log("No file provided");
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!IMGUR_CLIENT_ID || IMGUR_CLIENT_ID === "missing-client-id") {
    console.error("IMGUR_CLIENT_ID not configured");
    return NextResponse.json({ error: "Imgur Client ID not configured" }, { status: 500 });
  }

  const body = new FormData();
  body.append("image", file);

  try {
    console.log("Uploading to Imgur with Client-ID:", IMGUR_CLIENT_ID);
    const response = await fetch("https://api.imgur.com/3/image", {
      method: "POST",
      headers: {
        Authorization: `Client-ID ${IMGUR_CLIENT_ID}`,
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Imgur upload error:", response.status, errorText);
      throw new Error(`Imgur API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Imgur upload success:", data);
    return NextResponse.json({ url: data.data.link });
  } catch (error) {
    console.error("Error uploading to Imgur:", error);
    return NextResponse.json({
      error: "Failed to upload image",
      details: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}