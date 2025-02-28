"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Trash2 } from "lucide-react"
import CharacterPopup from "./CharacterPopup"
import type { Character } from "../types/character"

interface CharacterListProps {
  characters: Character[]
  categories: string[]
  onAddCharacter: (category: string) => void
  onUpdateCharacter: (updatedCharacter: Character) => void
  onDeleteCharacter: (character: Character) => void
}

export default function CharacterList({
  characters,
  onAddCharacter,
  onUpdateCharacter,
  onDeleteCharacter,
}: CharacterListProps) {
  console.log("CharacterList characters:", characters)

  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>("Party")

  const handleDeleteCharacter = (character: Character) => {
    if (window.confirm(`Are you sure you want to delete ${character.Name}?`)) {
      onDeleteCharacter(character)
    }
  }

  const categories = ["Party", "NPC", "Monster"]

  return (
    <Tabs value={activeCategory} onValueChange={setActiveCategory}>
      <TabsList className="grid w-full grid-cols-3">
        {categories.map((category) => (
          <TabsTrigger key={category} value={category}>
            {category}
          </TabsTrigger>
        ))}
      </TabsList>
      {categories.map((category) => {
        const filteredCharacters = characters.filter(
          (character) => (character.Category || character.category)?.toLowerCase() === category.toLowerCase()
        )
        console.log(`Filtered characters for ${category}:`, filteredCharacters)
        return (
          <TabsContent key={category} value={category}>
            <ScrollArea className="h-[calc(100vh-250px)] pr-4">
              <ul className="space-y-2">
                {filteredCharacters.map((character) => (
                  <li
                    key={character.CharacterId}
                    className="flex items-center justify-between p-2 bg-white rounded-lg shadow"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gray-200 rounded-full overflow-hidden">
                        {character.PortraitUrl ? (
                          <Image
                            src={character.PortraitUrl || "/placeholder.svg"}
                            alt={`Portrait of ${character.Name}`}
                            width={48}
                            height={48}
                            objectFit="cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                            No Image
                          </div>
                        )}
                      </div>
                      <button className="text-left hover:underline" onClick={() => setSelectedCharacter(character)}>
                        {character.Name}
                      </button>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteCharacter(character)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
                {filteredCharacters.length === 0 && (
                  <li className="p-2 text-gray-500">No characters in this category</li>
                )}
              </ul>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => onAddCharacter(category)}>
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
          onUpdate={(updatedCharacter) => {
            onUpdateCharacter(updatedCharacter)
            setSelectedCharacter(null)
          }}
        />
      )}
    </Tabs>
  )
}