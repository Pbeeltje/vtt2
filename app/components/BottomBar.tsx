"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import EncounterButton from "./EncounterButton"
import type { Note } from "../types/note"

interface BottomBarProps {
  onDiceRoll: (sides: number, result: number, numberOfDice: number, individualRolls: number[]) => void
  onPhaseChange: (phase: string, color: string) => void
  userRole?: string
}

export default function BottomBar({ onDiceRoll, onPhaseChange, userRole }: BottomBarProps) {
  const [numberOfDice, setNumberOfDice] = useState(1)
  const [notes, setNotes] = useState<Note[]>([])
  const [isEditingNotepad, setIsEditingNotepad] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [newNoteContent, setNewNoteContent] = useState("")
  const tickerRef = useRef<HTMLDivElement>(null)

  // Load notes from database on component mount
  useEffect(() => {
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
  }, [])

  // Listen for note updates from Socket.IO
  useEffect(() => {
    const handleNotesUpdate = (updatedNotes: Note[]) => {
      setNotes(updatedNotes)
    }

    // Add event listener for note updates
    window.addEventListener('notes_updated', ((event: CustomEvent) => {
      handleNotesUpdate(event.detail)
    }) as EventListener)

    return () => {
      window.removeEventListener('notes_updated', ((event: CustomEvent) => {
        handleNotesUpdate(event.detail)
      }) as EventListener)
    }
  }, [])

  const rollDice = (sides: number) => {
    let total = 0
    const individualRolls: number[] = []
    for (let i = 0; i < numberOfDice; i++) {
      const roll = Math.floor(Math.random() * sides) + 1
      individualRolls.push(roll)
      total += roll
    }
    onDiceRoll(sides, total, numberOfDice, individualRolls)
    setNumberOfDice(1) // Reset to 1 after rolling
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
        body: JSON.stringify({ content: newNoteContent.trim() }),
      })

      if (response.ok) {
        const updatedNotes: Note[] = await response.json()
        setNotes(updatedNotes)
        setNewNoteContent("")
        setIsEditingNotepad(false)
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
    if (!isDM) return
    
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

  // Create ticker text from notes (newest to oldest for natural reading)
  const tickerText = notes.map(note => note.Content).join('\u00A0\u00A0\u00A0\u00A0\u00A0::\u00A0\u00A0\u00A0\u00A0\u00A0')

  // Calculate dynamic animation duration based on text length
  // Base duration of 20s for short text, scales up with length (much faster)
  const baseDuration = 20
  const textLength = tickerText.length
  const dynamicDuration = Math.max(baseDuration, Math.min(40, baseDuration + (textLength * 0.1)))

  // Create duplicated text for seamless looping
  const loopedText = tickerText ? `${tickerText}     ::     ${tickerText}` : ''

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
        <Button onClick={() => rollDice(4)} variant="default" size="icon" className="bg-neutral-600 border-b-4 border-neutral-800">
          d4
        </Button>
        <Button onClick={() => rollDice(6)} variant="default" size="icon" className="bg-neutral-600 border-b-4 border-neutral-800">
          d6
        </Button>
        <Button onClick={() => rollDice(8)} variant="default" size="icon" className="bg-neutral-600 border-b-4 border-neutral-800">
          d8
        </Button>
        <Button onClick={() => rollDice(10)} variant="default"  size="icon" className="bg-neutral-600 border-b-4 border-neutral-800">
          d10
        </Button>
        <Button onClick={() => rollDice(12)} variant="default"  size="icon"className="bg-neutral-600 border-b-4 border-neutral-800">
          d12
        </Button>
        <Button onClick={() => rollDice(20)} variant="default"  size="icon" className="bg-neutral-600 border-b-4 border-neutral-800">
          d20
        </Button>
        <Button onClick={() => rollDice(30)} variant="default"  size="icon" className="bg-neutral-600 border-b-4 border-neutral-800">
          d30
        </Button>
        <Button onClick={() => rollDice(100)} variant="default" size="icon" className="bg-neutral-600 border-b-4 border-neutral-800">
          d100
        </Button>
        <EncounterButton onPhaseChange={onPhaseChange} />
      </div>

      {/* Ticker Section - Takes exact width of side menu (39rem) */}
      <div className="w-[39rem] min-w-0">
        <div className="bg-white/90 backdrop-blur rounded border border-gray-300 shadow-sm overflow-hidden h-10 flex items-center">
          {isEditingNotepad && isDM ? (
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
                } else if (e.key === 'Delete') {
                  handleNotepadClear()
                }
              }}
              placeholder="ADD NEW NOTE... (ENTER TO SAVE, ESC TO CANCEL, DEL TO CLEAR ALL)"
              className="w-full h-8 px-2 py-1 text-sm border-none outline-none bg-transparent text-center font-black text-red-600 uppercase tracking-wider"
              style={{
                fontFamily: 'Arial Black, Impact, sans-serif'
              }}
              autoFocus
              disabled={isLoading}
            />
          ) : (
            <div 
              className="w-full h-8 px-2 py-1 text-sm cursor-pointer flex items-center justify-center overflow-hidden"
              onClick={() => isDM && setIsEditingNotepad(true)}
              title={isDM ? "Click to add new note" : "DM Notes Ticker"}
              style={{height: '2.5rem'}}
            >
              {tickerText ? (
                <div 
                  ref={tickerRef}
                  className="whitespace-nowrap font-black text-red-600 ticker-scroll uppercase tracking-wider"
                  style={{
                    animation: isEditingNotepad ? 'none' : `ticker-scroll-left ${dynamicDuration}s ease-in-out infinite`,
                    fontFamily: 'Arial Black, Impact, sans-serif'
                  }}
                >
                  {loopedText}
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
      `}</style>
    </div>
  )
}
