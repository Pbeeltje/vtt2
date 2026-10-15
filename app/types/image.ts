import type { SceneSummary } from "@/lib/scene-model";

/**
 * A row of the image library. Lists (GET /api/images, GET /api/scenes) carry the SceneSummary
 * fields; only a single scene (GET /api/scenes/[id]) carries the full SceneData.
 */
export type DMImage = Partial<SceneSummary> & {
  Id: number;
  Name: string;
  Link: string;
  Category: "Scene" | "Image" | "Token" | "Prop";
  UserId: number;
  SceneData?: string | null; // JSON string containing scene configuration (single-scene responses only)
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
