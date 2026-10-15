// Map ping flood control, shared by the server (enforces) and the client (so you see what the others see).
// Five pings within PING_BURST_WINDOW_MS mutes you for PING_MUTE_MS; pings also need a short gap.
export const PING_MIN_GAP_MS = 400
export const PING_BURST_LIMIT = 5
export const PING_BURST_WINDOW_MS = 5000
export const PING_MUTE_MS = 10_000

export interface PingLimitState {
  /** Times of recent accepted pings. */
  recent: number[]
  mutedUntil: number
}

export const newPingLimitState = (): PingLimitState => ({ recent: [], mutedUntil: 0 })

/**
 * Records a ping attempt. `allowed`: send/show it. `muted`: this ping used up the burst, so the
 * sender is now muted until `state.mutedUntil`.
 */
export function tryPing(state: PingLimitState, now: number): { allowed: boolean; muted: boolean } {
  if (now < state.mutedUntil) return { allowed: false, muted: false }
  const last = state.recent[state.recent.length - 1]
  if (last !== undefined && now - last < PING_MIN_GAP_MS) return { allowed: false, muted: false }
  state.recent = [...state.recent.filter((t) => now - t < PING_BURST_WINDOW_MS), now]
  if (state.recent.length >= PING_BURST_LIMIT) {
    state.recent = []
    state.mutedUntil = now + PING_MUTE_MS
    return { allowed: true, muted: true }
  }
  return { allowed: true, muted: false }
}
