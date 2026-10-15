"use server"

// The only auth functions the browser may call. Keep this file minimal: every export
// of a "use server" module becomes a public endpoint.
import { authenticateAndSetCookie, type LoginResult } from "./auth"

export async function loginUser(username: string, password: string): Promise<LoginResult> {
  return authenticateAndSetCookie(username, password)
}
