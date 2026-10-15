import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { authErrorResponse, parseId } from "@/lib/api-errors"

type Params = { params: Promise<{ id: string }> }

// The image library is shared by all DMs, so none of these filter by uploader.

export async function GET(_req: Request, { params }: Params) {
  try {
    await requireAuth("DM")
    const id = parseId((await params).id)
    if (!id) return NextResponse.json({ error: "Invalid image ID format" }, { status: 400 })
    const result = await db.execute({ sql: "SELECT * FROM DMImage WHERE Id = ?", args: [id] })
    if (result.rows.length === 0) return NextResponse.json({ error: "Image not found" }, { status: 404 })
    return NextResponse.json(result.rows[0])
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Failed to fetch image" }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    await requireAuth("DM")
    const id = parseId((await params).id)
    if (!id) return NextResponse.json({ error: "Invalid image ID format" }, { status: 400 })
    const { name } = await req.json()
    if (typeof name !== "string" || !name.trim() || name.length > 200) {
      return NextResponse.json({ error: "Name is required (at most 200 characters)" }, { status: 400 })
    }
    const result = await db.execute({ sql: "UPDATE DMImage SET Name = ? WHERE Id = ?", args: [name.trim(), id] })
    if (result.rowsAffected === 0) return NextResponse.json({ error: "Image not found" }, { status: 404 })
    return NextResponse.json({ message: "Image renamed", Id: id, Name: name.trim() })
  } catch (error) {
    console.error("Error renaming image:", error)
    return authErrorResponse(error) ?? NextResponse.json({ error: "Failed to rename image" }, { status: 500 })
  }
}

/** Deletes the image, its scene drawings and character links; the file goes after the DB commit. */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    await requireAuth("DM")
    const id = parseId((await params).id)
    if (!id) return NextResponse.json({ error: "Invalid image ID format" }, { status: 400 })

    const found = await db.execute({ sql: "SELECT Link FROM DMImage WHERE Id = ?", args: [id] })
    if (found.rows.length === 0) return NextResponse.json({ error: "Image not found" }, { status: 404 })
    const link = found.rows[0].Link ? String(found.rows[0].Link) : null

    await db.batch(
      [
        { sql: "DELETE FROM drawing WHERE sceneId = ?", args: [id] },
        ...(link
          ? [
              { sql: "UPDATE character SET PortraitUrl = NULL WHERE PortraitUrl = ?", args: [link] },
              { sql: "UPDATE character SET TokenUrl = NULL WHERE TokenUrl = ?", args: [link] },
            ]
          : []),
        { sql: "DELETE FROM DMImage WHERE Id = ?", args: [id] },
      ],
      "write"
    )

    // Only files we uploaded live under public/uploads; never follow a link outside it.
    if (link && link.startsWith("/uploads/")) {
      const uploadsDir = path.join(process.cwd(), "public", "uploads")
      const filePath = path.resolve(process.cwd(), "public", "." + link)
      const stillUsed = await db.execute({ sql: "SELECT 1 FROM DMImage WHERE Link = ? LIMIT 1", args: [link] })
      if (filePath.startsWith(uploadsDir + path.sep) && stillUsed.rows.length === 0) {
        fs.promises.unlink(filePath).catch((error) => console.warn(`Could not delete ${filePath}:`, error.message))
      }
    }
    return NextResponse.json({ message: "Image and associated data deleted successfully" })
  } catch (error) {
    console.error("Error deleting image:", error)
    return authErrorResponse(error) ?? NextResponse.json({ error: "Failed to delete image" }, { status: 500 })
  }
}
