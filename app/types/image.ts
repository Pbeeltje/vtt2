export type DMImage = {
  Id: number;
  Name: string;
  Link: string;
  Category: "Scene" | "Image" | "Token";
  UserId: number;
  SceneData?: string; // JSON string containing scene configuration
};