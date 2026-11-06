"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { api, errorMessage } from "../lib/api";
import { loginUser } from "@/lib/auth-actions";

type RegisterFormProps = {
  onRegister: (username: string) => void;
};

export default function RegisterForm({ onRegister }: RegisterFormProps) {
  const [configLoading, setConfigLoading] = useState(true);
  const [requiresInvite, setRequiresInvite] = useState(false);
  const [invitePhaseDone, setInvitePhaseDone] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<{ requiresInviteCode?: boolean }>("/api/register/config");
        if (!cancelled) {
          setRequiresInvite(Boolean(data.requiresInviteCode));
          if (!data.requiresInviteCode) {
            setInvitePhaseDone(true);
          }
        }
      } catch {
        if (!cancelled) {
          setRequiresInvite(false);
          setInvitePhaseDone(true);
        }
      } finally {
        if (!cancelled) setConfigLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleVerifyInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inviteCode.trim();
    if (!trimmed) {
      toast({ title: "Invite code required", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      await api("/api/register/verify-invite", { method: "POST", body: { inviteCode: trimmed } });
      setInvitePhaseDone(true);
    } catch (err) {
      toast({
        title: "Invite code",
        description: errorMessage(err, "Check with your host"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await api("/api/register", {
        method: "POST",
        body: { username, password, inviteCode: requiresInvite ? inviteCode.trim() : undefined },
      });
      // Registering doesn't start a session: log straight in with the same details.
      const login = await loginUser(username, password);
      if (!login.success) {
        toast({ title: "Registration successful", description: "Your account is ready: log in to continue." });
        return;
      }
      toast({ title: "Registration successful", description: "Welcome!" });
      onRegister(username);
    } catch (error) {
      toast({
        title: "Registration failed",
        description: errorMessage(error, "Unexpected error"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (configLoading) {
    return (
      <div className="space-y-4 py-2 text-sm text-muted-foreground" aria-busy="true">
        Loading…
      </div>
    );
  }

  if (requiresInvite && !invitePhaseDone) {
    return (
      <form onSubmit={handleVerifyInvite} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="register-invite">Invite code</Label>
          <Input
            id="register-invite"
            type="password"
            autoComplete="off"
            placeholder="From your host"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">Your host shares this so only invited people can sign up.</p>
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Checking…" : "Continue"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleRegister} className="space-y-4">
      {requiresInvite && (
        <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Invite ok</span>
          <button
            type="button"
            className="font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => {
              setInvitePhaseDone(false);
              setInviteCode("");
            }}
          >
            Change code
          </button>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="register-username">Username</Label>
        <Input
          id="register-username"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-password">Password</Label>
        <Input
          id="register-password"
          type="password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Registering…" : "Register"}
      </Button>
    </form>
  );
}
