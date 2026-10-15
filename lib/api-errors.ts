import { NextResponse } from "next/server"

/** Maps the errors thrown by requireAuth() to 401/403 responses; null for anything else. */
export function authErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof Error) {
    if (error.message === "Authentication required") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    if (error.message === "Insufficient permissions") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }
  }
  return null
}

/** Parses a positive integer route/query id, or returns null. */
export function parseId(value: unknown): number | null {
  const id = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN
  return Number.isSafeInteger(id) && id > 0 ? id : null
}
