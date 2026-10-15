// Building map tokens for characters (used by the character list drag, map drops and stat refresh).
import type { Character } from "../types/character"
import type { LayerImage } from "../types/layerImage"

export type TokenCharacter = NonNullable<LayerImage["character"]>

/** The stats a token shows on the map. Phase 2 replaces this snapshot with live character data. */
export function characterTokenSnapshot(character: Character | TokenCharacter): TokenCharacter {
  return {
    CharacterId: character.CharacterId,
    Name: character.Name,
    Path: character.Path,
    Guard: character.Guard ?? 0,
    MaxGuard: character.MaxGuard ?? 0,
    Strength: character.Strength ?? 0,
    MaxStrength: character.MaxStrength ?? 0,
    Mp: character.Mp ?? 0,
    MaxMp: character.MaxMp ?? 0,
    userId: character.userId,
    TokenUrl: character.TokenUrl ?? undefined,
    PortraitUrl: character.PortraitUrl ?? undefined,
  }
}

export function characterTokenUrl(character: { TokenUrl?: string | null; PortraitUrl?: string | null }): string {
  return character.TokenUrl || character.PortraitUrl || "/placeholder.svg"
}

/** A new token for `character`, one grid cell in size, at (x, y). */
export function createCharacterToken(character: Character | TokenCharacter, x: number, y: number, gridSize: number): LayerImage {
  return {
    id: `${character.CharacterId}-${Date.now()}`,
    url: characterTokenUrl(character),
    x,
    y,
    width: gridSize,
    height: gridSize,
    characterId: character.CharacterId,
    character: characterTokenSnapshot(character),
  }
}
