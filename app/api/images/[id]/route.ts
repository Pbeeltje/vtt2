import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { getUserFromCookie } from "@/lib/auth";
import fs from 'fs';
import path from 'path';

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

  const imageId = params.id;
  const imageIdNumber = parseInt(imageId, 10); // For use in queries expecting a number

  if (isNaN(imageIdNumber)) {
    return NextResponse.json({ error: "Invalid image ID format" }, { status: 400 });
  }

  try {
    await client.execute("BEGIN TRANSACTION;");

    // 1. Fetch the image record to get its Link and Category
    const imageRecordResult = await client.execute({
      sql: "SELECT Link, Category FROM DMImage WHERE Id = ? AND UserId = ?",
      args: [imageIdNumber, user.id],
    });

    if (imageRecordResult.rows.length === 0) {
      await client.execute("ROLLBACK;");
      return NextResponse.json({ error: "Image not found or not authorized" }, { status: 404 });
    }

    const link = imageRecordResult.rows[0].Link as string | undefined;
    const category = imageRecordResult.rows[0].Category as string | undefined;

    // 2. If it's a "Scene", delete associated drawings
    if (category === "Scene") {
      console.log(`Image ID ${imageIdNumber} is a Scene. Deleting associated drawings.`);
      await client.execute({
        sql: "DELETE FROM Drawing WHERE sceneId = ?",
        args: [imageIdNumber],
      });
      // Add any other scene-specific cleanup here, e.g., from a SceneElements table if you had one.
    }

    // 3. Nullify Character PortraitUrl and TokenUrl that match the image's Link
    if (link) {
      console.log(`Nullifying character PortraitUrl matching Link: ${link}`);
      await client.execute({
        sql: "UPDATE Character SET PortraitUrl = NULL WHERE PortraitUrl = ?",
        args: [link],
      });
      console.log(`Nullifying character TokenUrl matching Link: ${link}`);
      await client.execute({
        sql: "UPDATE Character SET TokenUrl = NULL WHERE TokenUrl = ?",
        args: [link],
      });
    }

    // 4. Delete the physical file
    if (link) {
      const filePath = path.join(process.cwd(), 'public', link);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Successfully deleted file: ${filePath}`);
        } else {
          console.warn(`File not found for deletion, but proceeding with DB record deletion: ${filePath}`);
        }
      } catch (fileError) {
        console.error(`Error deleting file ${filePath}:`, fileError);
        // Log and continue
      }
    } else {
      console.warn(`Image record with ID ${imageIdNumber} has no Link. Skipping file deletion.`);
    }

    // 5. Delete the DMImage database record
    const deleteDbResult = await client.execute({
      sql: "DELETE FROM DMImage WHERE Id = ? AND UserId = ?",
      args: [imageIdNumber, user.id],
    });

    if (deleteDbResult.rowsAffected === 0) {
      // This might indicate a concurrent deletion or an issue.
      // The transaction will be rolled back.
      await client.execute("ROLLBACK;");
      console.warn(`DB record for image ID ${imageIdNumber} not found for deletion or not authorized during final delete step.`);
      return NextResponse.json({ error: "Image record not found during final delete operation" }, { status: 404 });
    }

    await client.execute("COMMIT;");
    return NextResponse.json({ message: "Image and associated data deleted successfully" });

  } catch (error) {
    await client.execute("ROLLBACK;"); // Ensure rollback on any error
    console.error(`Error deleting image ID ${imageId}:`, error);
    // Check if it's a LibsqlError and has a more specific code for foreign key violation
    if (error && typeof error === 'object' && 'code' in error && error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
        return NextResponse.json({ error: "Failed to delete image due to existing references", details: "SQLITE_CONSTRAINT_FOREIGNKEY: FOREIGN KEY constraint failed. Other data in the system still refers to this image." }, { status: 409 }); // 409 Conflict
    }
    return NextResponse.json({ error: "Failed to delete image", details: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const imageId = params.id;
  const imageIdNumber = parseInt(imageId, 10);
  if (isNaN(imageIdNumber)) {
    return NextResponse.json({ error: "Invalid image ID format" }, { status: 400 });
  }
  try {
    const result = await client.execute({
      sql: "SELECT * FROM DMImage WHERE Id = ?",
      args: [imageIdNumber],
    });
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 500 });
  }
}