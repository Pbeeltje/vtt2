import { NextResponse } from "next/server"
import { clearUserCookie } from "@/lib/auth"

export async function POST(req: Request) {
  try {
    await clearUserCookie()
    return NextResponse.json({ message: "Logged out successfully" })
  } catch (error) {
    console.error("Logout error:", error)
    return NextResponse.json({ error: "Logout failed" }, { status: 500 })
  }
}

