import { NextResponse } from 'next/server'
import { createClient } from '@libsql/client'

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
    return NextResponse.json(finalUpdatedCharacter);
  } catch (error) {
    console.error('Error updating character:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to update character', details: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const id = params.id

  try {
    await client.execute({
      sql: 'DELETE FROM Character WHERE CharacterId = ?',
      args: [id],
    })

    return NextResponse.json({ message: 'Character deleted successfully' })
  } catch (error) {
    console.error('Error deleting character:', error)
    return NextResponse.json({ error: 'Failed to delete character' }, { status: 500 })
  }
}

