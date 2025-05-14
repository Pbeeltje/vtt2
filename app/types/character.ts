export interface Character {
  CharacterId: number
  Name: string
  Description: string
  Path: string
  Category?: string // Capitalized (optional)
  category?: string // Lowercase (optional, for safety)
  userId: number
  PortraitUrl?: string
  TokenUrl?: string
  Age?: number
  Level?: number
  Armor?: number
  Guard?: number
  MaxGuard?: number
  Strength?: number
  MaxStrength?: number
  Dexternity?: number
  MaxDexternity?: number
  Mind?: number
  MaxMind?: number
  Charisma?: number
  MaxCharisma?: number
  Skill?: number
  MaxSkill?: number
  Mp?: number
  MaxMp?: number
  InventoryId?: number | null
  JobId?: number | null
}