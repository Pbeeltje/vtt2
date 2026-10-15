"use client"

import { useCallback, useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/use-toast"
import LoginForm from "./LoginForm"
import RegisterForm from "./RegisterForm"
import MainContent from "./MainContent"
import RightSideMenu from "./RightSideMenu"
import MiniChat from "./MiniChat"
import BottomBar from "./BottomBar"
import ErrorBoundary from "./ErrorBoundary"
import CharacterPopup from "./character-popup/CharacterPopup"
import { HostTunnelShare } from "./HostTunnelShare"
import NotesPanel from "./NotesPanel"
import { api } from "../lib/api"
import type { User } from "../types/user"
import type { Character } from "../types/character"
import type { DMImage } from "../types/image"
import type { MapInteractionTool } from "../types/mapTool"
import { useSocket, useSocketEvent } from "../hooks/useSocket"
import { useSceneState } from "../hooks/useSceneState"
import { useChat } from "../hooks/useChat"
import { useCharacters } from "../hooks/useCharacters"
import { useDmLibrary } from "../hooks/useDmLibrary"
import { useDrawings } from "../hooks/useDrawings"

const RIGHT_SIDEBAR_MODE_KEY = "vtt-right-sidebar-mode"

async function fetchSessionUser(): Promise<User | null> {
  try {
    return await api<User>("/api/user")
  } catch {
    return null
  }
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [chatBackgroundColor, setChatBackgroundColor] = useState("bg-white")
  const [currentTool, setCurrentTool] = useState<MapInteractionTool>("cursor")
  const [fogBrushDiameter, setFogBrushDiameter] = useState(50)
  const [currentColor, setCurrentColor] = useState("#000000")
  const [zoomLevel, setZoomLevel] = useState(1)
  const [activeRightMenuTab, setActiveRightMenuTab] = useState("chat")
  const [showFullRightSidebar, setShowFullRightSidebar] = useState(true)

  const { socket, connected } = useSocket(user?.id ?? null)
  const scenes = useSceneState(user, socket, connected)
  const { scene, selectedScene } = scenes
  const topLayer = scene.elements.topLayer
  const findToken = useCallback((characterName: string) => topLayer.find((t) => t.character?.Name === characterName), [topLayer])
  const chat = useChat(socket, findToken, scene.gridSize)
  const characters = useCharacters(user, socket)
  const library = useDmLibrary()
  const drawings = useDrawings(selectedScene?.Id ?? null, socket)

  // The ticker (BottomBar) listens for this window event.
  useSocketEvent<[unknown]>(socket, "notes_updated", (notes) => window.dispatchEvent(new CustomEvent("notes_updated", { detail: notes })))

  useEffect(() => {
    try {
      const mode = localStorage.getItem(RIGHT_SIDEBAR_MODE_KEY)
      if (mode === "compact") setShowFullRightSidebar(false)
    } catch {
      /* storage unavailable */
    }
  }, [])

  const setRightSidebarMode = useCallback((full: boolean) => {
    setShowFullRightSidebar(full)
    try {
      localStorage.setItem(RIGHT_SIDEBAR_MODE_KEY, full ? "full" : "compact")
    } catch {
      /* storage unavailable */
    }
  }, [])

  const { loadCharacters } = characters
  const { loadLatest } = chat
  const { initializeScenes } = scenes
  const { loadImages, loadUsers } = library

  const loadEverything = useCallback(
    async (loggedIn: User) => {
      setUser(loggedIn)
      await Promise.all([
        loadCharacters(),
        loadLatest(),
        initializeScenes(loggedIn),
        ...(loggedIn.role === "DM" ? [loadImages(), loadUsers()] : []),
      ])
    },
    [loadCharacters, loadLatest, initializeScenes, loadImages, loadUsers]
  )

  useEffect(() => {
    void (async () => {
      const sessionUser = await fetchSessionUser()
      if (sessionUser) await loadEverything(sessionUser)
      setIsLoading(false)
    })()
    // Only on first load; logging in later goes through handleLogin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // After a reconnect, catch up on chat and characters missed while offline (scenes do this themselves).
  useEffect(() => {
    if (connected && user) {
      void loadLatest()
      void loadCharacters()
    }
  }, [connected, user, loadLatest, loadCharacters])

  const handleLogin = useCallback(async () => {
    setIsLoading(true)
    try {
      const sessionUser = await fetchSessionUser()
      if (sessionUser) {
        await loadEverything(sessionUser)
        toast({ title: "Logged in", description: `Welcome back, ${sessionUser.username}!` })
      } else {
        toast({ title: "Login error", description: "Could not load your account after logging in.", variant: "destructive" })
      }
    } finally {
      setIsLoading(false)
    }
  }, [loadEverything])

  const { resetScenes } = scenes
  const { reset: resetCharacters } = characters
  const { reset: resetChat } = chat
  const { reset: resetLibrary } = library
  const handleLogout = useCallback(async () => {
    try {
      await api("/api/logout", { method: "POST" })
    } catch {
      toast({ title: "Logout failed", description: "Please try again.", variant: "destructive" })
      return
    }
    setUser(null)
    resetCharacters()
    resetChat()
    resetLibrary()
    resetScenes()
    toast({ title: "Logged out" })
  }, [resetCharacters, resetChat, resetLibrary, resetScenes])

  // Stable callbacks for the memoised sidebar and chat, so map drags don't re-render them.
  const { sendMessage, loadOlder, roll } = chat
  const { addCharacter, deleteCharacter, openSheet, updateCharacter } = characters
  const { uploadImage, deleteImage, renameImage } = library
  const { loadSceneById, makeSceneActive, updateSceneSettings, clearSceneData } = scenes
  const { reloadDrawings } = drawings

  const handleRoll = useCallback((expression: string) => void roll(expression), [roll])
  const handlePhaseChange = useCallback((_phase: string, color: string) => setChatBackgroundColor(color), [])
  const handleLoadScene = useCallback((row: DMImage) => void loadSceneById(row.Id), [loadSceneById])
  const handleClearSceneData = useCallback((image: DMImage) => clearSceneData(image.Id), [clearSceneData])
  const handleUpdateSceneSettings = useCallback(
    async (image: DMImage, settings: { scale: number; borderSize: number }) => {
      const ok = await updateSceneSettings(image.Id, settings)
      if (ok && image.Id === selectedScene?.Id) void reloadDrawings()
      return ok
    },
    [updateSceneSettings, selectedScene?.Id, reloadDrawings]
  )
  const handleUpdateCharacter = useCallback(
    (characterId: number, changes: Partial<Character>) => void updateCharacter(characterId, changes),
    [updateCharacter]
  )
  const handleOpenCompact = useCallback(() => setRightSidebarMode(false), [setRightSidebarMode])
  const handleOpenFull = useCallback(() => setRightSidebarMode(true), [setRightSidebarMode])
  const handleRefetchUsers = useCallback(() => loadUsers(), [loadUsers])
  const handleRefetchCharacters = useCallback(() => loadCharacters(), [loadCharacters])

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-stone-200">
        <div className="bg-white/90 backdrop-blur p-8 rounded-lg shadow-md w-full max-w-md">
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
            <TabsContent value="login"><LoginForm onLogin={handleLogin} /></TabsContent>
            <TabsContent value="register"><RegisterForm onRegister={handleLogin} /></TabsContent>
          </Tabs>
        </div>
      </div>
    )
  }

  const isDM = user.role === "DM"
  const sheet = characters.sheetCharacter

  return (
    <ErrorBoundary>
      <HostTunnelShare visible={isDM} />
      <NotesPanel userId={user.id} />
      <div className="flex flex-col h-screen">
        <div className="flex flex-grow overflow-hidden">
          <div className="flex-grow overflow-hidden">
            <MainContent
              backgroundImage={selectedScene?.Link ?? null}
              scene={scene}
              onUpdateScene={scenes.updateScene}
              currentTool={currentTool}
              onToolChange={setCurrentTool}
              fogBrushDiameter={fogBrushDiameter}
              onFogBrushDiameterChange={setFogBrushDiameter}
              currentColor={currentColor}
              onColorChange={setCurrentColor}
              zoomLevel={zoomLevel}
              setZoomLevel={setZoomLevel}
              currentSceneId={selectedScene?.Id ?? null}
              currentUserId={user.id}
              currentUserRole={user.role}
              drawings={drawings.drawings}
              onDrawingAdd={drawings.addDrawing}
              onDrawingsDelete={drawings.deleteDrawings}
              onPlayerPlaceToken={scenes.playerPlaceToken}
              onPlayerMoveToken={scenes.playerMoveToken}
              onPlayerDeleteToken={scenes.playerDeleteToken}
              onOpenCharacterSheet={openSheet}
              onUpdateCharacter={handleUpdateCharacter}
              onUploadImage={uploadImage}
              textBalloons={chat.textBalloons}
              onCloseTextBalloon={chat.closeBalloon}
            />
          </div>
          {showFullRightSidebar ? (
            <RightSideMenu
              user={user}
              messages={chat.messages}
              hasMoreMessages={chat.hasMore}
              onLoadOlderMessages={loadOlder}
              onSendMessage={sendMessage}
              chatBackgroundColor={chatBackgroundColor}
              characters={characters.characters}
              onAddCharacter={addCharacter}
              onOpenCharacter={openSheet}
              onDeleteCharacter={deleteCharacter}
              onLogout={handleLogout}
              images={library.images}
              scenes={scenes.scenes}
              onRefreshImages={loadImages}
              onUploadImage={uploadImage}
              onDeleteImage={deleteImage}
              onRenameImage={renameImage}
              onLoadScene={handleLoadScene}
              onClearSceneData={handleClearSceneData}
              onUpdateSceneSettings={handleUpdateSceneSettings}
              onMakeSceneActive={makeSceneActive}
              activeSceneId={scenes.activeSceneId}
              activeTab={activeRightMenuTab}
              setActiveTab={setActiveRightMenuTab}
              allUsers={library.allUsers}
              onRequestCompactChat={handleOpenCompact}
              onRefetchUsers={handleRefetchUsers}
              onRefetchCharacters={handleRefetchCharacters}
            />
          ) : (
            <MiniChat
              messages={chat.messages}
              hasMoreMessages={chat.hasMore}
              onLoadOlderMessages={loadOlder}
              onSendMessage={sendMessage}
              user={user}
              chatBackgroundColor={chatBackgroundColor}
              characters={characters.characters}
              onRequestFullSidebar={handleOpenFull}
            />
          )}
        </div>
        <BottomBar onRoll={handleRoll} onPhaseChange={handlePhaseChange} userRole={user.role} />
      </div>
      {sheet && (
        <CharacterPopup
          key={sheet.CharacterId}
          character={sheet}
          onClose={characters.closeSheet}
          onSave={(changes) => updateCharacter(sheet.CharacterId, changes)}
          isDM={isDM}
          allUsers={isDM ? library.allUsers : undefined}
        />
      )}
    </ErrorBoundary>
  )
}
