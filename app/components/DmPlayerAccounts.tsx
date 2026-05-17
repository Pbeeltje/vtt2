"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import type { User } from "../types/user";
import type { Character } from "../types/character";
import { Plus, X, Shield, Crown } from "lucide-react";

interface DmPlayerAccountsProps {
  allUsers: User[];
  characters: Character[];
  currentUser: User;
  onRefetchUsers: () => Promise<void>;
  onRefetchCharacters: () => Promise<void>;
}

export default function DmPlayerAccounts({
  allUsers,
  characters,
  currentUser,
  onRefetchUsers,
  onRefetchCharacters,
}: DmPlayerAccountsProps) {
  const [detailUserId, setDetailUserId] = useState<number | null>(null);
  const [passwordByUser, setPasswordByUser] = useState<Record<number, { a: string; b: string }>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [addCharacterId, setAddCharacterId] = useState<string>("");

  const detailUser = useMemo(
    () => (detailUserId == null ? null : allUsers.find((u) => u.id === detailUserId) ?? null),
    [allUsers, detailUserId]
  );

  const assignedCharacters = useMemo(() => {
    if (!detailUser) return [];
    return characters.filter((c) => c.userId === detailUser.id);
  }, [characters, detailUser]);

  const assignableOptions = useMemo(() => {
    if (!detailUser) return [];
    return characters
      .filter((c) => c.userId !== detailUser.id)
      .map((c) => {
        const owner =
          c.userId && c.userId > 0
            ? allUsers.find((u) => u.id === c.userId)?.username ?? `#${c.userId}`
            : "Unassigned";
        return { c, label: `${c.Name} (${owner})` };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [characters, detailUser, allUsers]);

  const setFields = (userId: number, field: "a" | "b", value: string) => {
    setPasswordByUser((prev) => ({
      ...prev,
      [userId]: {
        a: field === "a" ? value : (prev[userId]?.a ?? ""),
        b: field === "b" ? value : (prev[userId]?.b ?? ""),
      },
    }));
  };

  const runLoading = async (key: string, fn: () => Promise<void>) => {
    setLoadingId(key);
    try {
      await fn();
    } finally {
      setLoadingId(null);
    }
  };

  const handleResetPassword = async (target: User) => {
    const pair = passwordByUser[target.id] ?? { a: "", b: "" };
    if (pair.a !== pair.b) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (pair.a.length < 8) {
      toast({ title: "Use at least 8 characters", variant: "destructive" });
      return;
    }

    try {
      await runLoading(`pw-${target.id}`, async () => {
        const res = await fetch(`/api/users/${target.id}/password`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ newPassword: pair.a }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error || "Reset failed");
        toast({
          title: "Password updated",
          description: `Tell ${target.username} their new password.`,
        });
        setPasswordByUser((prev) => {
          const next = { ...prev };
          delete next[target.id];
          return next;
        });
      });
    } catch (e) {
      toast({
        title: "Reset failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleRoleToggle = async (target: User, makeDm: boolean) => {
    const next = makeDm ? "DM" : "player";
    try {
      await runLoading(`role-${target.id}`, async () => {
        const res = await fetch(`/api/users/${target.id}/role`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ role: next }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error || "Role update failed");
        await onRefetchUsers();
        toast({
          title: makeDm ? "Admin granted" : "Admin revoked",
          description:
            next === "DM"
              ? `${target.username} should log out and back in to use DM tools.`
              : `${target.username} is now a player.`,
        });
      });
    } catch (e) {
      toast({
        title: "Role update failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const putCharacterUserId = async (characterId: number, userId: number) => {
    const res = await fetch(`/api/characters/${characterId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { error?: string }).error || "Update failed");
    }
    await onRefetchCharacters();
  };

  const handleUnassign = async (characterId: number) => {
    try {
      await runLoading(`un-${characterId}`, async () => {
        await putCharacterUserId(characterId, 0);
        toast({ title: "Character unassigned" });
      });
    } catch (e) {
      toast({
        title: "Unassign failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleAssign = async () => {
    if (!detailUser || !addCharacterId) return;
    const cid = parseInt(addCharacterId, 10);
    if (!Number.isFinite(cid)) return;
    try {
      await runLoading(`as-${cid}`, async () => {
        await putCharacterUserId(cid, detailUser.id);
        setAddCharacterId("");
        toast({ title: "Character assigned" });
      });
    } catch (e) {
      toast({
        title: "Assign failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const hostMayEditRoles = currentUser.isHostAdmin === true;

  if (allUsers.length === 0) {
    return (
      <p className="text-sm text-stone-600 bg-white/80 rounded p-3">
        No accounts yet. Players appear here after they register.
      </p>
    );
  }

  return (
    <>
      <p className="text-sm text-stone-700 bg-white/70 rounded p-2 border border-stone-300/80 mb-3">
        Open a user to reset password, assign characters, or (as host) grant admin.
      </p>
      <ul className="space-y-2">
        {allUsers.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              className="w-full text-left rounded border border-stone-400/60 bg-white/90 px-3 py-2.5 hover:bg-white flex items-center justify-between gap-2"
              onClick={() => setDetailUserId(u.id)}
            >
              <span className="font-medium text-stone-900">{u.username}</span>
              <span className="flex items-center gap-1.5 shrink-0">
                {u.isHostAdmin ? (
                  <span className="inline-flex items-center gap-0.5 text-xs font-medium text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                    <Crown className="h-3 w-3" />
                    Host
                  </span>
                ) : null}
                {u.role === "DM" && !u.isHostAdmin ? (
                  <span className="inline-flex items-center gap-0.5 text-xs font-medium text-violet-800 bg-violet-100 px-1.5 py-0.5 rounded">
                    <Shield className="h-3 w-3" />
                    Admin
                  </span>
                ) : null}
                {u.role === "player" ? (
                  <span className="text-xs uppercase tracking-wide text-stone-500">Player</span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={detailUserId !== null} onOpenChange={(o) => !o && setDetailUserId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          {detailUser ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  {detailUser.username}
                  {detailUser.isHostAdmin ? (
                    <span className="text-xs font-normal inline-flex items-center gap-1 text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                      <Crown className="h-3.5 w-3.5" />
                      Host
                    </span>
                  ) : null}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 pt-1">
                {hostMayEditRoles && !detailUser.isHostAdmin ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
                    <div className="space-y-0.5">
                      <Label htmlFor="dm-switch" className="text-sm font-medium">
                        Admin (DM)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Can run the table like you. They cannot demote the host.
                      </p>
                    </div>
                    <Switch
                      id="dm-switch"
                      checked={detailUser.role === "DM"}
                      disabled={loadingId === `role-${detailUser.id}`}
                      onCheckedChange={(checked) => void handleRoleToggle(detailUser, checked)}
                    />
                  </div>
                ) : null}

                {detailUser.isHostAdmin ? (
                  <p className="text-xs text-muted-foreground rounded-md border bg-muted/20 p-2">
                    Host accounts stay admin permanently. Another host cannot be added from the UI yet—only the
                    designated host can manage other admins.
                  </p>
                ) : null}

                <div className="space-y-2">
                  <Label>New password</Label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="New password"
                    value={passwordByUser[detailUser.id]?.a ?? ""}
                    onChange={(e) => setFields(detailUser.id, "a", e.target.value)}
                    className="bg-stone-50"
                  />
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Confirm"
                    value={passwordByUser[detailUser.id]?.b ?? ""}
                    onChange={(e) => setFields(detailUser.id, "b", e.target.value)}
                    className="bg-stone-50"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={loadingId === `pw-${detailUser.id}`}
                    onClick={() => void handleResetPassword(detailUser)}
                  >
                    {loadingId === `pw-${detailUser.id}` ? "Saving…" : "Set password"}
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Characters they control</Label>
                  {assignedCharacters.length === 0 ? (
                    <p className="text-sm text-muted-foreground">None assigned.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {assignedCharacters.map((c) => (
                        <li
                          key={c.CharacterId}
                          className="flex items-center justify-between gap-2 rounded border bg-background px-2 py-1.5 text-sm"
                        >
                          <span className="truncate">
                            {c.Name}
                            <span className="text-muted-foreground text-xs ml-1">
                              ({c.Category || c.category || "—"})
                            </span>
                          </span>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                            title="Remove access"
                            disabled={loadingId === `un-${c.CharacterId}`}
                            onClick={() => void handleUnassign(c.CharacterId)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex flex-wrap items-end gap-2 pt-1">
                    <div className="flex-1 min-w-[12rem] space-y-1">
                      <Label htmlFor="assign-char" className="text-xs text-muted-foreground">
                        Assign character
                      </Label>
                      <select
                        id="assign-char"
                        className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                        value={addCharacterId}
                        onChange={(e) => setAddCharacterId(e.target.value)}
                      >
                        <option value="">Choose…</option>
                        {assignableOptions.map(({ c, label }) => (
                          <option key={c.CharacterId} value={String(c.CharacterId)}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1"
                      disabled={!addCharacterId || loadingId?.startsWith("as-")}
                      onClick={() => void handleAssign()}
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
