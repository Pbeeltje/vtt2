import { NextResponse } from 'next/server'
import { createClient } from '@libsql/client'

const client = createClient({
  url: 'libsql://machiovttdb-pbeeltje.aws-eu-west-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3MzY0MTc0NDksImlkIjoiMzhhZDhmZDYtZmMwMy00M2NjLWFjZjktMWJiMTNiZDZiY2U0IiwicmlkIjoiMDU3M2UyZmYtZTg1MS00NDhlLThmNmItMzY5MTEwODZjOTZmIn0.NYSv79DSUMoo6MTDrjjrag2qL2YN_x7VvabUBnEqPUMXKafJkaJt5tyVDLIEuAEka1lg2dbU-7BlUIyCpU6OBw'
})

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const id = params.id
  const updatedCharacter = await request.json()

  if (!id) {
    return NextResponse.json({ error: 'Character ID is required' }, { status: 400 })
  }

  const allowedFields = ['Name', 'Description', 'Path', 'Age', 'Level', 'Guard', 'Armor', 'MaxGuard', 'Strength', 'MaxStrength', 'Dexternity', 'MaxDexternity', 'Mind', 'MaxMind', 'Charisma', 'MaxCharisma', 'Skill', 'MaxSkill', 'Mp', 'MaxMp', 'PortraitUrl', 'TokenUrl']
  const updateFields = Object.keys(updatedCharacter).filter(key => allowedFields.includes(key))

  try {
    const setClause = updateFields
      .map(key => `${key} = ?`)
      .join(', ')
    const values = updateFields.map(key => updatedCharacter[key])

    await client.execute({
      sql: `UPDATE Character SET ${setClause} WHERE CharacterId = ?`,
      args: [...values, id],
    })

    const updatedData = await client.execute({
      sql: 'SELECT * FROM Character WHERE CharacterId = ?',
      args: [id],
    })

    if (updatedData.rows.length === 0) {
      throw new Error('Character not found after update')
    }

    return NextResponse.json(updatedData.rows[0])
  } catch (error) {
    console.error('Error updating character:', error)
    return NextResponse.json({ error: 'Failed to update character', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
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

