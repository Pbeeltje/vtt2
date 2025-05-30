import { NextResponse } from 'next/server'
import { createClient } from '@libsql/client'
import { getIO } from '../../../../lib/socket'; // Adjust path as necessary
import { getUserFromCookie } from '@/lib/auth'; // Added for authorization

const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "",
})

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const id = params.id
  const updatedCharacter = await request.json()

  if (!id) {
    return NextResponse.json({ error: 'Character ID is required' }, { status: 400 })
  }

  const allowedFields = [
    'Name', 'Description', 'Path', 'Age', 'Level', 'Guard', 'Armor', 
    'MaxGuard', 'Strength', 'MaxStrength', 'Dexternity', 'MaxDexternity', 
    'Mind', 'MaxMind', 'Charisma', 'MaxCharisma', 'Skill', 'MaxSkill', 
    'Mp', 'MaxMp', 'PortraitUrl', 'TokenUrl', 'userId'
  ];
  const potentiallyNullableAllowedFields = ['InventoryId', 'JobId'];

  const updateFields = Object.keys(updatedCharacter).filter(key => 
    allowedFields.includes(key) || 
    (potentiallyNullableAllowedFields.includes(key) && updatedCharacter[key] !== undefined)
  );
  
  potentiallyNullableAllowedFields.forEach(key => {
    if (updatedCharacter.hasOwnProperty(key) && updatedCharacter[key] === null && !updateFields.includes(key)) {
      updateFields.push(key);
    }
  });

  if (updateFields.length === 0) {
    const currentData = await client.execute({ sql: 'SELECT * FROM Character WHERE CharacterId = ?', args: [id] });
    if (currentData.rows.length === 0) return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    return NextResponse.json(currentData.rows[0]);
  }

  try {
    const setClause = updateFields
      .map(key => `${key} = ?`)
      .join(', ')
    const values = updateFields.map(key => updatedCharacter[key]);
    
    await client.execute({
      sql: `UPDATE Character SET ${setClause} WHERE CharacterId = ?`,
      args: [...values, id],
    });

    const updatedDataResult = await client.execute({
      sql: 'SELECT * FROM Character WHERE CharacterId = ?',
      args: [id],
    });

    if (updatedDataResult.rows.length === 0) {
      throw new Error('Character not found after update attempt.');
    }

    const finalUpdatedCharacter = updatedDataResult.rows[0];

    // Emit WebSocket event
    try {
      const io = getIO();
      io.emit('character_updated', finalUpdatedCharacter);
      console.log(`[API /characters/${id}] Emitted 'character_updated' for CharacterId: ${id}`, finalUpdatedCharacter);
    } catch (socketError) {
      console.error(`[API /characters/${id}] Socket.IO emit error:`, socketError);
      // Decide if this should affect the HTTP response. For now, it won't.
    }

    return NextResponse.json(finalUpdatedCharacter);
  } catch (error) {
    console.error('Error updating character:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to update character', details: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const characterIdToDeleteString = params.id;
  const characterIdToDelete = parseInt(characterIdToDeleteString, 10);

  if (isNaN(characterIdToDelete)) {
    return NextResponse.json({ error: "Invalid Character ID format" }, { status: 400 });
  }

  const user = await getUserFromCookie();
  if (!user || user.role !== "DM") {
    console.log(`[API /characters/${characterIdToDeleteString}] Unauthorized delete attempt by user:`, user);
    return NextResponse.json({ error: "Not authorized to delete characters." }, { status: 403 });
  }
  console.log(`[API /characters/${characterIdToDeleteString}] Authorized delete attempt by DM user:`, user.username);

  let tx;
  try {
    tx = await client.transaction(); // Start a transaction

    // 1. Handle Character Tokens in DMImage.SceneData
    const scenesToUpdate = [];
    const allScenesResult = await tx.execute({
      sql: "SELECT Id, SceneData FROM DMImage WHERE Category = \'Scene\' AND SceneData IS NOT NULL AND SceneData != \'\'",
      args: [],
    });

    for (const sceneRow of allScenesResult.rows) {
      const sceneId = sceneRow.Id as number;
      const sceneDataString = sceneRow.SceneData as string;
      let sceneData;
      try {
        sceneData = JSON.parse(sceneDataString);
      } catch (e) {
        console.warn(`Skipping scene ${sceneId} due to invalid JSON SceneData: ${(e as Error).message}`);
        continue;
      }

      let modified = false;
      if (sceneData.elements && sceneData.elements.topLayer) {
        const initialTopLayerLength = sceneData.elements.topLayer.length;
        sceneData.elements.topLayer = sceneData.elements.topLayer.filter(
          (token: any) => token.characterId !== characterIdToDelete
        );
        if (sceneData.elements.topLayer.length !== initialTopLayerLength) {
          modified = true;
        }
      }
      // Potentially check middleLayer too if characters can be there
      // if (sceneData.elements && sceneData.elements.middleLayer) {
      //   const initialMiddleLayerLength = sceneData.elements.middleLayer.length;
      //   sceneData.elements.middleLayer = sceneData.elements.middleLayer.filter(
      //     (element: any) => element.characterId !== characterIdToDelete // Assuming similar structure
      //   );
      //   if (sceneData.elements.middleLayer.length !== initialMiddleLayerLength) {
      //     modified = true;
      //   }
      // }

      if (modified) {
        sceneData.savedAt = new Date().toISOString(); // Update savedAt timestamp
        await tx.execute({
          sql: "UPDATE DMImage SET SceneData = ? WHERE Id = ?",
          args: [JSON.stringify(sceneData), sceneId],
        });
        scenesToUpdate.push({ sceneId, sceneData }); // Collect for socket emission
        console.log(`Updated SceneData for scene ${sceneId} to remove character ${characterIdToDelete}`);
      }
    }

    // 2. Delete Associated Jobs
    console.log(`Deleting jobs for character ${characterIdToDelete}`);
    await tx.execute({
      sql: "DELETE FROM Job WHERE CharacterId = ?",
      args: [characterIdToDelete],
    });

    // 3. Delete Associated Inventory Items
    // First, get the InventoryId from the Character table
    const characterInventoryResult = await tx.execute({
        sql: "SELECT InventoryId FROM Character WHERE CharacterId = ?",
        args: [characterIdToDelete]
    });

    if (characterInventoryResult.rows.length > 0 && characterInventoryResult.rows[0].InventoryId != null) {
        const inventoryId = characterInventoryResult.rows[0].InventoryId as number;
        console.log(`Deleting inventory items for InventoryId ${inventoryId} (associated with character ${characterIdToDelete})`);
        await tx.execute({
            // Assuming the table from inventory.csv is named 'Inventory' and links InventoryId to ItemId
            sql: "DELETE FROM Inventory WHERE InventoryId = ?",
            args: [inventoryId]
        });
        // If there was a separate 'Inventories' master table, you might delete from there too,
        // or set Character.InventoryId to NULL before deleting character if DB schema requires it.
        // For now, we assume Character.InventoryId might not have ON DELETE CASCADE/SET NULL, so we handle linked items.
    }


    // 4. Delete the Character record
    console.log(`Deleting character ${characterIdToDelete}`);
    const deleteCharacterResult = await tx.execute({
      sql: "DELETE FROM Character WHERE CharacterId = ?",
      args: [characterIdToDelete],
    });

    if (deleteCharacterResult.rowsAffected === 0) {
      await tx.rollback();
      return NextResponse.json({ error: "Character not found or already deleted" }, { status: 404 });
    }

    await tx.commit(); // Commit transaction

    // Emit socket events after successful commit
    try {
      const io = getIO();
      io.emit('character_deleted', characterIdToDelete);
      console.log(`[API /characters/${characterIdToDeleteString}] Emitted \'character_deleted\'`);

      for (const { sceneId, sceneData } of scenesToUpdate) {
        io.to(String(sceneId)).emit('scene_updated', sceneId, {
          middleLayer: sceneData.elements?.middleLayer || [],
          topLayer: sceneData.elements?.topLayer || [],
          // Include other scene attributes if they could have changed, though unlikely here
        });
        console.log(`[API /characters/${characterIdToDeleteString}] Emitted \'scene_updated\' for scene ${sceneId}`);
      }
    } catch (socketError) {
      console.error(`[API /characters/${characterIdToDeleteString}] Socket.IO emit error after deletion:`, socketError);
      // Non-critical for the response, but log it.
    }

    return NextResponse.json({ message: "Character and associated data deleted successfully" });

  } catch (error) {
    if (tx) {
      await tx.rollback(); // Ensure rollback on any error during transaction
    }
    console.error(`Error deleting character ${characterIdToDeleteString}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown server error";
    // Check for specific foreign key error from LibSQL/SQLite
    if (errorMessage.includes("SQLITE_CONSTRAINT_FOREIGNKEY")) {
        return NextResponse.json({ error: "Failed to delete character due to existing references", details: "SQLITE_CONSTRAINT_FOREIGNKEY: FOREIGN KEY constraint failed. Other data in the system still refers to this character." }, { status: 409 }); // 409 Conflict
    }
    return NextResponse.json({ error: "Failed to delete character", details: errorMessage }, { status: 500 });
  }
}

