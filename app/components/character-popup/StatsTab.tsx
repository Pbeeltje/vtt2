// components/character-popup/StatsTab.tsx
import type { Character } from '../../types/character';
import { useState } from 'react';
import type { Job, JobFormPayload } from '../../hooks/useJobs';
import { EditableField } from './EditableField';
import { JobDetailModal } from './JobDetailModal';
import { NumField } from './NumField';
import type { SheetDraft } from './useSheetDraft';
import { CHARACTER_SIZES, DEFAULT_CHARACTER_SIZE } from '../../lib/tokens';

interface StatsTabProps {
  sheet: SheetDraft;
  jobs: Job[];
  onSaveJob: (jobId: number, form: JobFormPayload) => Promise<boolean>;
  onCreateJob: (form: JobFormPayload) => Promise<boolean>;
}

/** Every number on the sheet as a fillable medallion, then the description and jobs (click one to open it). */
export function StatsTab({ sheet, jobs, onSaveJob, onCreateJob }: StatsTabProps) {
  const { draft } = sheet;
  const [openJobId, setOpenJobId] = useState<number | null>(null);
  // The live job, so the open popup follows saves.
  const openJob = openJobId === null ? null : jobs.find((j) => j.JobId === openJobId) ?? null;
  const magic = draft.Path === "Magic User";
  const guardLow = Number(draft.Guard ?? 0) < Number(draft.MaxGuard ?? 0);
  const attributes: Array<[string, keyof Character, keyof Character]> = [
    ["Strength", "Strength", "MaxStrength"],
    ["Dexterity", "Dexternity", "MaxDexternity"],
    ["Mind", "Mind", "MaxMind"],
    ["Charisma", "Charisma", "MaxCharisma"],
    [magic ? "Spellcraft" : "Skill", "Skill", "MaxSkill"],
  ];

  return (
    <div className="space-y-6">
      <section aria-label="Guard, level, armor and size" className="flex flex-wrap justify-center gap-x-5 gap-y-4 pt-2">
        <Medallion label="Guard">
          <Pair sheet={sheet} name="Guard" maxName="MaxGuard" label="Guard" className={guardLow ? "text-[#ffd24a]" : "text-[#7cf08a]"} />
        </Medallion>
        <Medallion label="Level">
          <NumField sheet={sheet} name="Level" label="Level" className="h-8 w-12 text-lg" />
        </Medallion>
        <Medallion label="Armor">
          <NumField sheet={sheet} name="Armor" label="Armor" className="h-8 w-12 text-lg" />
        </Medallion>
        <Medallion label="Size">
          <SizeField sheet={sheet} />
        </Medallion>
        {magic && (
          <Medallion label="MP">
            <Pair sheet={sheet} name="Mp" maxName="MaxMp" label="MP" className="text-[#9fd6ff]" />
          </Medallion>
        )}
      </section>

      <div className="h-px bg-[linear-gradient(90deg,transparent,#8e9a80,transparent)]" aria-hidden />

      <section aria-label="Attributes" className="flex flex-wrap justify-center gap-x-5 gap-y-4">
        {attributes.map(([label, name, maxName]) => (
          <Medallion key={name} label={label}>
            <Pair sheet={sheet} name={name} maxName={maxName} label={label} />
          </Medallion>
        ))}
        <Medallion label="Age">
          <NumField sheet={sheet} name="Age" label="Age" maxLength={4} className="h-8 w-12 text-lg" />
        </Medallion>
      </section>

      <section>
        <h3 className="jade-sc mb-1 text-xs font-semibold text-[var(--jade-gold-hi)]">Description</h3>
        <div className="border border-[var(--jade-gold-hi)] bg-black/10 py-2 pl-3 pr-1">
          <EditableField
            value={draft.Description || ''}
            onChange={(value) => sheet.set("Description", value)}
            onSave={(value) => sheet.save({ Description: value })}
            isTextarea
            markdownDisplay
            className="min-h-[84px] text-[var(--jade-ink)]"
          />
        </div>
      </section>

      {jobs.length > 0 ? (
        <section>
          <h3 className="jade-sc mb-1 text-xs font-semibold text-[var(--jade-gold-hi)]">Jobs</h3>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {jobs.map((job) => (
              <li key={job.JobId} className="min-w-0">
                <button
                  type="button"
                  onClick={() => setOpenJobId(job.JobId)}
                  className="jade-inset flex w-full items-baseline gap-1.5 px-3 py-2 text-left text-sm hover:shadow-[inset_0_0_0_1px_#e0c25a,inset_0_0_12px_#000] focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_1px_#e0c25a,inset_0_0_12px_#000]"
                  title={`Open ${job.Name}`}
                >
                  <span className="truncate font-semibold text-[var(--jade-ink-hi)]">{job.Name}</span>
                  <span className="shrink-0 text-[var(--jade-muted)]">Tier {job.Tier}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <JobDetailModal
        job={openJob}
        open={openJob !== null}
        onOpenChange={(open) => !open && setOpenJobId(null)}
        onSave={onSaveJob}
        onCreate={onCreateJob}
      />
    </div>
  );
}

/** Current over max, e.g. "7/10", both fillable. */
function Pair({ sheet, name, maxName, label, className = "" }: { sheet: SheetDraft; name: keyof Character; maxName: keyof Character; label: string; className?: string }) {
  return (
    <span className={`flex items-center ${className}`}>
      <NumField sheet={sheet} name={name} label={label} className="h-7" fit />
      <span className="px-px">/</span>
      <NumField sheet={sheet} name={maxName} label={`Max ${label.toLowerCase()}`} className="h-7" fit />
    </span>
  );
}

/** The character's size, picked from a list and saved at once; it sets the token's size on the map. */
function SizeField({ sheet }: { sheet: SheetDraft }) {
  const size = sheet.draft.Size || DEFAULT_CHARACTER_SIZE;
  return (
    <select
      value={size}
      onChange={(e) => {
        sheet.set("Size", e.target.value);
        sheet.save({ Size: e.target.value });
      }}
      aria-label="Size"
      title={`Size: ${size} (token ${CHARACTER_SIZES[size as keyof typeof CHARACTER_SIZES] ?? 1}x)`}
      className="h-8 w-[64px] cursor-pointer appearance-none rounded-full bg-transparent text-center text-[13px] outline-none [text-align-last:center] focus:bg-black/40 focus:shadow-[0_0_0_1px_#e0c25a]"
    >
      {Object.keys(CHARACTER_SIZES).map((name) => (
        <option key={name} value={name} className="bg-[#0a0d0a] text-white">
          {name}
        </option>
      ))}
    </select>
  );
}

/** A round stone socket holding a value, with its name engraved underneath. */
function Medallion({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2.5">
      <div
        className="jade-outline grid h-[72px] w-[72px] place-items-center rounded-full text-[17px] font-bold text-white"
        style={{ background: "radial-gradient(circle at 40% 35%, #2a3329, #080a08 70%)", boxShadow: "0 0 0 3px #0a0d0a, 0 0 0 7px #8e9a80, 0 0 0 9px #0a0d0a" }}
      >
        {children}
      </div>
      <span className="jade-sc text-xs font-semibold text-[#e1dcc4] jade-outline">{label}</span>
    </div>
  );
}
