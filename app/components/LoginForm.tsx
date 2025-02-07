"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/use-toast"
import { loginUser, loginDM } from "@/lib/auth"

interface LoginFormProps {
  onLogin: (username: string, role: string) => void
}

export default function LoginForm({ onLogin }: LoginFormProps) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await loginUser(username, password)
      if (result.success) {
        onLogin(username, result.role)
        toast({
          title: "Login Successful",
          description: `Welcome back, ${username}! You are logged in as a ${result.role}.`,
        })
      } else {
        throw new Error(result.error || "Login failed")
      }
    } catch (error) {
      console.error("Login error:", error)
      toast({
        title: "Login Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred during login",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDMLogin = async (e: React.MouseEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const result = await loginDM()
      if (result.success) {
        onLogin("DM_User", "DM")
        toast({
          title: "DM Login",
          description: "Logged in as DM for testing.",
        })
      } else {
        throw new Error(result.error || "DM Login failed")
      }
    } catch (error) {
      console.error("DM Login error:", error)
      toast({
        title: "DM Login Failed",
        description: error instanceof Error ? error.message : "An error occurred during DM login",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <Input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Logging in..." : "Login"}
      </Button>
      <Button
        type="button"
        onClick={handleDMLogin}
        className="w-full mt-2 bg-red-500 hover:bg-red-600 text-white"
        disabled={isLoading}
      >
        DM Login (Testing)
      </Button>
    </form>
  )
}

