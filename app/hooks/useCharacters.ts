"use client"

import { useCallback, useRef, useState } from "react"
import type { Socket } from "socket.io-client"
import { toast } from "@/components/ui/use-toast"
import { api, errorMessage, saveCharacter } from "../lib/api"
import type { Character } from "../types/character"
import type { User } from "../types/user"
import { useSocketEvent } from "./useSocket"

/**
 * The characters this user can see (all for a DM, their own for a player), kept live from
 * `character_updated` / `character_deleted`, plus the character sheet that is open.
 */
export function useCharacters(user: User | null, socket: Socket | null, onCharacterChanged?: (character: Character) => void) {
  const [characters, setCharacters] = useState<Character[]>([])
  const [sheetCharacterId, setSheetCharacterId] = useState<number | null>(null)
  const userRef = useRef(user)
  userRef.current = user
  const charactersRef = useRef(characters)
  charactersRef.current = characters
  const onChangedRef = useRef(onCharacterChanged)
  onChangedRef.current = onCharacterChanged

  const visibleToMe = (character: Character) => {
    const me = userRef.current
    return Boolean(me && (me.role === "DM" || character.userId === me.id))
  }

  /** Inserts, replaces or (when no longer ours) removes a character from the list. */
  const upsert = useCallback((character: Character) => {
    setCharacters((prev) => {
      const without = prev.filter((c) => c.CharacterId !== character.CharacterId)
      if (!visibleToMe(character)) return without
      return prev.some((c) => c.CharacterId === character.CharacterId)
        ? prev.map((c) => (c.CharacterId === character.CharacterId ? character : c))
        : [...prev, character]
    })
    onChangedRef.current?.(character)
  }, [])

  useSocketEvent<[Character]>(socket, "character_updated", (character) => {
    const me = userRef.current
    const before = charactersRef.current.find((c) => c.CharacterId === character.CharacterId)
    if (me && me.role !== "DM" && character.userId === me.id && before?.userId !== me.id) {
      toast({ title: "New character assigned", description: `You now play ${character.Name}.` })
    }
    upsert(character)
  })

  useSocketEvent<[number]>(socket, "character_deleted", (characterId) => {
    setCharacters((prev) => prev.filter((c) => c.CharacterId !== Number(characterId)))
    setSheetCharacterId((open) => (open === Number(characterId) ? null : open))
  })

  const loadCharacters = useCallback(async () => {
    try {
      setCharacters(await api<Character[]>("/api/characters"))
    } catch (error) {
      toast({ title: "Characters not loaded", description: errorMessage(error), variant: "destructive" })
    }
  }, [])

  /** Saves the given fields. Returns the saved character, or null on failure (already reported). */
  const updateCharacter = useCallback(
    async (characterId: number, changes: Partial<Character>): Promise<Character | null> => {
      try {
        const saved = await saveCharacter(characterId, changes)
        upsert(saved)
        return saved
      } catch (error) {
        toast({ title: "Character not saved", description: errorMessage(error), variant: "destructive" })
        return null
      }
    },
    [upsert]
  )

  const addCharacter = useCallback(
    async (category: string) => {
      try {
        const created = await api<Character>("/api/characters", { method: "POST", body: { category } })
        upsert(created)
        setSheetCharacterId(created.CharacterId)
      } catch (error) {
        toast({ title: "Character not created", description: errorMessage(error), variant: "destructive" })
      }
    },
    [upsert]
  )

  const deleteCharacter = useCallback(async (character: Character) => {
    try {
      await api(`/api/characters/${character.CharacterId}`, { method: "DELETE" })
      setCharacters((prev) => prev.filter((c) => c.CharacterId !== character.CharacterId))
      setSheetCharacterId((open) => (open === character.CharacterId ? null : open))
      toast({ title: "Character deleted", description: `${character.Name} has been deleted.` })
    } catch (error) {
      toast({ title: "Character not deleted", description: errorMessage(error), variant: "destructive" })
    }
  }, [])

  const reset = useCallback(() => {
    setCharacters([])
    setSheetCharacterId(null)
  }, [])

  return {
    characters,
    loadCharacters,
    updateCharacter,
    addCharacter,
    deleteCharacter,
    reset,
    sheetCharacter: characters.find((c) => c.CharacterId === sheetCharacterId) ?? null,
    openSheet: useCallback((character: { CharacterId?: number }) => {
      if (character.CharacterId) setSheetCharacterId(character.CharacterId)
    }, []),
    closeSheet: useCallback(() => setSheetCharacterId(null), []),
  }
}
