// Small fetch wrapper for the app's JSON API: always sends the session cookie, parses JSON,
// and throws ApiError (with the server's `error` message) on non-2xx responses.
import type { Character } from "../types/character"

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly body: any) {
    super(message)
  }
}

type ApiOptions = {
  method?: string
  body?: unknown
  /** Socket id to send as X-Socket-Id, so the server skips echoing the change back to us. */
  socketId?: string | null
}

export async function api<T = any>(url: string, { method = "GET", body, socketId }: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined && !(body instanceof FormData)) headers["Content-Type"] = "application/json"
  if (socketId) headers["X-Socket-Id"] = socketId
  const response = await fetch(url, {
    method,
    headers,
    credentials: "include",
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(data?.error || `${response.status} ${response.statusText}`, response.status, data)
  }
  return data as T
}

export const errorMessage = (error: unknown, fallback = "Something went wrong") =>
  error instanceof Error && error.message ? error.message : fallback

/** The one place characters are saved: send only the fields that changed. */
export function saveCharacter(characterId: number, changes: Partial<Character>): Promise<Character> {
  return api<Character>(`/api/characters/${characterId}`, { method: "PUT", body: changes })
}
