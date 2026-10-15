"use client"

import { memo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { MessageSquare, Users, Map, PanelRightClose, UserCog, LogOut } from "lucide-react"
import CharacterList from "./CharacterList"
import ImageList from "./ImageList"
import DmPlayerAccounts from "./DmPlayerAccounts"
import ChatLog from "./chat/ChatLog"
import ChatComposer from "./chat/ChatComposer"
import type { ChatMessage } from "@/lib/chat-message"
import type { Speaker } from "../hooks/useChat"
import type { Character } from "../types/character"
import type { DMImage } from "../types/image"
import type { User } from "../types/user"

interface RightSideMenuProps {
  user: User
  messages: ChatMessage[]
  hasMoreMessages: boolean
  onLoadOlderMessages: () => void
  onSendMessage: (content: string, speaker: Speaker) => void
  chatBackgroundColor: string
  characters: Character[]
  onAddCharacter: (category: string) => void
  onOpenCharacter: (character: Character) => void
  onDeleteCharacter: (character: Character) => void
  onLogout: () => void
  images: DMImage[]
  /** The scene list from the scene state (fresher SceneData than the image list). */
  scenes: DMImage[]
  onRefreshImages: () => void
  onUploadImage: (category: string, file: File) => Promise<unknown>
  onDeleteImage: (image: DMImage) => Promise<void>
  onRenameImage: (image: DMImage, newName: string) => Promise<void>
  onLoadScene: (scene: DMImage) => void
  onClearSceneData: (image: DMImage) => Promise<void>
  onUpdateSceneSettings: (image: DMImage, settings: { scale: number; borderSize: number }) => Promise<boolean>
  onMakeSceneActive: (sceneId: number) => void
  activeSceneId: number | null
  activeTab: string
  setActiveTab: (tabName: string) => void
  allUsers: User[]
  onRequestCompactChat: () => void
  onRefetchUsers: () => Promise<void>
  onRefetchCharacters: () => Promise<void>
}

function RightSideMenu({
  user,
  messages,
  hasMoreMessages,
  onLoadOlderMessages,
  onSendMessage,
  chatBackgroundColor,
  characters,
  onAddCharacter,
  onOpenCharacter,
  onDeleteCharacter,
  onLogout,
  images,
  scenes,
  onRefreshImages,
  onUploadImage,
  onDeleteImage,
  onRenameImage,
  onLoadScene,
  onClearSceneData,
  onUpdateSceneSettings,
  onMakeSceneActive,
  activeSceneId,
  activeTab,
  setActiveTab,
  allUsers,
  onRequestCompactChat,
  onRefetchUsers,
  onRefetchCharacters,
}: RightSideMenuProps) {
  const isDM = user.role === "DM"

  useEffect(() => {
    if (!isDM && (activeTab === "maps" || activeTab === "players")) setActiveTab("chat")
  }, [isDM, activeTab, setActiveTab])

  // Other DMs may have uploaded in the meantime.
  useEffect(() => {
    if (activeTab === "maps" && isDM) onRefreshImages()
  }, [activeTab, isDM, onRefreshImages])

  return (
    <div className="w-[40rem] flex-shrink-0 bg-white border-l flex flex-col" style={{ backgroundImage: 'url("images/rightsidemenu.jpeg")', backgroundSize: '100% auto', backgroundRepeat: 'repeat-y' }}>
      <div className="p-4 border-b w-full">
        <div className="flex items-start gap-2 w-full">
          <div className="flex flex-col gap-1 flex-shrink-0 mt-0.5">
            <Button type="button" variant="outline" size="icon" className="h-9 w-9 bg-stone-200" onClick={onRequestCompactChat} title="Mini chat + full map">
              <PanelRightClose className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="icon" className="h-9 w-9 bg-stone-200" onClick={onLogout} title={`Log out ${user.username}`}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-w-0 w-full">
            <TabsList className={`grid w-full gap-0.5 ${isDM ? "grid-cols-4" : "grid-cols-2"} bg-stone-300`}>
              <TabsTrigger value="chat" title="Chat">
                <MessageSquare className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Chat</span>
              </TabsTrigger>
              <TabsTrigger value="characters" title="Characters">
                <Users className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Characters</span>
              </TabsTrigger>
              {isDM && (
                <>
                  <TabsTrigger value="maps" title="Maps">
                    <Map className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Maps</span>
                  </TabsTrigger>
                  <TabsTrigger value="players" title="Players & passwords">
                    <UserCog className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Players</span>
                  </TabsTrigger>
                </>
              )}
            </TabsList>
            <TabsContent value="chat" className="w-full">
              <div className="flex flex-col h-[calc(100vh-8rem)] w-full">
                <h2 className="text-lg text-white font-semibold p-4 pb-2">Chat</h2>
                <ChatLog
                  messages={messages}
                  hasMore={hasMoreMessages}
                  onLoadOlder={onLoadOlderMessages}
                  className={`flex-grow px-4 ${chatBackgroundColor} rounded bg-opacity-80`}
                />
                <div className="p-2 border-t">
                  <ChatComposer user={user} characters={characters} onSend={onSendMessage} />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="characters" className="w-full">
              <div className="p-4 w-full">
                <h2 className="text-lg text-white font-semibold mb-4">Characters</h2>
                <CharacterList
                  characters={isDM ? characters : characters.filter((c) => c.userId === user.id)}
                  onAddCharacter={onAddCharacter}
                  onOpenCharacter={onOpenCharacter}
                  onDeleteCharacter={onDeleteCharacter}
                  currentUser={user.id}
                  isDM={isDM}
                />
              </div>
            </TabsContent>
            {isDM && (
              <TabsContent value="maps" className="w-full">
                <div className="p-4 w-full">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg text-white font-semibold">Images & Scenes</h3>
                  </div>
                  <ImageList
                    images={images}
                    scenes={scenes}
                    onUploadImage={onUploadImage}
                    onDeleteImage={onDeleteImage}
                    onRenameImage={onRenameImage}
                    onSceneClick={onLoadScene}
                    onClearSceneData={onClearSceneData}
                    onUpdateSceneSettings={onUpdateSceneSettings}
                    onMakeSceneActive={onMakeSceneActive}
                    activeSceneId={activeSceneId}
                  />
                </div>
              </TabsContent>
            )}
            {isDM && (
              <TabsContent value="players" className="w-full">
                <div className="p-4 w-full max-h-[calc(100vh-8rem)] overflow-y-auto">
                  <h2 className="text-lg text-white font-semibold mb-3">Player accounts</h2>
                  <DmPlayerAccounts
                    allUsers={allUsers}
                    characters={characters}
                    currentUser={user}
                    onRefetchUsers={onRefetchUsers}
                    onRefetchCharacters={onRefetchCharacters}
                  />
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </div>
  )
}

export default memo(RightSideMenu)
