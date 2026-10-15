// Building map tokens for characters (used by the character list drag, map drops and stat refresh).
import type { Character } from "../types/character"
import type { LayerImage } from "../types/layerImage"

export type TokenCharacter = NonNullable<LayerImage["character"]>

/** Character sizes and how many grid cells wide their token is. */
export const CHARACTER_SIZES = { Small: 0.5, Medium: 1, Large: 1.5, Huge: 2, Massive: 3 } as const
export type CharacterSize = keyof typeof CHARACTER_SIZES
export const DEFAULT_CHARACTER_SIZE: CharacterSize = "Medium"

export function isCharacterSize(value: unknown): value is CharacterSize {
  return typeof value === "string" && Object.hasOwn(CHARACTER_SIZES, value)
}

/** Token width in grid cells for a size; unknown or missing sizes count as Medium. */
export function sizeMultiplier(size: unknown): number {
  return isCharacterSize(size) ? CHARACTER_SIZES[size] : 1
}

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
    Size: isCharacterSize(character.Size) ? character.Size : DEFAULT_CHARACTER_SIZE,
    userId: character.userId,
    TokenUrl: character.TokenUrl ?? undefined,
    PortraitUrl: character.PortraitUrl ?? undefined,
  }
}

export function characterTokenUrl(character: { TokenUrl?: string | null; PortraitUrl?: string | null }): string {
  return character.TokenUrl || character.PortraitUrl || "/placeholder.svg"
}

/** A new token for `character` at (x, y), as many grid cells wide as its size. */
export function createCharacterToken(character: Character | TokenCharacter, x: number, y: number, gridSize: number): LayerImage {
  const side = gridSize * sizeMultiplier(character.Size)
  return {
    id: `${character.CharacterId}-${Date.now()}`,
    url: characterTokenUrl(character),
    x,
    y,
    width: side,
    height: side,
    characterId: character.CharacterId,
    character: characterTokenSnapshot(character),
  }
}
