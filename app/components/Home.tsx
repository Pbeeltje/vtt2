"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import LoginForm from "./LoginForm"
import RegisterForm from "./RegisterForm"
import MainContent from "./MainContent"
import RightSideMenu from "./RightSideMenu"
import BottomBar from "./BottomBar"
import { toast } from "@/components/ui/use-toast"
import { getUserFromCookie } from "@/lib/auth"
import type { User } from "../types/user"
import type { Character } from "../types/character"
import ErrorBoundary from "./ErrorBoundary"
import type { DMImage } from "../types/image";

export type MessageType = "user" | "system"

export interface ChatMessage {
  type: MessageType
  content: string
  timestamp: string
  username: string
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [chatBackgroundColor, setChatBackgroundColor] = useState("bg-white")
  const [images, setImages] = useState<DMImage[]>([]);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const userData = await getUserFromCookie();
        if (userData) {
          setUser(userData);
          // Fetch characters for all users
          await fetchCharacters();
          // Fetch images only for DMs
          if (userData.role === "DM") {
            await fetchImages();
          }
        }
      } catch (error) {
        console.error("Error checking user:", error);
        toast({
          title: "Error",
          description: "Failed to authenticate user. Please try logging in again.",
          variant: "destructive",
        });
      }
    };
  
    void checkUser();
  }, []);

  const fetchCharacters = async () => {
    try {
      const response = await fetch(`/api/characters`, {
        credentials: "include",
      })

      if (response.status === 401) {
        setUser(null)
        toast({
          title: "Authentication Error",
          description: "Please log in again.",
          variant: "destructive",
        })
        return
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log("Fetched characters:", data) // Add this line for debugging
      setCharacters(data)
    } catch (error) {
      console.error("Error fetching characters:", error)
      toast({
        title: "Error",
        description: "Failed to fetch characters. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleLogin = async (username: string, role: string) => {
    setUser({ id: 0, username, role })
    void fetchCharacters()
  }

  const handleLogout = () => {
    setUser(null)
    setCharacters([])
  }

  const addMessage = (type: MessageType, content: string, username: string) => {
    const newMessage: ChatMessage = {
      type,
      content,
      timestamp: new Date().toISOString(),
      username,
    }
    setMessages((prevMessages) => [...prevMessages, newMessage])
  }

  const handleDiceRoll = (sides: number, result: number) => {
    addMessage("system", `Rolled a d${sides}: ${result}`, "System")
  }

  const handlePhaseChange = (phase: string, color: string) => {
    addMessage("system", `Phase changed to: ${phase}`, "System")
    setChatBackgroundColor(color)
  }

  const handleAddCharacter = async (category: string) => {
    try {
      const response = await fetch("/api/characters", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ category }),
      })

      if (!response.ok) {
        throw new Error("Failed to add character")
      }

      const newCharacter = await response.json()
      setCharacters((prevCharacters) => [...prevCharacters, newCharacter])
    } catch (error) {
      console.error("Error adding character:", error)
      toast({
        title: "Error",
        description: "Failed to add character. Please try again.",
        variant: "destructive",
      })
    }
  }
  
  const handleUpdateCharacter = async (updatedCharacter: Character) => {
    try {
      const response = await fetch(`/api/characters/${updatedCharacter.CharacterId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedCharacter),
      })

      if (!response.ok) {
        throw new Error("Failed to update character")
      }

      setCharacters((prevCharacters) =>
        prevCharacters.map((char) => (char.CharacterId === updatedCharacter.CharacterId ? updatedCharacter : char)),
      )
    } catch (error) {
      console.error("Error updating character:", error)
      toast({
        title: "Error",
        description: "Failed to update character. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteCharacter = async (character: Character) => {
    try {
      const response = await fetch(`/api/characters/${character.CharacterId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete character")
      }

      setCharacters((prevCharacters) => prevCharacters.filter((char) => char.CharacterId !== character.CharacterId))
    } catch (error) {
      console.error("Error deleting character:", error)
      toast({
        title: "Error",
        description: "Failed to delete character. Please try again.",
        variant: "destructive",
      })
    }
  }

  const fetchImages = async () => {
    const response = await fetch("/api/images", { credentials: "include" });
    if (response.ok) setImages(await response.json());
  };
  
  const handleAddImage = async (category: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    const response = await fetch("/api/images", {
      method: "POST",
      body: formData,
    });
    if (response.ok) {
      const newImage = await response.json();
      setImages((prev) => [...prev, newImage]);
    }
  };
  
  const handleDeleteImage = async (image: DMImage) => {
    const response = await fetch(`/api/images/${image.Id}`, { method: "DELETE" });
    if (response.ok) setImages((prev) => prev.filter((i) => i.Id !== image.Id));
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <LoginForm onLogin={handleLogin} />
            </TabsContent>
            <TabsContent value="register">
              <RegisterForm onRegister={handleLogin} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen">
        <div className="flex flex-grow overflow-hidden">
          <div className="flex-grow overflow-hidden">
            <MainContent />
          </div>
          <RightSideMenu
            messages={messages}
            addMessage={addMessage}
            user={user.username}
            chatBackgroundColor={chatBackgroundColor}
            characters={characters}
            onAddCharacter={handleAddCharacter}
            onUpdateCharacter={handleUpdateCharacter}
            onDeleteCharacter={handleDeleteCharacter}
            onLogout={handleLogout}
            images={images}
            onAddImage={handleAddImage}
            onDeleteImage={handleDeleteImage}
          />
        </div>
        <BottomBar onDiceRoll={handleDiceRoll} onPhaseChange={handlePhaseChange} />
      </div>
    </ErrorBoundary>
  )
}

