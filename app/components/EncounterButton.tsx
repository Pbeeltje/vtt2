"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface EncounterButtonProps {
  onPhaseChange: (phase: string, color: string) => void;
}

export default function EncounterButton({ onPhaseChange }: EncounterButtonProps) {
  const [phase, setPhase] = useState("Encounter")
  const phases = [
    { name: "Prepare", color: "bg-blue-100" },
    { name: "Quick", color: "bg-yellow-100" },
    { name: "Act", color: "bg-red-100" },
    { name: "Release", color: "bg-purple-100" },
  ]

  const handleClick = () => {
    const currentIndex = phases.findIndex((p) => p.name === phase)
    const nextIndex = (currentIndex + 1) % phases.length
    const nextPhase = phases[nextIndex]
    setPhase(nextPhase.name)
    onPhaseChange(nextPhase.name + " phase", nextPhase.color)
  }

  const resetEncounter = () => {
    setPhase("Encounter")
    onPhaseChange("It's over", "bg-white")
  }

  // Determine text color based on phase
  const textColor = phase === "Encounter" ? "text-white" : "text-black"

  return (
    <div className="flex items-center">
      <Button
        onClick={handleClick}
        className={`w-24 ${phase !== "Encounter" ? phases.find((p) => p.name === phase)?.color : "bg-black"} ${textColor} hover:bg-black hover:text-white`}
      >
        {phase}
      </Button>
      {phase !== "Encounter" && (
        <Button onClick={resetEncounter} variant="ghost" size="icon" className="ml-2">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

