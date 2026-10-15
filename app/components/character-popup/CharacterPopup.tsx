// components/character-popup/CharacterPopup.tsx
'use client'

import { useRef, useState } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { Backpack, ChevronDown, Settings, Swords, Upload, UserRound, X } from 'lucide-react';
import { Character } from '../../types/character';
import type { User } from '../../types/user';
import { StatsTab } from './StatsTab';
import { JobsTab } from './JobsTab';
import { InventoryTab } from './InventoryTab';
import { toast } from "@/components/ui/use-toast";
import { useJobs } from '../../hooks/useJobs';
import { useSheetDraft } from './useSheetDraft';
import { useImageUpload } from './useImageUpload';

interface CharacterPopupProps {
  character: Character;
  onClose: () => void;
  /** Saves only the given fields; resolves to the saved character, or null if it failed. */
  onSave: (changes: Partial<Character>) => Promise<Character | null>;
  isDM: boolean;
  allUsers?: User[];
}

export default function CharacterPopup({ character, onClose, onSave, isDM, allUsers }: CharacterPopupProps) {
  const [selectedUserIdToAssign, setSelectedUserIdToAssign] = useState<number | ''>( '');
  const { jobs, handleCreateJob, handleJobSubmit } = useJobs(character.CharacterId);

  const handleAssignCharacter = async () => {
    if (selectedUserIdToAssign === '') { 
      toast({ title: "Selection Required", description: "Please select a user to assign the character to.", variant: "destructive" });
      return;
    }

    if (!character) {
      toast({ title: "Error", description: "No character data found.", variant: "destructive" });
      return;
    }

    if (await onSave({ userId: selectedUserIdToAssign as number })) {
      setSelectedUserIdToAssign('');
      toast({ title: "Character assigned" });
    }
  };

  const [tab, setTab] = useState("stats");
  const sheet = useSheetDraft(character, onSave);
  const { draft } = sheet;
  const tabs = [
    { value: "stats", label: "Stats", icon: UserRound },
    { value: "jobs", label: "Jobs", icon: Swords },
    { value: "inventory", label: "Inventory", icon: Backpack },
    ...(isDM ? [{ value: "options", label: "Options", icon: Settings }] : []),
  ];
  const portraitUpload = useImageUpload("Portrait", (url) => {
    sheet.set("PortraitUrl", url);
    sheet.save({ PortraitUrl: url });
  });
  const tokenUpload = useImageUpload("Token", (url) => {
    sheet.set("TokenUrl", url);
    sheet.save({ TokenUrl: url });
  });
  const picture = draft.PortraitUrl || draft.TokenUrl;
  const stop = { onClick: (e: React.MouseEvent) => e.stopPropagation(), onMouseDown: (e: React.MouseEvent) => e.stopPropagation(), onMouseUp: (e: React.MouseEvent) => e.stopPropagation() };
  // Close only when the press started on the backdrop too. Tabs switch on mousedown and the sheet
  // re-centres at its new height, so a press on a tab can be released over the backdrop, and the
  // browser then sends the click to the backdrop.
  const pressedBackdrop = useRef(false);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${character.Name}'s character sheet`}
      onMouseDown={(e) => { pressedBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => {
        if (pressedBackdrop.current && e.target === e.currentTarget) onClose();
        pressedBackdrop.current = false;
      }}
    >
      <TabsPrimitive.Root
        value={tab}
        onValueChange={setTab}
        className="jade jade-marble relative z-[101] flex max-h-[92vh] w-full max-w-5xl flex-col gap-3 p-4"
        style={{ boxShadow: "0 0 0 2px #0a0d0a, 0 18px 40px rgba(0,0,0,.9), inset 0 0 0 2px #8e9a80, inset 0 0 0 3px #0a0d0a" }}
        {...stop}
      >
        <i className="jade-knot absolute -top-2 left-6 right-6 h-4" aria-hidden />
        <i className="jade-knot jade-knot-under absolute -bottom-2 left-6 right-6 h-4" aria-hidden />

        <div className="flex shrink-0 flex-wrap items-center gap-4">
          <div className="jade-well flex h-12 min-w-[10rem] flex-1 items-center px-2 sm:max-w-sm">
            <input
              value={draft.Name ?? ""}
              onChange={(e) => sheet.set("Name", e.target.value)}
              onBlur={() => sheet.save()}
              onKeyDown={sheet.keyDown}
              maxLength={60}
              placeholder="Unnamed"
              aria-label="Name"
              title="Name"
              className="jade-title w-full bg-transparent text-center text-2xl outline-none placeholder:text-[var(--jade-muted)] focus:shadow-[0_1px_0_#e0c25a]"
            />
          </div>
          <div className="jade-well relative flex h-12 w-48 items-center">
            <select
              value={draft.Path || "Warrior"}
              onChange={(e) => {
                sheet.set("Path", e.target.value);
                sheet.save({ Path: e.target.value });
              }}
              aria-label="Path"
              title="Path"
              className="jade-title h-full w-full cursor-pointer appearance-none bg-transparent px-7 text-center text-lg text-[#d9d3b8] outline-none"
            >
              <option value="Warrior" className="bg-[#0a0d0a]">Warrior</option>
              <option value="Magic User" className="bg-[#0a0d0a]">Magic User</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 h-4 w-4 text-[var(--jade-gold)]" aria-hidden />
          </div>
          <TabsPrimitive.List className="ml-auto flex items-center gap-3.5" aria-label="Sheet sections">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <TabsPrimitive.Trigger
                  key={t.value}
                  value={t.value}
                  title={t.label}
                  className="grid h-12 w-12 place-items-center rounded-full text-[var(--jade-gold)] transition-shadow data-[state=active]:text-[#fff3b0] data-[state=active]:shadow-[0_0_0_2px_#0a0d0a,0_0_0_5px_#e0c25a,0_0_0_7px_#0a0d0a,0_0_14px_rgba(224,194,90,.6)]"
                  style={{ background: "radial-gradient(circle at 50% 40%, #232b23, #0a0d0a 75%)", boxShadow: tab === t.value ? undefined : "0 0 0 2px #0a0d0a, 0 0 0 5px #a59a6c, 0 0 0 7px #0a0d0a" }}
                >
                  <Icon className="h-6 w-6 [filter:drop-shadow(1px_1px_0_rgba(0,0,0,.95))]" strokeWidth={1.9} />
                  <span className="sr-only">{t.label}</span>
                </TabsPrimitive.Trigger>
              );
            })}
            <button
              type="button"
              onClick={onClose}
              title="Close the sheet"
              aria-label="Close the sheet"
              className="grid h-12 w-12 place-items-center rounded-full text-[var(--jade-hit)] hover:text-white"
              style={{ background: "radial-gradient(circle at 50% 40%, #232b23, #0a0d0a 75%)", boxShadow: "0 0 0 2px #0a0d0a, 0 0 0 5px #a59a6c, 0 0 0 7px #0a0d0a" }}
            >
              <X className="h-6 w-6" strokeWidth={2.2} />
            </button>
          </TabsPrimitive.List>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto md:flex-row md:overflow-visible">
          <div className="flex shrink-0 items-start gap-5 md:w-56 md:flex-col md:items-stretch">
            <div className="jade-well relative aspect-[3/4] w-28 shrink-0 bg-cover bg-[center_25%] md:w-full" style={{ backgroundImage: picture ? `url("${picture}")` : undefined }}>
              {!picture && <span className="jade-title absolute inset-0 grid place-items-center text-5xl text-[var(--jade-muted)]">{(draft.Name || "?").slice(0, 1).toUpperCase()}</span>}
              {portraitUpload.input}
              {tokenUpload.input}
              <button
                type="button"
                onClick={tokenUpload.pick}
                disabled={tokenUpload.uploading}
                title={tokenUpload.uploading ? "Uploading…" : "Upload a token (the round picture on the map)"}
                aria-label="Upload token"
                className="group absolute -bottom-3 -left-3 h-14 w-14 rounded-full bg-[#141a14] bg-cover bg-center shadow-[0_0_0_2px_#0a0d0a,0_0_0_4px_#8e9a80,0_0_0_5px_#0a0d0a,0_4px_10px_rgba(0,0,0,.8)]"
                style={{ backgroundImage: draft.TokenUrl ? `url("${draft.TokenUrl}")` : undefined }}
              >
                {!draft.TokenUrl && <span className="jade-sc absolute inset-0 grid place-items-center text-[10px] text-[var(--jade-muted)]">Token</span>}
                <span className="absolute inset-0 grid place-items-center rounded-full bg-black/55 text-[var(--jade-gold)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Upload className="h-5 w-5" />
                </span>
              </button>
              <button
                type="button"
                onClick={portraitUpload.pick}
                disabled={portraitUpload.uploading}
                title={portraitUpload.uploading ? "Uploading…" : "Upload a portrait"}
                aria-label="Upload portrait"
                className="jade-slot absolute bottom-2 right-2 h-9 w-9 disabled:opacity-60"
              >
                <Upload className="h-4 w-4" strokeWidth={2.2} />
              </button>
            </div>
          </div>

          <div className="jade-well jade-fill flex min-h-0 min-w-0 flex-1 flex-col">
            <h2 className="jade-sc shrink-0 px-5 pt-3 text-sm font-semibold text-[var(--jade-gold-hi)]">{tabs.find((t) => t.value === tab)?.label}</h2>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-2">
              <TabsPrimitive.Content value="stats">
                <StatsTab sheet={sheet} jobs={jobs} onSaveJob={handleJobSubmit} onCreateJob={handleCreateJob} />
              </TabsPrimitive.Content>
              {/* forceMount: prefetch jobs; Radix keeps present=true so we hide inactive via data-state */}
              <TabsPrimitive.Content value="jobs" forceMount className="data-[state=inactive]:hidden">
                <JobsTab jobs={jobs} handleCreateJob={handleCreateJob} handleJobSubmit={handleJobSubmit} />
              </TabsPrimitive.Content>
              <TabsPrimitive.Content value="inventory">
                <InventoryTab characterId={character.CharacterId} maxStrength={character.MaxStrength || 0} />
              </TabsPrimitive.Content>
              {isDM && (
                <TabsPrimitive.Content value="options">
                  <div className="space-y-4">
                    <h3 className="jade-title text-lg">Assign character to a player</h3>
                    <div>
                      <label htmlFor="user-assign-select" className="mb-1 block text-sm text-muted-foreground">
                        Player
                      </label>
                      <div className="flex items-center gap-2">
                        <select
                          id="user-assign-select"
                          value={selectedUserIdToAssign}
                          onChange={(e) => {
                            const value = e.target.value;
                            setSelectedUserIdToAssign(value === "" ? "" : Number(value));
                          }}
                          className="jade-input block h-9 w-full px-2 text-sm"
                        >
                          <option key="default" value="">Pick a player</option>
                          {allUsers && allUsers.filter(u => u.role !== 'DM').map((user) => (
                            <option key={`user-option-${user.id}`} value={user.id}>
                              {user.username} ({user.role})
                            </option>
                          ))}
                        </select>
                        <button type="button" className="jade-btn !h-9" onClick={handleAssignCharacter} disabled={selectedUserIdToAssign === ''}>
                          Assign
                        </button>
                      </div>
                    </div>
                    {character.userId !== null && character.userId !== undefined && (() => {
                      let assignedToText = `User ID: ${character.userId}`;
                      const assignedUser = allUsers?.find(u => u.id === character.userId);

                      if (assignedUser) {
                        assignedToText = `${assignedUser.username} (User ID: ${character.userId})`;
                        if (assignedUser.role === 'DM') {
                          assignedToText += ' (DM)';
                        }
                      } else if (allUsers && Array.isArray(allUsers) && allUsers.length > 0) {
                        assignedToText = `Unknown User (User ID: ${character.userId})`;
                      } else if (!allUsers || (Array.isArray(allUsers) && allUsers.length === 0)) {
                        assignedToText = `User ID: ${character.userId} (User details pending/unavailable)`;
                      }

                      return (
                        <p className="text-sm text-muted-foreground">
                          Currently assigned to: {assignedToText}
                        </p>
                      );
                    })()}
                  </div>
                </TabsPrimitive.Content>
              )}
            </div>
          </div>
        </div>
      </TabsPrimitive.Root>
    </div>
  );
}
