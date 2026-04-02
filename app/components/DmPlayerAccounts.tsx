"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/use-toast"
import type { User } from "../types/user"

interface DmPlayerAccountsProps {
  allUsers: User[]
}

export default function DmPlayerAccounts({ allUsers }: DmPlayerAccountsProps) {
  const [passwordByUser, setPasswordByUser] = useState<Record<number, { a: string; b: string }>>({})
  const [loadingId, setLoadingId] = useState<number | null>(null)

  const setFields = (userId: number, field: "a" | "b", value: string) => {
    setPasswordByUser((prev) => ({
      ...prev,
      [userId]: { a: field === "a" ? value : (prev[userId]?.a ?? ""), b: field === "b" ? value : (prev[userId]?.b ?? "") },
    }))
  }

  const handleReset = async (target: User) => {
    const pair = passwordByUser[target.id] ?? { a: "", b: "" }
    if (pair.a !== pair.b) {
      toast({ title: "Passwords do not match", variant: "destructive" })
      return
    }
    if (pair.a.length < 8) {
      toast({ title: "Use at least 8 characters", variant: "destructive" })
      return
    }

    setLoadingId(target.id)
    try {
      const res = await fetch(`/api/users/${target.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newPassword: pair.a }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(data.error || "Reset failed")
      }
      toast({ title: "Password updated", description: `Tell ${target.username} their new password (you can’t see it again).` })
      setPasswordByUser((prev) => {
        const next = { ...prev }
        delete next[target.id]
        return next
      })
    } catch (e) {
      toast({
        title: "Reset failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoadingId(null)
    }
  }

  if (allUsers.length === 0) {
    return (
      <p className="text-sm text-stone-600 bg-white/80 rounded p-3">
        No registered players yet. They appear here after signing up.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-700 bg-white/70 rounded p-2 border border-stone-300/80">
        Set a new password for any account. You never see the old password—only replace it and share the new one with the
        player.
      </p>
      <ul className="space-y-3">
        {allUsers.map((u) => (
          <li
            key={u.id}
            className="rounded border border-stone-400/60 bg-white/85 p-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-stone-900">{u.username}</span>
              <span className="text-xs uppercase tracking-wide text-stone-500">{u.role}</span>
            </div>
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="New password"
              value={passwordByUser[u.id]?.a ?? ""}
              onChange={(e) => setFields(u.id, "a", e.target.value)}
              className="bg-stone-100 text-sm h-9"
            />
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="Confirm new password"
              value={passwordByUser[u.id]?.b ?? ""}
              onChange={(e) => setFields(u.id, "b", e.target.value)}
              className="bg-stone-100 text-sm h-9"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={loadingId === u.id}
              onClick={() => void handleReset(u)}
            >
              {loadingId === u.id ? "Saving…" : "Set password"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
