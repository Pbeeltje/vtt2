export type DMImage = {
  Id: number;
  Name: string;
  Link: string;
  Category: "Scene" | "Image" | "Token" | "Props";
  UserId: number;
  SceneData?: string; // JSON string containing scene configuration
  CharacterId?: number; // Reference to the character this token represents
  Character?: {
    Name: string;
    Path: string;
    Guard: number;
    MaxGuard: number;
    Strength: number;
    MaxStrength: number;
    Mp: number;
    MaxMp: number;
  };
};