"use client"

import { useState, useMemo, useCallback, memo } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Trash2 } from "lucide-react"
import CharacterPopup from "./CharacterPopup"
import type { Character } from "../types/character"

const CATEGORIES = ["Party", "NPC", "Monster"] as const

interface CharacterListProps {
  characters: Character[]
  categories: string[]
  onAddCharacter: (category: string) => void
  onUpdateCharacter: (updatedCharacter: Character) => void
  onDeleteCharacter: (character: Character) => void
}

// Memoized character list item component
const CharacterListItem = memo(({ 
  character, 
  onDragStart, 
  onSelect, 
  onDelete 
}: { 
  character: Character
  onDragStart: (e: React.DragEvent<HTMLLIElement>, character: Character) => void
  onSelect: (character: Character) => void
  onDelete: (character: Character) => void
}) => {
  const imageUrl = character.TokenUrl || character.PortraitUrl || "/placeholder.svg"
  const imageAlt = `${character.TokenUrl ? 'Token' : 'Portrait'} of ${character.Name}`

  return (
    <li
      className="flex items-center justify-between p-2 bg-white rounded-lg shadow"
      draggable={true}
      onDragStart={(e) => onDragStart(e, character)}
    >
      <div className="flex items-center space-x-3">
        <div className="w-12 h-12 bg-gray-200 rounded-full overflow-hidden">
          {(character.TokenUrl || character.PortraitUrl) ? (
            <Image
              src={imageUrl}
              alt={imageAlt}
              width={48}
              height={48}
              className="object-cover"
              priority={false}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
              No Image
            </div>
          )}
        </div>
        <button className="text-left hover:underline" onClick={() => onSelect(character)}>
          {character.Name}
        </button>
      </div>
      <Button variant="ghost" size="icon" onClick={() => onDelete(character)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  )
})

CharacterListItem.displayName = "CharacterListItem"

export default function CharacterList({
  characters,
  onAddCharacter,
  onUpdateCharacter,
  onDeleteCharacter,
}: CharacterListProps) {
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>("Party")

  const handleDeleteCharacter = useCallback((character: Character) => {
    if (window.confirm(`Are you sure you want to delete ${character.Name}?`)) {
      onDeleteCharacter(character)
    }
  }, [onDeleteCharacter])

  const handleDragStart = useCallback((e: React.DragEvent<HTMLLIElement>, character: Character) => {
    e.dataTransfer.setData("imageId", character.CharacterId.toString())
    e.dataTransfer.setData("category", "Token")
    e.dataTransfer.setData("url", character.TokenUrl || character.PortraitUrl || "/placeholder.png")
    e.dataTransfer.setData("characterId", character.CharacterId.toString())
    e.dataTransfer.setData("character", JSON.stringify({
      Path: character.Path,
      Guard: character.Guard,
      MaxGuard: character.MaxGuard,
      Strength: character.Strength,
      MaxStrength: character.MaxStrength,
      Mp: character.Mp,
      MaxMp: character.MaxMp
    }))
  }, [])

  const handleSelectCharacter = useCallback((character: Character) => {
    setSelectedCharacter(character)
  }, [])

  const handleUpdateCharacter = useCallback((updatedCharacter: Character) => {
    onUpdateCharacter(updatedCharacter)
    setSelectedCharacter(null)
  }, [onUpdateCharacter])

  // Memoize the filtered characters for each category
  const filteredCharactersByCategory = useMemo(() => {
    return CATEGORIES.reduce((acc, category) => {
      acc[category] = characters.filter(
        (character) => (character.Category || character.category)?.toLowerCase() === category.toLowerCase()
      )
      return acc
    }, {} as Record<string, Character[]>)
  }, [characters])

  return (
    <Tabs value={activeCategory} onValueChange={setActiveCategory}>
      <TabsList className="grid w-full grid-cols-3">
        {CATEGORIES.map((category) => (
          <TabsTrigger key={category} value={category}>
            {category}
          </TabsTrigger>
        ))}
      </TabsList>
      {CATEGORIES.map((category) => {
        const filteredCharacters = filteredCharactersByCategory[category]
        return (
          <TabsContent key={category} value={category}>
            <ScrollArea className="h-[calc(100vh-250px)] pr-4">
              <ul className="space-y-2">
                {filteredCharacters.map((character) => (
                  <CharacterListItem
                    key={character.CharacterId}
                    character={character}
                    onDragStart={handleDragStart}
                    onSelect={handleSelectCharacter}
                    onDelete={handleDeleteCharacter}
                  />
                ))}
                {filteredCharacters.length === 0 && (
                  <li className="p-2 text-gray-500">No characters in this category</li>
                )}
              </ul>
              <Button
                className="w-full mt-4"
                onClick={() => onAddCharacter(category)}
              >
                <Plus className="w-4 h-4 mr-2" /> Add {category}
              </Button>
            </ScrollArea>
          </TabsContent>
        )
      })}
      {selectedCharacter && (
        <CharacterPopup
          character={selectedCharacter}
          onClose={() => setSelectedCharacter(null)}
          onUpdate={handleUpdateCharacter}
        />
      )}
    </Tabs>
  )
}