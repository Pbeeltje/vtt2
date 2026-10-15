// The ten player colours. Shared by the server (assignment, validation) and the client (pickers).
export const PLAYER_COLORS = [
  "#e5484d", // red
  "#f76b15", // orange
  "#ffc53d", // yellow
  "#46a758", // green
  "#12a594", // teal
  "#3e8ef7", // blue
  "#8e4ec6", // purple
  "#e93d82", // pink
  "#a0704a", // brown
  "#e8e4d8", // white
] as const

export const PLAYER_COLOR_NAMES: Record<string, string> = {
  "#e5484d": "Red",
  "#f76b15": "Orange",
  "#ffc53d": "Yellow",
  "#46a758": "Green",
  "#12a594": "Teal",
  "#3e8ef7": "Blue",
  "#8e4ec6": "Purple",
  "#e93d82": "Pink",
  "#a0704a": "Brown",
  "#e8e4d8": "White",
}

export function isPlayerColor(value: unknown): value is string {
  return typeof value === "string" && (PLAYER_COLORS as readonly string[]).includes(value.toLowerCase())
}

/** The default avatar: a silhouette on a neutral background. */
export const DEFAULT_AVATAR_URL = "/default-avatar.svg"
