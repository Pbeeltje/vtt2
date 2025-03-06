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
import type { DMImage } from "../types/image"
import type { LayerImage } from "../types/layerImage"

export type MessageType = "user" | "system"

export interface ChatMessage {
  MessageId?: number // Add from DB
  type: MessageType
  content: string
  timestamp: string
  username: string
  UserId?: number // Add from DB
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [chatBackgroundColor, setChatBackgroundColor] = useState("bg-white")
  const [images, setImages] = useState<DMImage[]>([])
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null)
  const [middleLayerImages, setMiddleLayerImages] = useState<{ id: string; url: string; x: number; y: number; width?: number; height?: number; characterId?: number; character?: any }[]>([])
  const [topLayerImages, setTopLayerImages] = useState<{ id: string; url: string; x: number; y: number; width?: number; height?: number; characterId?: number; character?: any }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [scenes, setScenes] = useState<DMImage[]>([])
  const [selectedScene, setSelectedScene] = useState<DMImage | null>(null)
  const [gridSize, setGridSize] = useState(50)
  const [gridColor, setGridColor] = useState("rgba(0,0,0,0.1)")

  const fetchPublicScene = async (sceneId: string) => {
    try {
      const sceneResponse = await fetch(`/api/public/scenes/${sceneId}`)
      if (sceneResponse.ok) {
        const scene = await sceneResponse.json()
        // Get the minimum required images for the scene
        const imagesResponse = await fetch(`/api/public/images/${sceneId}`)
        if (imagesResponse.ok) {
          const sceneImages = await imagesResponse.json()
          setImages(sceneImages)
          await handleLoadScene(scene)
        }
      }
    } catch (error) {
      console.error("Error loading public scene:", error)
    }
  }

  useEffect(() => {
    const initializeApp = async () => {
      try {
        setIsLoading(true)
        
        // First, try to load the last scene without authentication
        const lastSceneId = localStorage.getItem('lastSceneId')
        if (lastSceneId) {
          await fetchPublicScene(lastSceneId)
        }

        // Then check user authentication
        const userData = await getUserFromCookie()
        if (userData) {
          setUser(userData)
          await Promise.all([fetchCharacters(), fetchChatMessages(), fetchScenes()])
          
          // If user is DM, fetch all images
          if (userData.role === "DM") {
            await fetchImages()
          }
        }
      } catch (error) {
        console.error("Error initializing app:", error)
        toast({ title: "Error", description: "Failed to initialize application.", variant: "destructive" })
      } finally {
        setIsLoading(false)
      }
    }
    void initializeApp()
  }, [])

  const fetchCharacters = async () => {
    try {
      const response = await fetch(`/api/characters`, { credentials: "include" })
      if (response.status === 401) {
        setUser(null)
        toast({ title: "Authentication Error", description: "Please log in again.", variant: "destructive" })
        return
      }
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      const data = await response.json()
      setCharacters(data)
    } catch (error) {
      console.error("Error fetching characters:", error)
      toast({ title: "Error", description: "Failed to fetch characters.", variant: "destructive" })
    }
  }

  const fetchChatMessages = async () => {
    try {
      const response = await fetch("/api/chat", { credentials: "include" })
      if (response.status === 401) {
        setUser(null)
        toast({ title: "Authentication Error", description: "Please log in again.", variant: "destructive" })
        return
      }
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      const data = await response.json()
      setMessages(data.map((msg: any) => ({
        MessageId: msg.MessageId,
        type: msg.Type as MessageType,
        content: msg.Content,
        timestamp: msg.Timestamp,
        username: msg.Username,
        UserId: msg.UserId,
      })))
    } catch (error) {
      console.error("Error fetching chat messages:", error)
      toast({ title: "Error", description: "Failed to fetch chat messages.", variant: "destructive" })
    }
  }

  const fetchScenes = async () => {
    const response = await fetch("/api/scenes", { credentials: "include" })
    if (response.ok) {
      const scenes = await response.json()
      setScenes(scenes)
    }
  }

  const handleLogin = async (username: string, role: string) => {
    setUser({ id: 0, username, role })
    await Promise.all([fetchCharacters(), fetchChatMessages()])
  }

  const handleLogout = () => {
    setUser(null)
    setCharacters([])
    setMessages([])
  }

  const addMessage = async (type: MessageType, content: string, username: string) => {
    // Create a temporary message with a temporary ID
    const tempMessage: ChatMessage = {
      MessageId: -Date.now(), // Temporary negative ID
      type,
      content,
      timestamp: new Date().toISOString(),
      username,
      UserId: user?.id
    }

    // Add the message to the UI immediately
    setMessages((prev) => [...prev, tempMessage])

    // Send to database asynchronously
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, content }),
      })
      if (!response.ok) throw new Error("Failed to save message")
      const newMessage = await response.json()
      
      // Update the message with the real database ID
      setMessages((prev) => 
        prev.map((msg) => 
          msg.MessageId === tempMessage.MessageId 
            ? {
                MessageId: newMessage.MessageId,
                type: newMessage.Type,
                content: newMessage.Content,
                timestamp: newMessage.Timestamp,
                username: newMessage.Username,
                UserId: newMessage.UserId,
              }
            : msg
        )
      )
    } catch (error) {
      console.error("Error saving message:", error)
      // Remove the temporary message if saving failed
      setMessages((prev) => prev.filter((msg) => msg.MessageId !== tempMessage.MessageId))
      toast({ title: "Error", description: "Failed to save message.", variant: "destructive" })
    }
  }

  const handleDiceRoll = (sides: number, result: number, numberOfDice: number, individualRolls: number[]) => {
    const rollsText = numberOfDice > 1 ? ` (${individualRolls.join(", ")})` : ""
    addMessage("user", `${numberOfDice}d${sides}: <strong>${result}</strong>${rollsText}`, user?.username || "Unknown")
  }

  const handlePhaseChange = (phase: string, color: string) => {
    addMessage("system", `Phase changed to: ${phase}`, "System")
    setChatBackgroundColor(color)
  }

  const handleAddCharacter = async (category: string) => {
    try {
      const response = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      })
      if (!response.ok) throw new Error("Failed to add character")
      const newCharacter = await response.json()
      setCharacters((prevCharacters) => [...prevCharacters, newCharacter])
    } catch (error) {
      console.error("Error adding character:", error)
      toast({ title: "Error", description: "Failed to add character. Please try again.", variant: "destructive" })
    }
  }

  const handleUpdateCharacter = async (updatedCharacter: Character) => {
    try {
      const response = await fetch(`/api/characters/${updatedCharacter.CharacterId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedCharacter),
      })
      if (!response.ok) throw new Error("Failed to update character")
      setCharacters((prevCharacters) =>
        prevCharacters.map((char) => (char.CharacterId === updatedCharacter.CharacterId ? updatedCharacter : char))
      )
    } catch (error) {
      console.error("Error updating character:", error)
      toast({ title: "Error", description: "Failed to update character. Please try again.", variant: "destructive" })
    }
  }

  const handleDeleteCharacter = async (character: Character) => {
    try {
      const response = await fetch(`/api/characters/${character.CharacterId}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Failed to delete character")
      setCharacters((prevCharacters) => prevCharacters.filter((char) => char.CharacterId !== character.CharacterId))
    } catch (error) {
      console.error("Error deleting character:", error)
      toast({ title: "Error", description: "Failed to delete character. Please try again.", variant: "destructive" })
    }
  }

  const fetchImages = async (sceneOnly: boolean = false) => {
    const url = sceneOnly ? "/api/images?sceneOnly=true" : "/api/images"
    const response = await fetch(url, { credentials: "include" })
    if (response.ok) setImages(await response.json())
  }

  const handleAddImage = async (category: string, file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("category", category)
    try {
      const response = await fetch("/api/images", { method: "POST", body: formData })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to add image")
      }
      const newImage = await response.json()
      setImages((prev) => [...prev, newImage])
      toast({ title: "Image Uploaded", description: `${file.name} added to ${category}.` })
    } catch (error) {
      console.error("Error adding image:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add image.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteImage = async (image: DMImage) => {
    const response = await fetch(`/api/images/${image.Id}`, { method: "DELETE" })
    if (response.ok) setImages((prev) => prev.filter((i) => i.Id !== image.Id))
  }

  const handleRenameImage = async (image: DMImage, newName: string) => {
    try {
      const response = await fetch(`/api/images/${image.Id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      })
      if (!response.ok) throw new Error("Failed to rename image")
      const updatedImage = await response.json()
      setImages((prev) => prev.map((i) => (i.Id === image.Id ? updatedImage : i)))
    } catch (error) {
      console.error("Error renaming image:", error)
      throw error
    }
  }

  const handleSetBackground = async (url: string) => {
    setBackgroundImage(url)
    
    // Find the scene image
    const sceneImage = images.find(img => img.Link === url)
    if (sceneImage?.SceneData) {
      try {
        const sceneData = JSON.parse(sceneImage.SceneData)
        setGridSize(sceneData.gridSize || 50)
        setGridColor(sceneData.gridColor || "rgba(0,0,0,0.1)")
        setMiddleLayerImages(sceneData.elements?.middleLayer || [])
        setTopLayerImages(sceneData.elements?.topLayer || [])
        toast({ title: "Success", description: "Scene loaded successfully." })
      } catch (error) {
        console.error("Error loading scene:", error)
        toast({ title: "Error", description: "Failed to load scene data.", variant: "destructive" })
      }
    }
  }

  const handleDropImage = (category: string, image: DMImage, x: number, y: number) => {
    const imageData: { id: string; url: string; x: number; y: number; width?: number; height?: number; characterId?: number; character?: any } = { 
      id: image.Id.toString(), 
      url: image.Link, 
      x, 
      y 
    }
    if (category === "Image") {
      imageData.width = 100
      imageData.height = 100
      setMiddleLayerImages((prev) => [...prev, imageData])
    } else if (category === "Token") {
      imageData.width = 50
      imageData.height = 50
      // Check if this is a character token
      const character = characters.find(c => c.TokenUrl === image.Link || c.PortraitUrl === image.Link)
      if (character) {
        imageData.characterId = character.CharacterId
        imageData.character = {
          Name: character.Name,
          Path: character.Path,
          Guard: character.Guard ?? 0,
          MaxGuard: character.MaxGuard ?? 0,
          Strength: character.Strength ?? 0,
          MaxStrength: character.MaxStrength ?? 0,
          Mp: character.Mp ?? 0,
          MaxMp: character.MaxMp ?? 0
        }
        // Update the image in the images state with character information
        setImages(prev => prev.map(img => 
          img.Id === image.Id ? {
            ...img,
            CharacterId: character.CharacterId,
            Character: {
              Name: character.Name,
              Path: character.Path,
              Guard: character.Guard ?? 0,
              MaxGuard: character.MaxGuard ?? 0,
              Strength: character.Strength ?? 0,
              MaxStrength: character.MaxStrength ?? 0,
              Mp: character.Mp ?? 0,
              MaxMp: character.MaxMp ?? 0
            }
          } as DMImage : img
        ))
      }
      setTopLayerImages((prev) => [...prev, imageData])
    }
  }

  const handleUpdateImages = (middleLayer: LayerImage[], topLayer: LayerImage[]) => {
    setMiddleLayerImages(middleLayer)
    setTopLayerImages(topLayer)

    // Update characters state if any character data has changed
    const updatedCharacters = characters.map(char => {
      const updatedToken = topLayer.find(img => img.characterId === char.CharacterId)
      if (updatedToken?.character) {
        return {
          ...char,
          ...updatedToken.character
        }
      }
      return char
    })

    // Only update if there are actual changes
    if (JSON.stringify(updatedCharacters) !== JSON.stringify(characters)) {
      setCharacters(updatedCharacters)
    }
  }

  const handleSaveScene = async () => {
    if (!backgroundImage) {
      toast({ title: "Error", description: "Please set a background image first.", variant: "destructive" })
      return
    }

    const sceneImage = images.find(img => img.Link === backgroundImage)
    if (!sceneImage) {
      toast({ title: "Error", description: "Background image not found.", variant: "destructive" })
      return
    }

    const sceneData = {
      gridSize,
      gridColor,
      elements: {
        middleLayer: middleLayerImages,
        topLayer: topLayerImages
      }
    }

    try {
      const response = await fetch("/api/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId: sceneImage.Id,
          sceneData
        })
      })

      if (!response.ok) {
        throw new Error("Failed to save scene")
      }

      await fetchScenes()
      toast({ title: "Success", description: "Scene saved successfully." })
    } catch (error) {
      console.error("Error saving scene:", error)
      toast({ title: "Error", description: "Failed to save scene.", variant: "destructive" })
    }
  }

  const handleLoadScene = async (scene: DMImage) => {
    try {
      const sceneData = JSON.parse(scene.SceneData || "{}")
      
      setGridSize(sceneData.gridSize || 50)
      setGridColor(sceneData.gridColor || "rgba(0,0,0,0.1)")
      setMiddleLayerImages(sceneData.elements?.middleLayer || [])
      setTopLayerImages(sceneData.elements?.topLayer || [])
      setBackgroundImage(scene.Link)
      localStorage.setItem('lastSceneId', scene.Id.toString())

      // Only update character information if we have characters loaded (authenticated)
      if (characters.length > 0) {
        const updatedImages = images.map(img => {
          if (img.Category === "Token") {
            const tokenInScene = sceneData.elements?.topLayer?.find(
              (token: any) => token.id === img.Id.toString()
            )
            if (tokenInScene?.characterId && tokenInScene?.character) {
              return {
                ...img,
                CharacterId: tokenInScene.characterId,
                Character: {
                  ...tokenInScene.character,
                  Name: characters.find(c => c.CharacterId === tokenInScene.characterId)?.Name || img.Name
                }
              }
            }
          }
          return img
        })
        setImages(updatedImages)
      }
      
      toast({ title: "Success", description: "Scene loaded successfully." })
    } catch (error) {
      console.error("Error loading scene:", error)
      toast({ title: "Error", description: "Failed to load scene.", variant: "destructive" })
    }
  }

  const handleDeleteSceneData = async (image: DMImage) => {
    try {
      const response = await fetch("/api/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId: image.Id,
          sceneData: null
        })
      })

      if (!response.ok) {
        throw new Error("Failed to delete scene data")
      }

      // Update the image in the local state to remove SceneData
      setImages(prev => prev.map(img => 
        img.Id === image.Id ? { ...img, SceneData: undefined } : img
      ))

      toast({ title: "Success", description: "Scene data deleted successfully." })
    } catch (error) {
      console.error("Error deleting scene data:", error)
      toast({ title: "Error", description: "Failed to delete scene data.", variant: "destructive" })
    }
  }

  if (!user) {
    return (
      <div className="flex flex-col h-screen">
        <div className="flex-grow">
          <MainContent
            backgroundImage={backgroundImage}
            middleLayerImages={middleLayerImages}
            topLayerImages={topLayerImages}
            onUpdateImages={handleUpdateImages}
            gridSize={gridSize}
            gridColor={gridColor}
            onGridSizeChange={setGridSize}
            onGridColorChange={setGridColor}
          />
        </div>
        <div className="absolute top-4 right-4">
          <div className="bg-white p-8 rounded-lg shadow-md max-w-md">
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
      </div>
    )
  }

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen">
        <div className="flex flex-grow overflow-hidden">
          <div className="flex-grow overflow-hidden">
            <MainContent
              backgroundImage={backgroundImage}
              middleLayerImages={middleLayerImages}
              topLayerImages={topLayerImages}
              onUpdateImages={handleUpdateImages}
              gridSize={gridSize}
              gridColor={gridColor}
              onGridSizeChange={setGridSize}
              onGridColorChange={setGridColor}
            />
          </div>
          <RightSideMenu
            messages={messages}
            addMessage={addMessage}
            user={user}
            chatBackgroundColor={chatBackgroundColor}
            characters={characters}
            onAddCharacter={handleAddCharacter}
            onUpdateCharacter={handleUpdateCharacter}
            onDeleteCharacter={handleDeleteCharacter}
            onLogout={handleLogout}
            images={images}
            onAddImage={handleAddImage}
            onDeleteImage={handleDeleteImage}
            onRenameImage={handleRenameImage}
            onSetBackground={handleSetBackground}
            onDropImage={handleDropImage}
            scenes={scenes}
            onSaveScene={handleSaveScene}
            onLoadScene={handleLoadScene}
            onDeleteSceneData={handleDeleteSceneData}
          />
        </div>
        <BottomBar onDiceRoll={handleDiceRoll} onPhaseChange={handlePhaseChange} />
      </div>
    </ErrorBoundary>
  )
}