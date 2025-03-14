"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { MessageSquare, Users, Map, Settings, LogOut, Trash2, Save, Upload } from "lucide-react"
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
  user: {
    id: number;
    username: string;
    role: string;
  }
  chatBackgroundColor: string
  characters: Character[]
  onAddCharacter: (category: string) => void
  onUpdateCharacter: (updatedCharacter: Character) => void
  onDeleteCharacter: (character: Character) => void
  onLogout: () => void
  images: DMImage[]
  onAddImage: (category: string, file: File) => Promise<void>
  onDeleteImage: (image: DMImage) => Promise<void>
  onRenameImage: (image: DMImage, newName: string) => Promise<void>
  onSetBackground: (url: string) => void
  onDropImage: (category: string, image: DMImage, x: number, y: number) => void
  scenes: DMImage[]
  onSaveScene: () => void
  onLoadScene: (scene: DMImage) => void
  onDeleteSceneData: (image: DMImage) => Promise<void>
  onUpdateSceneScale?: (image: DMImage, scale: number) => Promise<void>
  setImages: (images: DMImage[]) => void
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
  onRenameImage,
  onSetBackground,
  onSaveScene,
  onDeleteSceneData,
  onUpdateSceneScale,
  setImages,
}: RightSideMenuProps) {
  const [inputMessage, setInputMessage] = useState("")
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const [activeSection, setActiveSection] = useState<"chat" | "characters" | "maps">("chat")

  // Add effect to refresh images when switching to maps tab
  useEffect(() => {
    if (activeSection === "maps") {
      // Simple direct refresh of images when switching to maps tab
      const refreshImages = async () => {
        try {
          const response = await fetch("/api/images", { credentials: "include" });
          if (response.ok) {
            const updatedImages = await response.json();
            // Directly update the images state in the parent component
            setImages(updatedImages);
            console.log("Images refreshed when switching to maps tab");
          }
        } catch (error) {
          console.error("Error refreshing images:", error);
        }
      };
      refreshImages();
    }
  }, [activeSection, setImages]);

  const handleSendMessage = () => {
    if (inputMessage.trim()) {
      addMessage("user", inputMessage, user.username)
      setInputMessage("")
    }
  }

  const handleDragStart = (e: React.DragEvent<HTMLLIElement>, image: DMImage) => {
    e.dataTransfer.setData("imageId", image.Id.toString())
    e.dataTransfer.setData("category", image.Category)
    e.dataTransfer.setData("url", image.Link)
    if (image.CharacterId) {
      e.dataTransfer.setData("characterId", image.CharacterId.toString())
      e.dataTransfer.setData("character", JSON.stringify(image))
    }
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
    <div className="w-96 bg-white border-l flex flex-col" style={{ backgroundImage: 'url("images/rightsidemenu.jpeg")', backgroundSize: '100% auto', backgroundRepeat: 'repeat-y' }}>
      <div className="p-4 border-b w-full">
        <Tabs value={activeSection} onValueChange={(value) => setActiveSection(value as "chat" | "characters" | "maps")} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="chat">
              <MessageSquare className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="characters">
              <Users className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="maps">
              <Map className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>
          <TabsContent value="chat" className="w-full">
            <div className="flex flex-col h-[calc(100vh-8rem)] w-full">
              <h2 className="text-lg text-white font-semibold p-4 pb-2">Chat</h2>
              <div ref={chatContainerRef} className={`flex-grow px-4 ${chatBackgroundColor} overflow-y-auto`}>
                <div className="space-y-2 pb-4">
                  {messages.map((message, index) => {
                    const currentDate = new Date(message.timestamp).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric"
                    });
                    const prevMessage = index > 0 ? messages[index - 1] : null;
                    const prevDate = prevMessage ? new Date(prevMessage.timestamp).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric"
                    }) : null;
                    const showDateSeparator = prevDate && currentDate !== prevDate;

                    return (
                      <div key={index}>
                        {showDateSeparator && (
                          <div className="text-center text-sm text-gray-500 my-2">
                            {currentDate}
                          </div>
                        )}
                        <div className="text-sm">
                          {message.type === "user" ? (
                            <span className="font-semibold">{message.username}:</span>
                          ) : (
                            <span className="font-semibold text-green-600">System:</span>
                          )}{" "}
                          <span dangerouslySetInnerHTML={{ __html: message.content }} />
                        </div>
                      </div>
                    );
                  })}
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
            </div>
          </TabsContent>
          <TabsContent value="characters" className="w-full">
            <div className="p-4 w-full">
              <h2 className="text-lg text-white font-semibold mb-4">Characters</h2>
              <CharacterList
                categories={["Party", "NPC", "Monster"]}
                characters={characters}
                onAddCharacter={onAddCharacter}
                onUpdateCharacter={onUpdateCharacter}
                onDeleteCharacter={onDeleteCharacter}
                currentUser={user.id}
                isDM={user.role === "DM"}
              />
            </div>
          </TabsContent>
          <TabsContent value="maps" className="w-full">
            <div className="p-4 w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg text-white font-semibold">Scenes and Images</h3>
                <div className="space-x-2">
                  <Button onClick={onSaveScene} size="sm" variant="ghost" title="Save Scene">
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button onClick={() => onAddImage("Scene", new File([], ""))} size="sm">
                    Upload
                  </Button>
                </div>
              </div>
              <div className="mt-4">
                <ImageList
                  images={images}
                  categories={["Scene", "Image", "Token"]}
                  onAddImage={onAddImage}
                  onDeleteImage={onDeleteImage}
                  onDragStart={handleDragStart}
                  onSceneClick={onSetBackground}
                  onDeleteSceneData={onDeleteSceneData}
                  onRenameImage={onRenameImage}
                  onUpdateSceneScale={onUpdateSceneScale}
                  characters={characters}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
