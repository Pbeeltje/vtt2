import { getUserFromCookie } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const user = getUserFromCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json(user);
}

