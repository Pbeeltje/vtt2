"use client"

import { memo, useEffect } from "react"
import { Globe, LogOut } from "lucide-react"
import CharacterList from "./CharacterList"
import ImageList from "./ImageList"
import DmPlayerAccounts from "./DmPlayerAccounts"
import PlayerProfile from "./PlayerProfile"
import ChatLog from "./chat/ChatLog"
import ChatComposer from "./chat/ChatComposer"
import DiceTray from "./hud/DiceTray"
import { phaseInfo, type PhaseName } from "../lib/phases"
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
  onRoll: (expression: string) => void
  phase: PhaseName | null
  characters: Character[]
  onAddCharacter: (category: string) => void
  onOpenCharacter: (character: Character) => void
  onDeleteCharacter: (character: Character) => void
  images: DMImage[]
  /** The scene list from the scene state (fresher scene summaries than the image list). */
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
  onProfileChange: (changes: Pick<User, "color" | "avatarUrl">) => void
  onLogout: () => void
  /** DM only: open the internet share card. */
  onShare: () => void
}

const TABS = [
  { key: "chat", label: "Chat", dmOnly: false },
  { key: "characters", label: "Characters", dmOnly: false },
  { key: "maps", label: "Scenes", dmOnly: true },
  { key: "players", label: "Players", dmOnly: false },
]

/**
 * The jade side panel over the right of the map: chat with the dice tray, characters, and for
 * everyone their own profile (avatar, colour). The DM also gets scenes and player accounts. It widens for the DM's scene and player lists.
 */
function RightSideMenu({
  user,
  messages,
  hasMoreMessages,
  onLoadOlderMessages,
  onSendMessage,
  onRoll,
  phase,
  characters,
  onAddCharacter,
  onOpenCharacter,
  onDeleteCharacter,
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
  onProfileChange,
  onLogout,
  onShare,
}: RightSideMenuProps) {
  const isDM = user.role === "DM"
  const wide = isDM && (activeTab === "maps" || activeTab === "players")
  const info = phaseInfo(phase)

  useEffect(() => {
    if (!isDM && activeTab === "maps") setActiveTab("chat")
  }, [isDM, activeTab, setActiveTab])

  // Other DMs may have uploaded in the meantime.
  useEffect(() => {
    if (activeTab === "maps" && isDM) onRefreshImages()
  }, [activeTab, isDM, onRefreshImages])

  return (
    <aside
      className={`jade absolute bottom-4 right-3 top-4 z-30 flex flex-col p-[11px] transition-[width] duration-200 ${wide ? "w-[min(38rem,calc(100%-1.5rem))]" : "w-[min(24rem,calc(100%-1.5rem))]"}`}
      style={{ boxShadow: "0 0 0 2px #0a0d0a, 0 14px 30px rgba(0,0,0,.85)", ["--jade-muted" as string]: "#b3bca5" }}
      aria-label="Side panel"
    >
      {/* The marble is a hollow frame, so the see-through chat log shows the map, not marble. */}
      <i
        className="jade-marble pointer-events-none absolute inset-0 p-[11px]"
        style={{
          boxShadow: "inset 0 0 0 2px #8e9a80, inset 0 0 0 3px #0a0d0a",
          mask: "linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)",
          WebkitMask: "linear-gradient(#000 0 0) content-box xor, linear-gradient(#000 0 0)",
        }}
        aria-hidden
      />
      <i className="jade-knot absolute -top-2 left-3.5 right-3.5 h-4" aria-hidden />
      <i className="jade-knot jade-knot-under absolute -bottom-2 left-3.5 right-3.5 h-4" aria-hidden />
      <div className={`jade-well relative flex min-h-0 flex-1 flex-col ${activeTab === "chat" ? "!bg-transparent" : "jade-fill"}`}>
        <div className="flex items-center justify-between gap-2 jade-fill px-3 pb-1.5 pt-3">
          <h2 className="jade-title text-[21px] leading-none">{TABS.find((t) => t.key === activeTab)?.label ?? "Chat"}</h2>
          <button type="button" className="jade-btn !h-7 text-[13px]" onClick={onRequestCompactChat} title="Fold the panel into the mini chat and free the map">
            Collapse ›
          </button>
        </div>
        <div className="flex gap-1 jade-fill px-2.5 pb-2 pt-1" role="tablist">
          {TABS.filter((t) => isDM || !t.dmOnly).map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={activeTab === t.key}
              data-active={activeTab === t.key}
              onClick={() => setActiveTab(t.key)}
              className="jade-tab h-7 flex-1 text-xs"
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "chat" && (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* The log is see-through so the map shows behind it; stone strips frame it at the sides. */}
            <div className="flex min-h-0 flex-1">
              <i className="jade-fill w-2.5 shrink-0" aria-hidden />
              <div className="jade-inset relative flex min-h-0 min-w-0 flex-1 flex-col !bg-black/30">
                {info && (
                  <div className="jade-sc shrink-0 pt-1.5 text-center text-xs font-semibold" style={{ color: info.color }}>
                    — {info.name} phase —
                  </div>
                )}
                <ChatLog messages={messages} hasMore={hasMoreMessages} onLoadOlder={onLoadOlderMessages} className="jade-outline min-h-0 flex-1 px-2.5 py-2" />
              </div>
              <i className="jade-fill w-2.5 shrink-0" aria-hidden />
            </div>
            <div className="jade-fill px-2.5 pb-2 pt-2.5">
              <DiceTray onRoll={onRoll} />
            </div>
            <div className="jade-fill px-2.5 pb-2.5">
              <ChatComposer user={user} characters={characters} onSend={onSendMessage} />
            </div>
          </div>
        )}

        {activeTab === "characters" && (
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            <CharacterList
              characters={isDM ? characters : characters.filter((c) => c.userId === user.id)}
              onAddCharacter={onAddCharacter}
              onOpenCharacter={onOpenCharacter}
              onDeleteCharacter={onDeleteCharacter}
              currentUser={user.id}
              isDM={isDM}
            />
          </div>
        )}

        {isDM && activeTab === "maps" && (
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
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
        )}

        {activeTab === "players" && (
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            <PlayerProfile user={user} onProfileChange={onProfileChange} />
            {isDM && (
              <DmPlayerAccounts
                allUsers={allUsers}
                characters={characters}
                currentUser={user}
                onRefetchUsers={onRefetchUsers}
                onRefetchCharacters={onRefetchCharacters}
              />
            )}
            <div className="mt-4 flex gap-2 border-t border-black/50 pt-3">
              {isDM && (
                <button type="button" className="jade-btn !h-8 flex-1 text-[13px]" onClick={onShare}>
                  <Globe className="h-4 w-4" /> Share over the internet
                </button>
              )}
              <button type="button" className="jade-btn !h-8 flex-1 text-[13px]" onClick={onLogout}>
                <LogOut className="h-4 w-4" /> Log out {user.username}
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

export default memo(RightSideMenu)
