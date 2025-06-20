"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
        onLogin(username, result.role || "player")
        const userRole = result.role || "player"; // Provide a fallback in case, though types should prevent
        toast({
          title: "Login Successful",
          description: `Welcome back, ${username}! You are logged in as a ${userRole}.`,
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
    <div className="w-full max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">Login</h1>
        <p className="text-gray-500 dark:text-gray-400">Enter your credentials to access your account</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            placeholder="Enter your username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Logging in..." : "Login"}
        </Button>
      </form>
      <div className="space-y-2">
        <Button 
          type="button" 
          variant="outline" 
          className="w-full" 
          onClick={handleDMLogin}
          disabled={isLoading}
        >
          {isLoading ? "Logging in..." : "Login as DM (Test)"}
        </Button>
      </div>
    </div>
  )
}
