export type LayerImage = {
    id: string
    url: string
    x: number
    y: number
    width?: number // Optional for images, not used for tokens
    height?: number // Optional for images, not used for tokens
    characterId?: number // Optional: ID of the character this token represents
    character?: {
      Path: string
      Guard: number
      MaxGuard: number
      Strength: number
      MaxStrength: number
      Mp: number
      MaxMp: number
    }
  }