"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MessageSquare, Users, Map, Settings, LogOut, Trash2 } from "lucide-react"
import CharacterList from "./CharacterList"
import ImageList from "./ImageList"
import { toast } from "@/components/ui/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"
import Image from "next/image"

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
  scenes: DMImage[]
  onSaveScene: () => void
  onLoadScene: (scene: DMImage) => void
  onDeleteSceneData: (image: DMImage) => Promise<void>
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
  scenes,
  onSaveScene,
  onLoadScene,
  onDeleteSceneData,
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
    <div className="w-80 bg-white border-l flex flex-col">
      <div className="p-4 border-b">
        <Tabs defaultValue="chat" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="characters">Characters</TabsTrigger>
            <TabsTrigger value="maps">Maps</TabsTrigger>
          </TabsList>
          <TabsContent value="chat">
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
          </TabsContent>
          <TabsContent value="characters">
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
          </TabsContent>
          <TabsContent value="maps">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Background Images</h3>
                <div className="space-x-2">
                  <Button onClick={onSaveScene} size="sm">
                    Save Scene
                  </Button>
                  <Button onClick={() => onAddImage("Scene", new File([], ""))} size="sm">
                    Upload
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-[calc(100vh-12rem)]">
                <ul className="space-y-2">
                  {images
                    .filter((img) => img.Category === "Scene")
                    .map((image) => (
                      <li
                        key={image.Id}
                        className="flex items-center justify-between p-2 bg-white rounded-lg shadow cursor-pointer hover:bg-gray-50"
                        onClick={() => onSetBackground(image.Link)}
                      >
                        <div className="flex items-center space-x-2">
                          <Image
                            src={image.Link}
                            alt={image.Name}
                            width={40}
                            height={40}
                            objectFit="cover"
                          />
                          <span>{image.Name}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          {image.SceneData && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteSceneData(image);
                              }}
                              className="text-blue-500 hover:text-blue-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteImage(image);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                </ul>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </div>
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