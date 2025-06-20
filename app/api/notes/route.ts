import { NextResponse } from 'next/server'
import { db } from '../../lib/db'
import { getUserFromCookie } from '../../../lib/auth'
import { getIO } from '../../../lib/socket'
import type { Note } from '../../types/note'

export async function GET() {
  try {
    // Get the last 10 notice notes for the ticker
    const stmt = db.prepare('SELECT * FROM notes WHERE Type = ? ORDER BY Id DESC LIMIT 10')
    const notes = stmt.all('notice') as Note[]
    
    return NextResponse.json(notes)
  } catch (error) {
    console.error('Error fetching notes:', error)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const currentUser = await getUserFromCookie()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only DMs can edit notes
    if (currentUser.role !== 'DM') {
      return NextResponse.json({ error: 'Forbidden: Only DMs can edit notes' }, { status: 403 })
    }

    const data = await request.json()
    
    if (!data.content || typeof data.content !== 'string') {
      return NextResponse.json({ error: 'Content is required and must be a string' }, { status: 400 })
    }

    // Create new note (always insert, don't update existing)
    const color = typeof data.color === 'string' ? data.color : '#dc2626';
    const insertStmt = db.prepare('INSERT INTO notes (Content, Type, color) VALUES (?, ?, ?)')
    const result = insertStmt.run(data.content, 'notice', color)

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Failed to save note' }, { status: 500 })
    }

    // Get the newly created note
    const getStmt = db.prepare('SELECT * FROM notes WHERE Id = ?')
    const newNote = getStmt.get(result.lastInsertRowid) as Note

    // Get all notes for the ticker (last 10)
    const getAllStmt = db.prepare('SELECT * FROM notes WHERE Type = ? ORDER BY Id DESC LIMIT 10')
    const allNotes = getAllStmt.all('notice') as Note[]

    // Emit event to all connected clients with all notes
    try {
      const io = getIO()
      io.emit('notes_updated', allNotes)
      console.log('Socket.IO: Emitted notes_updated', allNotes)
    } catch (socketError) {
      console.error("Socket.IO emit error in PUT /api/notes:", socketError)
    }

    return NextResponse.json(allNotes)
  } catch (error) {
    console.error('Error updating note:', error)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const currentUser = await getUserFromCookie()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only DMs can delete notes
    if (currentUser.role !== 'DM') {
      return NextResponse.json({ error: 'Forbidden: Only DMs can delete notes' }, { status: 403 })
    }

    // Delete all notes of type 'notice'
    const deleteStmt = db.prepare('DELETE FROM notes WHERE Type = ?')
    const result = deleteStmt.run('notice')

    // Emit event to all connected clients with empty notes array
    try {
      const io = getIO()
      io.emit('notes_updated', [])
      console.log('Socket.IO: Emitted notes_updated (cleared)', [])
    } catch (socketError) {
      console.error("Socket.IO emit error in DELETE /api/notes:", socketError)
    }

    return NextResponse.json([])
  } catch (error) {
    console.error('Error deleting notes:', error)
    return NextResponse.json({ error: 'Failed to delete notes' }, { status: 500 })
  }
} 