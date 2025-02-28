"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MessageSquare, Users, Map, Settings, LogOut } from "lucide-react"
import CharacterList from "./CharacterList"
import ImageList from "./ImageList"
import { toast } from "@/components/ui/use-toast"

type MessageType = "user" | "system"

interface ChatMessage {
  type: MessageType
  content: string
  timestamp: string
  username: string
}

import { Character } from "../types/character"
import { DMImage } from "../types/image"

interface RightSideMenuProps {
  messages: ChatMessage[]
  addMessage: (type: MessageType, content: string, username: string) => void
  user: string
  chatBackgroundColor: string
  characters: Character[]
  onAddCharacter: (category: string) => void
  onUpdateCharacter: (updatedCharacter: Character) => void
  onDeleteCharacter: (character: Character) => void
  onLogout: () => void
  images: DMImage[]
  onAddImage: (category: string, file: File) => Promise<void>
  onDeleteImage: (image: DMImage) => Promise<void>
  onSetBackground: (url: string) => void
  onDropImage: (category: string, image: DMImage, x: number, y: number) => void
}

export default function RightSideMenu({
  messages,
  addMessage,
  user,
  chatBackgroundColor,
  characters,
  onAddCharacter,
  onUpdateCharacter,
  onDeleteCharacter,
  onLogout,
  images,
  onAddImage,
  onDeleteImage,
  onSetBackground,
  onDropImage,
}: RightSideMenuProps) {
  const [inputMessage, setInputMessage] = useState("")
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const [activeSection, setActiveSection] = useState<"chat" | "characters" | "maps">("chat")

  console.log("RightSideMenu rendering, activeSection:", activeSection) // Log render and tab state
  console.log("RightSideMenu characters:", characters) // Log characters prop

  const handleSendMessage = () => {
    if (inputMessage.trim()) {
      addMessage("user", inputMessage, user)
      setInputMessage("")
    }
  }

  const handleDragStart = (e: React.DragEvent<HTMLLIElement>, image: DMImage) => {
    e.dataTransfer.setData("imageId", image.Id.toString())
    e.dataTransfer.setData("category", image.Category)
    e.dataTransfer.setData("url", image.Link)
  }

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages])

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/logout", { method: "POST" })
      if (response.ok) {
        onLogout()
      } else {
        throw new Error("Logout failed")
      }
    } catch (error) {
      console.error("Logout error:", error)
      toast({
        title: "Logout Failed",
        description: "An error occurred during logout. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="w-64 flex flex-col bg-gray-100 border-l h-full">
      <Tabs
        value={activeSection}
        onValueChange={(value) => {
          console.log("Tab changed to:", value) // Log tab switch
          setActiveSection(value as typeof activeSection)
        }}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="chat" className="p-2">
            <MessageSquare size={20} />
          </TabsTrigger>
          <TabsTrigger value="characters" className="p-2">
            <Users size={20} />
          </TabsTrigger>
          <TabsTrigger value="maps" className="p-2">
            <Map size={20} />
          </TabsTrigger>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="p-2 w-full h-full">
                <Settings size={20} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TabsList>
      </Tabs>
      <div className="flex-grow flex flex-col overflow-hidden">
        {activeSection === "chat" && (
          <>
            <h2 className="text-lg font-semibold p-4 pb-2">Chat</h2>
            <div ref={chatContainerRef} className={`flex-grow px-4 ${chatBackgroundColor} overflow-y-auto`}>
              <div className="space-y-2 pb-4">
                {messages.map((message, index) => (
                  <div key={index} className="text-sm">
                    {message.type === "user" ? (
                      <span className="font-semibold">
                        {message.username} (
                        {new Date(message.timestamp).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        ):
                      </span>
                    ) : (
                      <span className="font-semibold text-green-600">
                        System (
                        {new Date(message.timestamp).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        ):
                      </span>
                    )}{" "}
                    <span dangerouslySetInnerHTML={{ __html: message.content }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="p-2 border-t">
              <div className="flex h-10">
                <Input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Type a message..."
                  className="flex-grow mr-2"
                />
                <Button onClick={handleSendMessage}>Send</Button>
              </div>
            </div>
          </>
        )}
        {activeSection === "characters" && (
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">Characters</h2>
            <CharacterList
              categories={["Party", "NPC", "Monster"]}
              characters={characters}
              onAddCharacter={onAddCharacter}
              onUpdateCharacter={onUpdateCharacter}
              onDeleteCharacter={onDeleteCharacter}
            />
          </div>
        )}
        {activeSection === "maps" && (
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">Maps</h2>
            <ImageList
              images={images}
              categories={["Scene", "Image", "Token"]}
              onAddImage={onAddImage}
              onDeleteImage={onDeleteImage}
              onDragStart={handleDragStart}
              onSceneClick={onSetBackground}
            />
          </div>
        )}
      </div>
    </div>
  )
}