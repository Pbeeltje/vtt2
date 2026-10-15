"use client"

import { memo, useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import EncounterButton from "./EncounterButton"
import type { Note } from "../types/note"
import { toPlainText } from "@/lib/chat-text"

const SAFE_COLOR = /^#[0-9a-f]{3,8}$/i

const DICE = [4, 6, 8, 10, 12, 20, 30, 100]

interface BottomBarProps {
  /** Rolls a dice expression (e.g. "2d6", "2d8kh1") on the server; the result appears in chat. */
  onRoll: (expression: string) => void
  onPhaseChange: (phase: string, color: string) => void
  userRole?: string
}

function BottomBar({ onRoll, onPhaseChange, userRole }: BottomBarProps) {
  const [numberOfDice, setNumberOfDice] = useState(1)
  const [expression, setExpression] = useState("")
  const [notes, setNotes] = useState<Note[]>([])
  const [isEditingNotepad, setIsEditingNotepad] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [newNoteContent, setNewNoteContent] = useState("")
  const tickerRef = useRef<HTMLDivElement>(null)
  const [noteColor, setNoteColor] = useState('#dc2626')

  // Load notes from database once logged in (the endpoint requires a session)
  useEffect(() => {
    if (!userRole) {
      setNotes([])
      return
    }
    const fetchNotes = async () => {
      try {
        const response = await fetch('/api/notes')
        if (response.ok) {
          const notesData: Note[] = await response.json()
          setNotes(notesData)
        }
      } catch (error) {
        console.error('Error fetching notes:', error)
      }
    }

    fetchNotes()
  }, [userRole])

  // Listen for note updates from Socket.IO
  useEffect(() => {
    const handleNotesUpdate = ((event: CustomEvent<Note[]>) => {
      setNotes(event.detail)
    }) as EventListener

    window.addEventListener('notes_updated', handleNotesUpdate)
    return () => {
      window.removeEventListener('notes_updated', handleNotesUpdate)
    }
  }, [])

  const rollDice = (sides: number) => {
    onRoll(`${numberOfDice}d${sides}`)
    setNumberOfDice(1) // Reset to 1 after rolling
  }

  const rollExpression = () => {
    if (!expression.trim()) return
    onRoll(expression.trim())
    setExpression("")
  }

  const handleNotepadSave = async () => {
    if (!isDM || !newNoteContent.trim()) return
    
    setIsLoading(true)
    try {
      const response = await fetch('/api/notes', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: newNoteContent.trim(), color: noteColor }),
      })

      if (response.ok) {
        const updatedNotes: Note[] = await response.json()
        setNotes(updatedNotes)
        setNewNoteContent("")
        setIsEditingNotepad(false)
        setNoteColor('#dc2626') // Reset color after save
      } else {
        const error = await response.json()
        console.error('Error saving note:', error)
      }
    } catch (error) {
      console.error('Error saving note:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleNotepadCancel = () => {
    setIsEditingNotepad(false)
    setNewNoteContent("")
  }

  const handleNotepadClear = async () => {
    if (!isDM || !window.confirm("Remove every note from the ticker?")) return
    
    setIsLoading(true)
    try {
      const response = await fetch('/api/notes', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        setNotes([])
        setIsEditingNotepad(false)
      } else {
        const error = await response.json()
        console.error('Error clearing notes:', error)
      }
    } catch (error) {
      console.error('Error clearing notes:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const isDM = userRole === 'DM'

  // Ticker items from notes (newest to oldest for natural reading), rendered as text, never HTML
  const renderTickerItems = (copy: number) => notes.map((note, idx) => (
    <span key={`${copy}-${note.Id ?? idx}`}>
      <span style={{ color: SAFE_COLOR.test(note.color || '') ? note.color : '#dc2626' }}>
        {toPlainText(note.Content)}
      </span>
      {idx < notes.length - 1 && <span style={{ color: '#888', margin: '0 1rem' }}> :: </span>}
    </span>
  ));
  const hasTickerItems = notes.length > 0;

  // Calculate dynamic animation duration based on actual text length (not HTML)
  const baseDuration = 19
  const textLength = notes.map(note => note.Content).join('').length
  const dynamicDuration = Math.max(baseDuration, Math.min(38, baseDuration + (textLength * 0.095)))

  // When editing, allow color selection
  const handleColorCircleClick = () => {
    // Generate a random color
    const randomColor = `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
    setNoteColor(randomColor);
  };

  return (
    <div className="bg-gray-200 p-2 flex items-center justify-end w-full overflow-x-auto" style={{ backgroundImage: 'url("images/bottombar.jpeg")', backgroundSize: 'auto 150%', backgroundRepeat: 'repeat-x' }}>
      {/* Dice Section - Fixed width on the left */}
      <div className="flex items-center space-x-2 flex-shrink-0 mr-8">
        <input
          type="number"
          min="1"
          value={numberOfDice}
          onChange={(e) => setNumberOfDice(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-12 h-8 text-center border rounded bg-gray-400"
        />
        {DICE.map((sides) => (
          <Button key={sides} onClick={() => rollDice(sides)} variant="default" size="icon" className="bg-neutral-600 border-b-4 border-neutral-800">
            d{sides}
          </Button>
        ))}
        <input
          type="text"
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && rollExpression()}
          placeholder="2d8kh1+1"
          title="Roll any expression: 3d6, d20+2, 2d8kh1 (keep highest), 4d6kl3 (keep lowest). Enter to roll."
          maxLength={100}
          className="w-24 h-8 px-2 text-sm border rounded bg-gray-400 placeholder:text-gray-600"
        />
        <EncounterButton onPhaseChange={onPhaseChange} />
      </div>

      {/* Ticker Section - Takes exact width of side menu (39rem) */}
      <div className="w-[39rem] min-w-0">
        <div className="bg-white/90 backdrop-blur rounded border border-gray-300 shadow-sm overflow-hidden h-10 flex items-center">
          {isEditingNotepad && isDM ? (
            <div className="flex items-center w-full">
              <div
                className="w-6 h-6 rounded-full border-2 border-gray-400 mr-2 cursor-pointer flex-shrink-0"
                style={{ backgroundColor: noteColor }}
                title="Click to randomize color"
                onClick={handleColorCircleClick}
              />
              <input
                type="text"
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                onBlur={handleNotepadSave}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    handleNotepadCancel()
                  } else if (e.key === 'Enter') {
                    handleNotepadSave()
                  }
                }}
                placeholder="ADD NEW NOTE... (ENTER TO SAVE, ESC TO CANCEL)"
                className="w-full h-8 px-2 py-1 text-sm border-none outline-none bg-transparent text-center font-black uppercase tracking-wider"
                style={{
                  fontFamily: 'Arial Black, Impact, sans-serif',
                  color: noteColor
                }}
                autoFocus
                disabled={isLoading}
              />
              <button
                type="button"
                // Keep focus in the input so onBlur doesn't save first.
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleNotepadClear}
                disabled={isLoading || notes.length === 0}
                className="flex-shrink-0 mx-2 text-xs font-semibold text-red-700 hover:underline disabled:opacity-40"
                title="Remove all notes from the ticker"
              >
                Clear all
              </button>
            </div>
          ) : (
            <div 
              className="w-full h-8 px-2 py-1 text-sm cursor-pointer flex items-center justify-center overflow-hidden"
              onClick={() => isDM && setIsEditingNotepad(true)}
              title={isDM ? "Click to add new note" : "DM Notes Ticker"}
              style={{height: '2.5rem'}}
            >
              {hasTickerItems ? (
                <div
                  ref={tickerRef}
                  className="whitespace-nowrap font-black ticker-scroll uppercase tracking-wider"
                  style={{
                    animation: isEditingNotepad ? 'none' : `ticker-scroll-left ${dynamicDuration}s linear infinite`,
                    fontFamily: 'Arial Black, Impact, sans-serif'
                  }}
                >
                  {/* Rendered twice for seamless looping */}
                  {renderTickerItems(0)}
                  {renderTickerItems(1)}
                </div>
              ) : (
                <span className="font-black text-gray-500 uppercase tracking-wider text-center" style={{
                  fontFamily: 'Arial Black, Impact, sans-serif',
                  animation: 'none'
                }}>NO MESSAGES</span>
              )}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes ticker-scroll-left {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .ticker-scroll {
          display: inline-block;
          min-width: 100%;
        }
        .ticker-block {
          display: inline-block;
          white-space: nowrap;
        }
      `}</style>
    </div>
  )
}

export default memo(BottomBar)
