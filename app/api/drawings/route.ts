import { NextResponse } from 'next/server'
import { db } from '../../lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sceneId = searchParams.get('sceneId')
    
    if (!sceneId) {
      return NextResponse.json({ error: 'Scene ID is required' }, { status: 400 })
    }

    const stmt = db.prepare('SELECT * FROM Drawing WHERE sceneId = ? ORDER BY createdAt ASC')
    const drawings = stmt.all([sceneId])
    return NextResponse.json(drawings)
  } catch (error) {
    console.error('Error fetching drawings:', error)
    return NextResponse.json({ error: 'Failed to fetch drawings' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const stmt = db.prepare(
      'INSERT INTO Drawing (id, path, color, createdBy, sceneId, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
    )
    stmt.run(data.id, data.path, data.color, data.createdBy, data.sceneId, data.createdAt || new Date().toISOString())
    return NextResponse.json({ id: data.id })
  } catch (error) {
    console.error('Error creating drawing:', error)
    return NextResponse.json({ error: 'Failed to create drawing' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Drawing ID is required' }, { status: 400 })
    }

    const stmt = db.prepare('DELETE FROM Drawing WHERE id = ?')
    stmt.run(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting drawing:', error)
    return NextResponse.json({ error: 'Failed to delete drawing' }, { status: 500 })
  }
} 