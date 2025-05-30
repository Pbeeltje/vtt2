"use client"

import { useState, useMemo, useCallback, memo, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Trash2 } from "lucide-react"
import CharacterPopup from "./character-popup/CharacterPopup"
import type { Character } from "../types/character"
import type { User } from "../types/user"

const CATEGORIES_FOR_DM = ["Party", "NPC", "Monster"] as const;

interface CharacterListProps {
  characters: Character[]
  onAddCharacter: (category: string) => void
  onUpdateCharacter: (updatedCharacter: Character) => void
  onDeleteCharacter: (character: Character) => void
  currentUser: number // ID of the logged-in user
  isDM: boolean
  allUsers?: User[]
}

// Memoized character list item component
const CharacterListItem = memo(({ 
  character, 
  onDragStart, 
  onSelect, 
  onDelete,
  currentUser,
  isDM
}: { 
  character: Character
  onDragStart: (e: React.DragEvent<HTMLLIElement>, character: Character) => void
  onSelect: (character: Character) => void
  onDelete: (character: Character) => void
  currentUser: number
  isDM: boolean
}) => {
  const imageUrl = character.TokenUrl || character.PortraitUrl || "/placeholder.svg"
  const imageAlt = `${character.TokenUrl ? 'Token' : 'Portrait'} of ${character.Name}`
  
  const characterCategory = character.Category || character.category;
  const canDrag = isDM || (characterCategory === "Party" && character.userId === currentUser)

  return (
    <li
      className="flex items-center justify-between p-2 bg-white rounded-lg shadow"
      draggable={canDrag}
      onDragStart={(e) => canDrag && onDragStart(e, character)}
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
      {(isDM) && (
        <Button variant="ghost" size="icon" onClick={() => onDelete(character)} title={`Delete ${character.Name}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </li>
  )
})

CharacterListItem.displayName = "CharacterListItem"

export default function CharacterList({
  characters, // For players, this will be pre-filtered
  onAddCharacter,
  onUpdateCharacter,
  onDeleteCharacter,
  currentUser,
  isDM,
  allUsers,
}: CharacterListProps) {
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>(CATEGORIES_FOR_DM[0]) // Default for DM

  const handleDeleteCharacter = useCallback((character: Character) => {
    if (window.confirm(`Are you sure you want to delete ${character.Name}?`)) {
      onDeleteCharacter(character)
    }
  }, [onDeleteCharacter])

  const handleDragStart = useCallback((e: React.DragEvent<HTMLLIElement>, character: Character) => {
    e.dataTransfer.setData("imageId", character.CharacterId.toString())
    e.dataTransfer.setData("category", "Props") // Always "Props" when dragging from character list
    e.dataTransfer.setData("image-url", character.TokenUrl || character.PortraitUrl || "/placeholder.png")
    e.dataTransfer.setData("characterId", character.CharacterId.toString())
    e.dataTransfer.setData("character", JSON.stringify({
      CharacterId: character.CharacterId,
      Name: character.Name,
      Path: character.Path,
      Guard: character.Guard ?? 0,
      MaxGuard: character.MaxGuard ?? 0,
      Strength: character.Strength ?? 0,
      MaxStrength: character.MaxStrength ?? 0,
      Mp: character.Mp ?? 0,
      MaxMp: character.MaxMp ?? 0,
      userId: character.userId
    }))
  }, [])

  const handleSelectCharacter = useCallback((character: Character) => {
    setSelectedCharacter(character)
  }, [])

  const handleUpdateCharacter = useCallback((updatedCharacter: Character) => {
    onUpdateCharacter(updatedCharacter)
  }, [onUpdateCharacter])

  // Memoize the filtered characters for each category (DM view)
  const filteredCharactersByCategoryForDM = useMemo(() => {
    if (!isDM) return {}; // Not used by players
    return CATEGORIES_FOR_DM.reduce((acc: Record<string, Character[]>, category: string) => {
      acc[category] = characters.filter(
        (character: Character) => (character.Category || character.category)?.toLowerCase() === category.toLowerCase()
      )
      return acc
    }, {} as Record<string, Character[]>);
  }, [characters, isDM]);

  if (!isDM) {
    // Player View: Single list of their characters
    return (
      <>
        <ScrollArea className="h-[calc(100vh-250px)] pr-4"> {/* Adjust height as needed */}
          {characters.length > 0 ? (
            <ul className="space-y-2">
              {characters.map((character) => (
                <CharacterListItem
                  key={character.CharacterId}
                  character={character}
                  onDragStart={handleDragStart}
                  onSelect={handleSelectCharacter}
                  onDelete={handleDeleteCharacter}
                  currentUser={currentUser}
                  isDM={isDM} // Will be false
                />
              ))}
            </ul>
          ) : (
            <p className="p-2 text-gray-500">You have no characters assigned to you.</p>
          )}
        </ScrollArea>
        {selectedCharacter && (
          <CharacterPopup
            character={selectedCharacter}
            onClose={() => setSelectedCharacter(null)}
            onUpdate={handleUpdateCharacter}
            isDM={isDM}
            allUsers={allUsers}
          />
        )}
      </>
    );
  }

  // DM View: Tabbed interface
  return (
    <>
      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="grid w-full grid-cols-3">
          {CATEGORIES_FOR_DM.map((category) => (
            <TabsTrigger key={category} value={category}>
              {category}
            </TabsTrigger>
          ))}
        </TabsList>
        {CATEGORIES_FOR_DM.map((category) => {
          const filteredCharacters = filteredCharactersByCategoryForDM[category] || [];
          return (
            <TabsContent key={category} value={category}>
              <ScrollArea className="h-[calc(100vh-280px)] pr-4"> {/* Adjusted height for DM view with Add button */}
                <ul className="space-y-2">
                  {filteredCharacters.map((character) => (
                    <CharacterListItem
                      key={character.CharacterId}
                      character={character}
                      onDragStart={handleDragStart}
                      onSelect={handleSelectCharacter}
                      onDelete={handleDeleteCharacter}
                      currentUser={currentUser}
                      isDM={isDM} // Will be true
                    />
                  ))}
                  {filteredCharacters.length === 0 && (
                    <li className="p-2 text-gray-500">No characters in this category</li>
                  )}
                </ul>
                {isDM && (
                  <Button
                    className="w-full mt-4"
                    onClick={() => onAddCharacter(category)}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add {category}
                  </Button>
                )}
              </ScrollArea>
            </TabsContent>
          )
        })}
      </Tabs>
      {selectedCharacter && (
        <CharacterPopup
          character={selectedCharacter}
          onClose={() => setSelectedCharacter(null)}
          onUpdate={handleUpdateCharacter}
          isDM={isDM}
          allUsers={allUsers}
        />
      )}
    </>
  )
}