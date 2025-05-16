import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { getUserFromCookie } from "@/lib/auth";

const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "",
});

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getUserFromCookie();
  if (!user || user.role !== "DM") {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  try {
    const { name } = await req.json();
    const result = await client.execute({
      sql: "UPDATE DMImage SET Name = ? WHERE Id = ? AND UserId = ?",
      args: [name, params.id, user.id],
    });
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Image renamed" });
  } catch (error) {
    console.error("Error renaming image:", error);
    return NextResponse.json({ error: "Failed to rename image" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getUserFromCookie();
  if (!user || user.role !== "DM") {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  try {
    await client.execute({
      sql: "DELETE FROM DMImage WHERE Id = ? AND UserId = ?",
      args: [params.id, user.id],
    });
    return NextResponse.json({ message: "Image deleted" });
  } catch (error) {
    console.error("Error deleting image:", error);
    return NextResponse.json({ error: "Failed to delete image" }, { status: 500 });
  }
}