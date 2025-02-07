import { NextResponse } from "next/server"
import { clearUserCookie } from "@/lib/auth"

export async function POST(req: Request) {
  const response = NextResponse.json({ message: "Logged out successfully" })
  clearUserCookie(response)
  return response
}

