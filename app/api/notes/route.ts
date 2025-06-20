import { NextResponse } from 'next/server'
import { db } from '../../lib/db'
import { requireAuth } from '../../../lib/auth'
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
    // Require DM role for note creation
    const currentUser = await requireAuth('DM')

    const data = await request.json()
    
    // Input validation
    if (!data.content || typeof data.content !== 'string') {
      return NextResponse.json({ error: 'Content is required and must be a string' }, { status: 400 })
    }

    // Sanitize content
    const sanitizedContent = data.content.trim()
    if (sanitizedContent.length === 0) {
      return NextResponse.json({ error: 'Content cannot be empty' }, { status: 400 })
    }

    if (sanitizedContent.length > 500) {
      return NextResponse.json({ error: 'Content is too long (max 500 characters)' }, { status: 400 })
    }

    // Validate color format
    const color = typeof data.color === 'string' && /^#[0-9A-F]{6}$/i.test(data.color) 
      ? data.color 
      : '#dc2626';

    // Create new note
    const insertStmt = db.prepare('INSERT INTO notes (Content, Type, color) VALUES (?, ?, ?)')
    const result = insertStmt.run(sanitizedContent, 'notice', color)

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Failed to save note' }, { status: 500 })
    }

    // Get all notes for the ticker (last 10)
    const getAllStmt = db.prepare('SELECT * FROM notes WHERE Type = ? ORDER BY Id DESC LIMIT 10')
    const allNotes = getAllStmt.all('notice') as Note[]

    // Emit event to all connected clients with all notes
    try {
      const io = getIO()
      io.emit('notes_updated', allNotes)
    } catch (socketError) {
      console.error("Socket.IO emit error in PUT /api/notes:", socketError)
    }

    return NextResponse.json(allNotes)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === "Insufficient permissions") {
        return NextResponse.json({ error: 'Forbidden: Only DMs can edit notes' }, { status: 403 })
      }
    }
    console.error('Error updating note:', error)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    // Require DM role for note deletion
    await requireAuth('DM')

    // Delete all notes of type 'notice'
    const deleteStmt = db.prepare('DELETE FROM notes WHERE Type = ?')
    const result = deleteStmt.run('notice')

    // Emit event to all connected clients with empty notes array
    try {
      const io = getIO()
      io.emit('notes_updated', [])
    } catch (socketError) {
      console.error("Socket.IO emit error in DELETE /api/notes:", socketError)
    }

    return NextResponse.json([])
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === "Insufficient permissions") {
        return NextResponse.json({ error: 'Forbidden: Only DMs can delete notes' }, { status: 403 })
      }
    }
    console.error('Error deleting notes:', error)
    return NextResponse.json({ error: 'Failed to delete notes' }, { status: 500 })
  }
} 