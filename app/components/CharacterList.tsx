"use client"

import { useState, useMemo, useCallback, memo } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Trash2 } from "lucide-react"
import { characterTokenSnapshot, characterTokenUrl } from "../lib/tokens"
import type { Character } from "../types/character"

const CATEGORIES_FOR_DM = ["Party", "NPC", "Monster"] as const

interface CharacterListProps {
  characters: Character[]
  onAddCharacter: (category: string) => void
  onOpenCharacter: (character: Character) => void
  onDeleteCharacter: (character: Character) => void
  currentUser: number
  isDM: boolean
}

const categoryOf = (character: Character) => character.Category || character.category

const CharacterListItem = memo(function CharacterListItem({
  character,
  onOpen,
  onDelete,
  currentUser,
  isDM,
}: {
  character: Character
  onOpen: (character: Character) => void
  onDelete: (character: Character) => void
  currentUser: number
  isDM: boolean
}) {
  const hasImage = Boolean(character.TokenUrl || character.PortraitUrl)
  const canDrag = isDM || (categoryOf(character) === "Party" && character.userId === currentUser)

  // The map reads these to create a token (see useDragAndDrop).
  const handleDragStart = (e: React.DragEvent<HTMLLIElement>) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ imageId: String(character.CharacterId), url: characterTokenUrl(character), category: "Token" }))
    e.dataTransfer.setData("characterId", String(character.CharacterId))
    e.dataTransfer.setData("character", JSON.stringify(characterTokenSnapshot(character)))
  }

  return (
    <li
      className="flex items-center justify-between p-2 bg-white rounded-lg shadow"
      draggable={canDrag}
      onDragStart={canDrag ? handleDragStart : undefined}
    >
      <div className="flex items-center space-x-3">
        <div className="w-12 h-12 bg-gray-200 rounded-full overflow-hidden">
          {hasImage ? (
            <Image src={characterTokenUrl(character)} alt={`${character.TokenUrl ? "Token" : "Portrait"} of ${character.Name}`} width={48} height={48} className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No Image</div>
          )}
        </div>
        <button className="text-left hover:underline" onClick={() => onOpen(character)}>
          {character.Name}
        </button>
      </div>
      {isDM && (
        <Button variant="ghost" size="icon" onClick={() => onDelete(character)} title={`Delete ${character.Name}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </li>
  )
})

function CharacterList({ characters, onAddCharacter, onOpenCharacter, onDeleteCharacter, currentUser, isDM }: CharacterListProps) {
  const [activeCategory, setActiveCategory] = useState<string>(CATEGORIES_FOR_DM[0])

  const handleDelete = useCallback(
    (character: Character) => {
      if (window.confirm(`Are you sure you want to delete ${character.Name}?`)) onDeleteCharacter(character)
    },
    [onDeleteCharacter]
  )

  const byCategory = useMemo(() => {
    const groups: Record<string, Character[]> = {}
    for (const category of CATEGORIES_FOR_DM) {
      groups[category] = characters.filter((c) => categoryOf(c)?.toLowerCase() === category.toLowerCase())
    }
    return groups
  }, [characters])

  const renderItems = (list: Character[]) =>
    list.map((character) => (
      <CharacterListItem
        key={character.CharacterId}
        character={character}
        onOpen={onOpenCharacter}
        onDelete={handleDelete}
        currentUser={currentUser}
        isDM={isDM}
      />
    ))

  if (!isDM) {
    return (
      <ScrollArea className="h-[calc(100vh-250px)] pr-4">
        {characters.length > 0 ? (
          <ul className="space-y-2">{renderItems(characters)}</ul>
        ) : (
          <p className="p-2 text-gray-500">You have no characters assigned to you.</p>
        )}
      </ScrollArea>
    )
  }

  return (
    <Tabs value={activeCategory} onValueChange={setActiveCategory}>
      <TabsList className="grid w-full grid-cols-3">
        {CATEGORIES_FOR_DM.map((category) => (
          <TabsTrigger key={category} value={category}>
            {category}
          </TabsTrigger>
        ))}
      </TabsList>
      {CATEGORIES_FOR_DM.map((category) => (
        <TabsContent key={category} value={category}>
          <ScrollArea className="h-[calc(100vh-280px)] pr-4">
            <ul className="space-y-2">
              {renderItems(byCategory[category])}
              {byCategory[category].length === 0 && <li className="p-2 text-gray-500">No characters in this category</li>}
            </ul>
            <Button className="w-full mt-4" onClick={() => onAddCharacter(category)}>
              <Plus className="w-4 h-4 mr-2" /> Add {category}
            </Button>
          </ScrollArea>
        </TabsContent>
      ))}
    </Tabs>
  )
}

export default memo(CharacterList)
