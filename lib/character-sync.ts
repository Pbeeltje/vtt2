// Character events go to DMs and the owning player only, not to every client.
// Everyone does get a payload-free "party_changed" nudge so the party row can refetch /api/party.
// It goes out on every change (not only Party ones) so a character leaving the party is noticed too.
import { getIO, DM_ROOM, AUTHENTICATED_ROOM, userRoom } from "./socket"

function rooms(ownerIds: Array<number | null | undefined>): string[] {
  const owners = new Set(ownerIds.filter((id): id is number => typeof id === "number" && Number.isFinite(id)))
  return [DM_ROOM, ...[...owners].map(userRoom)]
}

/** Also tell the previous owner when a character is reassigned, so it leaves their list. */
export function emitCharacterUpdated(character: Record<string, unknown>, previousOwnerId?: number | null) {
  try {
    const io = getIO()
    io.to(rooms([Number(character.userId), previousOwnerId])).emit("character_updated", character)
    io.to(AUTHENTICATED_ROOM).emit("party_changed")
  } catch (error) {
    console.error("[character-sync] character_updated emit failed:", error)
  }
}

export function emitCharacterDeleted(characterId: number, ownerId: number | null) {
  try {
    const io = getIO()
    io.to(rooms([ownerId])).emit("character_deleted", characterId)
    io.to(AUTHENTICATED_ROOM).emit("party_changed")
  } catch (error) {
    console.error("[character-sync] character_deleted emit failed:", error)
  }
}
