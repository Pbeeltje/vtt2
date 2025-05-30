"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { MessageSquare, Users, Map, Settings, LogOut, Trash2, Save, Upload } from "lucide-react"
import CharacterList from "./CharacterList"
import ImageList from "./ImageList"
import { toast } from "@/components/ui/use-toast"
// import MapList from "./MapList"

interface ChatMessage {
  MessageId?: number;
  type: string;
  content: string;
  timestamp: string;
  username: string;
  senderType?: 'user' | 'character';
  senderRole?: string;
  UserId?: number;
}

import { Character } from "../types/character"
import { DMImage } from "../types/image"
import type { User } from "../types/user"; // Import User type

interface RightSideMenuProps {
  messages: ChatMessage[]
  addMessage: (type: string, content: string, speakerName: string, senderType: 'user' | 'character') => void
  user: User
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
  scenes: DMImage[]
  onLoadScene: (scene: DMImage) => void
  onDropImage: (category: string, image: DMImage, x: number, y: number) => void
  onDeleteSceneData: (image: DMImage) => Promise<void>
  onUpdateSceneScale?: (image: DMImage, scale: number) => Promise<void>
  setImages: (images: DMImage[]) => void
  onClearSceneElements?: () => void;
  onMakeSceneActive?: (sceneId: number) => void;
  activeTab?: string;
  setActiveTab?: (tabName: string) => void;
  allUsers?: User[]; // Add allUsers prop
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
  scenes,
  onLoadScene,
  onDropImage,
  onDeleteSceneData,
  onUpdateSceneScale,
  setImages,
  onClearSceneElements,
  onMakeSceneActive,
  activeTab,
  setActiveTab,
  allUsers, // Destructure allUsers
}: RightSideMenuProps) {
  const [inputMessage, setInputMessage] = useState("")
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const [selectedSpeaker, setSelectedSpeaker] = useState<{ name: string; type: 'user' | 'character' }>({ name: user.username, type: 'user' });

  // Log characters whenever RightSideMenu re-renders
  // console.log("[RightSideMenu.tsx] Characters state:", characters);
  // console.log("[RightSideMenu.tsx] Current user role:", user?.role);

  useEffect(() => {
    if (user?.role !== 'DM' && activeTab === 'maps' && setActiveTab) {
      setActiveTab('chat');
    }
  }, [user?.role, activeTab, setActiveTab]);

  useEffect(() => {
    setSelectedSpeaker({ name: user.username, type: 'user' });
  }, [user.username]);

  useEffect(() => {
    if (activeTab === "maps" && user?.role === 'DM') {
      const refreshImages = async () => {
        try {
          const response = await fetch("/api/images", { credentials: "include" });
          if (response.ok) {
            const updatedImages = await response.json();
            setImages(updatedImages);
          }
        } catch (error) {
          console.error("Error refreshing images:", error);
        }
      };
      refreshImages();
    }
  }, [activeTab, user?.role, setImages]);

  const handleSendMessage = () => {
    if (inputMessage.trim()) {
      addMessage("user", inputMessage, selectedSpeaker.name, selectedSpeaker.type)
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

  const filteredCharsForDropdown = characters.filter(char => char.userId === user.id);
  // console.log(`[RightSideMenu.tsx] Filtered characters for dropdown (user ID: ${user.id}):`, filteredCharsForDropdown);

  return (
    <div className="w-[40rem] flex-shrink-0 bg-white border-l flex flex-col" style={{ backgroundImage: 'url("images/rightsidemenu.jpeg")', backgroundSize: '100% auto', backgroundRepeat: 'repeat-y' }}>
      <div className="p-4 border-b w-full">
        <Tabs 
          value={activeTab || 'chat'} 
          onValueChange={(value) => setActiveTab ? setActiveTab(value) : null} 
          className="w-full"
        >
          <TabsList className={`grid w-full ${user?.role === 'DM' ? 'grid-cols-3' : 'grid-cols-2'} bg-stone-300`}>
            <TabsTrigger value="chat" title="Chat"><MessageSquare className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Chat</span></TabsTrigger>
            <TabsTrigger value="characters" title="Characters"><Users className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Characters</span></TabsTrigger>
            {user?.role === 'DM' && (
              <TabsTrigger value="maps" title="Maps"><Map className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Maps</span></TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="chat" className="w-full">
            <div className="flex flex-col h-[calc(100vh-8rem)] w-full">
              <h2 className="text-lg text-white font-semibold p-4 pb-2">Chat</h2>
              <div ref={chatContainerRef} className={`flex-grow px-4 ${chatBackgroundColor} overflow-y-auto rounded bg-opacity-80`}>
                <div className="space-y-2 pb-4">
                  {messages.map((message, index) => {
                    const messageDate = new Date(message.timestamp);
                    let formattedTime = "Time N/A";
                    let currentDateString = "Date N/A";

                    if (!isNaN(messageDate.getTime())) {
                      formattedTime = messageDate.toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      currentDateString = messageDate.toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      });
                    }

                    const prevMessage = index > 0 ? messages[index - 1] : null;
                    let prevDateString = null;
                    if (prevMessage) {
                      const prevMessageDate = new Date(prevMessage.timestamp);
                      if (!isNaN(prevMessageDate.getTime())) {
                        prevDateString = prevMessageDate.toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        });
                      }
                    }
                    
                    // Show date separator if the current date is valid and different from the previous valid date.
                    const showDateSeparator = currentDateString !== "Date N/A" && (!prevDateString || currentDateString !== prevDateString);

                    // Use MessageId for the key if available, otherwise fall back to index.
                    // Ensure ChatMessage interface in this file and Home.tsx includes MessageId.
                    const key = message.MessageId !== undefined ? message.MessageId : `msg-${index}-${message.timestamp}`;

                    let usernameColor = 'black'; // Default for player, non-character messages
                    if (message.type === 'system') {
                      usernameColor = 'blue';
                    } else if (message.senderType === 'character') {
                      usernameColor = 'darkgreen';
                    } else if (message.senderRole === 'DM') { // Check if the sender was a DM
                      usernameColor = 'red';
                    } // Else, it remains 'black' for non-DM users sending as themselves

                    return (
                      <div key={key}>
                        {showDateSeparator && (
                          <div className="text-center text-sm text-gray-500 my-2 pt-2">
                            {currentDateString}
                          </div>
                        )}
                        <div className="text-sm flex">
                          <span className="text-xs text-gray-400 mr-2 self-center min-w-[40px]">{formattedTime}</span>
                          <div className="flex-grow">
                            {message.type === "user" || message.type === "diceRoll" ? (
                              <span style={{ color: usernameColor, fontWeight: '600' }}>{message.username}:</span>
                            ) : message.type === "system" ? (
                              <span style={{ color: usernameColor, fontWeight: '600' }}>System:</span>
                            ) : (
                              <span style={{ color: usernameColor, fontWeight: '600' }}>{message.username || 'Unknown'}:</span> // Fallback for other types
                            )}{" "}
                            <span dangerouslySetInnerHTML={{ __html: message.content }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="p-2 border-t">
                <div className="flex items-center h-10">
                  <select 
                    value={`${selectedSpeaker.type}-${selectedSpeaker.name}`}
                    onChange={(e) => {
                      const [type, name] = e.target.value.split('-');
                      setSelectedSpeaker({ name, type: type as 'user' | 'character' });
                    }}
                    className="mr-2 p-2 h-full border rounded-md bg-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="Speak as"
                  >
                    <option value={`user-${user.username}`}>{user.username} (You)</option>
                    {filteredCharsForDropdown.map(char => (
                        <option key={char.CharacterId} value={`character-${char.Name}`}>{char.Name} (Character)</option>
                    ))}
                  </select>
                  <Input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder="Type a message..."
                    className="flex-grow mr-2 bg-yellow-20 bg-stone-200"
                  />
                  <Button onClick={handleSendMessage}>Send</Button>
                </div>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="characters" className="w-full">
            <div className="p-4 w-full">
              <h2 className="text-lg text-white font-semibold mb-4">Characters</h2>
              {user.role === 'DM' ? (
                <CharacterList
                  characters={characters}
                  onAddCharacter={onAddCharacter}
                  onUpdateCharacter={onUpdateCharacter}
                  onDeleteCharacter={onDeleteCharacter}
                  currentUser={user.id}
                  isDM={true}
                  allUsers={allUsers} // Pass allUsers to CharacterList for DMs
                />
              ) : (
                <CharacterList
                  characters={characters.filter(char => char.userId === user.id)}
                  onAddCharacter={onAddCharacter}
                  onUpdateCharacter={onUpdateCharacter}
                  onDeleteCharacter={onDeleteCharacter}
                  currentUser={user.id}
                  isDM={false}
                  // allUsers is not passed for non-DMs, CharacterListProps.allUsers should be optional
                />
              )}
            </div>
          </TabsContent>
          {user?.role === 'DM' && (
            <TabsContent value="maps" className="w-full">
              <div className="p-4 w-full">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg text-white font-semibold">Images & Scenes</h3>
                  <div className="space-x-2">
                    {onClearSceneElements && (
                      <Button
                        variant="destructive"
                        onClick={onClearSceneElements}
                        title="Clear All Tokens & Images from Scene"
                      >
                        Clear Scene Items
                      </Button>
                    )}
                  </div>
                </div>
                <ImageList
                  images={images}
                  categories={["Scene", "Image", "Props"]}
                  onAddImage={onAddImage}
                  onDeleteImage={onDeleteImage}
                  onRenameImage={onRenameImage}
                  onDragStart={handleDragStart}
                  onSceneClick={onLoadScene}
                  onDeleteSceneData={onDeleteSceneData}
                  onUpdateSceneScale={onUpdateSceneScale}
                  characters={characters}
                  currentUserRole={user?.role}
                  onDropImage={onDropImage}
                  onMakeSceneActive={onMakeSceneActive}
                />
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}
