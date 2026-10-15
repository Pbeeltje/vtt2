/** PQAR initiative: the four phases of an encounter round, in order. */
export const PHASES = [
  { name: "Prepare", letter: "P", color: "#7fb0ff" },
  { name: "Quick", letter: "Q", color: "#ffd24a" },
  { name: "Act", letter: "A", color: "#ff7a5a" },
  { name: "Release", letter: "R", color: "#c69aff" },
] as const

export type PhaseName = (typeof PHASES)[number]["name"]

/** The phase after this one; starting an encounter (null) begins at Prepare. */
export function nextPhase(current: PhaseName | null): PhaseName {
  const i = PHASES.findIndex((p) => p.name === current)
  return PHASES[(i + 1) % PHASES.length].name
}

export function phaseInfo(name: PhaseName | null) {
  return PHASES.find((p) => p.name === name) ?? null
}
