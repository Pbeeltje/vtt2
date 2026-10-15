// Tokens carry a snapshot of their character's stats (PLAN.md Phase 2 replaces it with live
// data). Until then the server refreshes the snapshots whenever a character is saved.
import { characterTokenSnapshot, characterTokenUrl, sizeMultiplier } from "../app/lib/tokens"
import type { Character } from "../app/types/character"
import type { LayerImage } from "../app/types/layerImage"
import { tokenCharacterId } from "./scene-model"
import { listSceneRows, updateScene } from "./scene-store"
import { broadcastSceneState } from "./scene-sync"

export async function refreshCharacterTokens(row: Record<string, unknown>): Promise<void> {
  const character = { ...row, CharacterId: Number(row.CharacterId), userId: Number(row.userId) } as unknown as Character
  const snapshot = characterTokenSnapshot(character)
  for (const scene of await listSceneRows()) {
    if (!scene.SceneData) continue
    const result = await updateScene(scene.Id, (state) => {
      let changed = false
      const topLayer = state.elements.topLayer.map((token): LayerImage => {
        if (tokenCharacterId(token) !== character.CharacterId || !token.character) return token
        // Follow a new token/portrait image unless the token uses an image of its own.
        const url = token.url === characterTokenUrl(token.character) ? characterTokenUrl(character) : token.url
        if (url === token.url && JSON.stringify(snapshot) === JSON.stringify(token.character)) return token
        changed = true
        // A new size scales the token, keeping any manual resize relative to it.
        const scale = sizeMultiplier(snapshot.Size) / sizeMultiplier(token.character.Size)
        const resized = scale === 1 ? {} : { width: Math.round((token.width || state.gridSize) * scale), height: Math.round((token.height || state.gridSize) * scale) }
        return { ...token, ...resized, url, characterId: character.CharacterId, character: snapshot }
      })
      return changed ? { ...state, elements: { ...state.elements, topLayer } } : { error: "unchanged", status: 200 }
    })
    if ("state" in result) broadcastSceneState(null, scene.Id, result.state)
  }
}
