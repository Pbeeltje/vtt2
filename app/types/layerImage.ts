export type LayerImage = {
    id: string
    url: string
    x: number
    y: number
    width?: number // Optional for images, not used for tokens
    height?: number // Optional for images, not used for tokens
    category?: string // Category from database: "Token", "Prop", "Image"
    characterId?: number // Optional: ID of the character this token represents
    color?: string // Optional: Token color overlay (hex color)
    auraColor?: string // Optional: Token aura color (hex color)
    auraRadius?: number // Optional: Token aura radius in grid units
    character?: {
      CharacterId?: number; // Add CharacterId here
      Name: string
      Path: string
      Guard: number
      MaxGuard: number
      Strength: number
      MaxStrength: number
      Mp: number
      MaxMp: number
      userId?: number; // Added character's userId
      TokenUrl?: string; // Add TokenUrl for token images
      PortraitUrl?: string; // Add PortraitUrl for portrait images
    }
  }