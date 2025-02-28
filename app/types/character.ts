export interface Character {
  CharacterId: number
  Name: string
  Description: string
  Path: string
  Category: string
  PortraitUrl?: string
  TokenUrl?: string
  Age: number
  Level: number
  Guard: number
  Armor: number
  MaxGuard: number
  Strength: number
  MaxStrength: number
  Dexternity: number
  MaxDexternity: number
  Mind: number
  MaxMind: number
  Charisma: number
  MaxCharisma: number
  Skill: number
  MaxSkill: number
  Mp: number
  MaxMp: number
  InventoryId: number
  JobId: number | null
}

