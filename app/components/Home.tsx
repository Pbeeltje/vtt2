"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BriefcaseBusiness, NotebookPen } from "lucide-react"
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
import JobsPanel from "./hud/JobsPanel"
import type { RoundMenuItem } from "./hud/RoundMenu"
import { api } from "../lib/api"
import { nextPhase, type PhaseName } from "../lib/phases"
import type { TestAttribute } from "@/lib/dice"
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
import { usePresence } from "../hooks/usePresence"
import { usePings } from "../hooks/usePings"
import { confirm } from "@/components/ui/confirm-dialog"

const RIGHT_SIDEBAR_MODE_KEY = "vtt-right-sidebar-mode"

/** The Tests on the round menu, in sheet order. */
const WHEEL_TESTS: Array<{ attribute: TestAttribute; short: string; name: string }> = [
  { attribute: "Strength", short: "STR", name: "Strength" },
  { attribute: "Dexternity", short: "DEX", name: "Dexterity" },
  { attribute: "Mind", short: "MND", name: "Mind" },
  { attribute: "Charisma", short: "CHA", name: "Charisma" },
]

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
  const [authTab, setAuthTab] = useState<"login" | "register">("login")
  // PQAR phase of the current encounter (null: no encounter). Local to this browser, as before.
  const [phase, setPhase] = useState<PhaseName | null>(null)
  const [notesOpen, setNotesOpen] = useState(false)
  const [shareRequest, setShareRequest] = useState(0)
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null)
  const [jobsCharacterId, setJobsCharacterId] = useState<number | null>(null)
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
  const online = usePresence(socket)
  const { pings, ping } = usePings(socket, selectedScene?.Id ?? null, user)

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
      // Your player colour is your pen until you pick another.
      if (loggedIn.color) setCurrentColor(loggedIn.color)
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
    if (!(await confirm({ title: user ? `Log out ${user.username}?` : "Log out?", description: "You can log back in at any time.", confirmLabel: "Log out" }))) return
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
  }, [user, resetCharacters, resetChat, resetLibrary, resetScenes])

  // Stable callbacks for the memoised panels and chat, so map drags don't re-render them.
  const { sendMessage, loadOlder, roll, rollTest } = chat
  const { addCharacter, deleteCharacter, openSheet, updateCharacter } = characters
  const { uploadImage, deleteImage, renameImage } = library
  const { loadSceneById, makeSceneActive, updateSceneSettings, clearSceneData } = scenes
  const { reloadDrawings } = drawings

  const handleRoll = useCallback((expression: string) => void roll(expression), [roll])
  const handleNextPhase = useCallback(() => setPhase((current) => nextPhase(current)), [])
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
  const handleOpenProfile = useCallback(() => {
    setActiveRightMenuTab("players")
    setRightSidebarMode(true)
  }, [setRightSidebarMode])
  const playerColor = user?.color
  const handleProfileChange = useCallback(
    (changes: Pick<User, "color" | "avatarUrl">) => {
      const next = changes.color
      // A pen still on the old player colour follows the new one.
      if (playerColor && next && next !== playerColor) {
        setCurrentColor((pen) => (pen.toLowerCase() === playerColor.toLowerCase() ? next : pen))
      }
      setUser((prev) => (prev ? { ...prev, ...changes } : prev))
    },
    [playerColor]
  )
  const selectedSceneId = selectedScene?.Id ?? null
  const handleMakeSceneLive = useCallback(() => {
    if (selectedSceneId !== null) makeSceneActive(selectedSceneId)
  }, [selectedSceneId, makeSceneActive])

  const isDM = user?.role === "DM"
  const handleShare = useCallback(() => setShareRequest((n) => n + 1), [])
  const handleCloseJobs = useCallback(() => setJobsCharacterId(null), [])

  // The wheel acts for your only character; with several (or none, as DM), for the selected token's.
  const userId = user?.id
  const wheelCharacter = useMemo(() => {
    const owned = characters.characters.filter((c) => c.userId === userId)
    if (owned.length === 1) return owned[0]
    return characters.characters.find((c) => c.CharacterId === selectedCharacterId) ?? null
  }, [characters.characters, userId, selectedCharacterId])

  const menuItems = useMemo<RoundMenuItem[]>(() => {
    const c = wheelCharacter
    const pickFirst = "Select your character's token on the map first"
    const tests = WHEEL_TESTS.map(({ attribute, short, name }): RoundMenuItem => {
      const score = c?.[attribute]
      const hasScore = typeof score === "number"
      return {
        key: attribute,
        label: !c ? pickFirst : hasScore ? `${name} test for ${c.Name} (d20 under ${score})` : `${c.Name} has no ${name} score yet`,
        text: short,
        value: hasScore ? score : undefined,
        disabled: !c || !hasScore,
        onClick: () => c && void rollTest(c.CharacterId, attribute),
      }
    })
    return [
      ...tests,
      {
        key: "jobs",
        label: c ? `${c.Name}'s jobs` : pickFirst,
        icon: BriefcaseBusiness,
        disabled: !c,
        active: jobsCharacterId !== null,
        onClick: () => {
          if (!c) return
          setNotesOpen(false)
          setJobsCharacterId((open) => (open === c.CharacterId ? null : c.CharacterId))
        },
      },
      {
        key: "notes",
        label: notesOpen ? "Close the journal" : "Journal",
        icon: NotebookPen,
        active: notesOpen,
        onClick: () => {
          setJobsCharacterId(null)
          setNotesOpen((open) => !open)
        },
      },
    ]
  }, [wheelCharacter, notesOpen, jobsCharacterId, rollTest])

  if (isLoading) {
    return (
      <div className="jade jade-marble flex min-h-screen items-center justify-center">
        <span className="jade-title text-xl">Loading…</span>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="jade jade-marble flex min-h-screen items-center justify-center p-4">
        <div className="relative w-full max-w-md">
          <i className="jade-knot absolute -top-2 left-4 right-4 h-4" aria-hidden />
          <div className="jade-well p-8 pt-7">
            <p className="jade-sc mb-1 text-center text-xs font-semibold text-[var(--jade-muted)]">VIRTUAL TABLETOP</p>
            <h1 className="jade-title mb-6 text-center text-[32px] leading-none">The Job System</h1>
            <div className="mb-6 grid grid-cols-2 gap-1.5" role="tablist">
              {(["login", "register"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={authTab === tab}
                  data-active={authTab === tab}
                  onClick={() => setAuthTab(tab)}
                  className="jade-tab h-8 text-sm"
                >
                  {tab === "login" ? "Log in" : "Register"}
                </button>
              ))}
            </div>
            {authTab === "login" ? <LoginForm onLogin={handleLogin} /> : <RegisterForm onRegister={handleLogin} />}
          </div>
          <i className="jade-knot jade-knot-under absolute -bottom-2 left-4 right-4 h-4" aria-hidden />
        </div>
      </div>
    )
  }

  const sheet = characters.sheetCharacter
  const jobsCharacter = characters.characters.find((c) => c.CharacterId === jobsCharacterId) ?? null

  return (
    <ErrorBoundary>
      <HostTunnelShare visible={isDM} openRequest={shareRequest} />
      <NotesPanel userId={user.id} open={notesOpen} onOpenChange={setNotesOpen} />
      {jobsCharacter && <JobsPanel key={jobsCharacter.CharacterId} character={jobsCharacter} onClose={handleCloseJobs} />}
      <div className="flex h-screen flex-col overflow-hidden bg-[#050403]">
        <div className="relative min-h-0 flex-1">
          <div className="absolute inset-0">
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
              pings={pings}
              onPing={ping}
              onSelectedCharacterChange={setSelectedCharacterId}
            />
          </div>
          {showFullRightSidebar ? (
            <RightSideMenu
              user={user}
              messages={chat.messages}
              hasMoreMessages={chat.hasMore}
              onLoadOlderMessages={loadOlder}
              onSendMessage={sendMessage}
              onRoll={handleRoll}
              phase={phase}
              characters={characters.characters}
              onAddCharacter={addCharacter}
              onOpenCharacter={openSheet}
              onDeleteCharacter={deleteCharacter}
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
              onProfileChange={handleProfileChange}
              onLogout={handleLogout}
              onShare={handleShare}
            />
          ) : (
            <MiniChat
              messages={chat.messages}
              hasMoreMessages={chat.hasMore}
              onLoadOlderMessages={loadOlder}
              onSendMessage={sendMessage}
              onRoll={handleRoll}
              user={user}
              characters={characters.characters}
              onRequestFullSidebar={handleOpenFull}
            />
          )}
        </div>
        <BottomBar
          user={user}
          online={online}
          onOpenProfile={handleOpenProfile}
          sceneName={selectedScene?.Name ?? null}
          tokenCount={topLayer.length}
          isSceneLive={selectedSceneId !== null && scenes.activeSceneId === selectedSceneId}
          onMakeSceneLive={handleMakeSceneLive}
          phase={phase}
          onSetPhase={setPhase}
          onNextPhase={handleNextPhase}
          menuItems={menuItems}
        />
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
