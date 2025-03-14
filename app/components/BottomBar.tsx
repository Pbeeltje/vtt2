"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import EncounterButton from "./EncounterButton"

interface BottomBarProps {
  onDiceRoll: (sides: number, result: number, numberOfDice: number, individualRolls: number[]) => void
  onPhaseChange: (phase: string, color: string) => void
}

export default function BottomBar({ onDiceRoll, onPhaseChange }: BottomBarProps) {
  const [numberOfDice, setNumberOfDice] = useState(1)

  const rollDice = (sides: number) => {
    let total = 0
    const individualRolls: number[] = []
    for (let i = 0; i < numberOfDice; i++) {
      const roll = Math.floor(Math.random() * sides) + 1
      individualRolls.push(roll)
      total += roll
    }
    onDiceRoll(sides, total, numberOfDice, individualRolls)
    setNumberOfDice(1) // Reset to 1 after rolling
  }

  return (
    <div className="bg-gray-200 p-2 flex justify-center space-x-2 items-center w-full" style={{ backgroundImage: 'url("images/bottombar.jpeg")', backgroundSize: 'auto 150%', backgroundRepeat: 'repeat-x' }}>
      <input
        type="number"
        min="1"
        value={numberOfDice}
        onChange={(e) => setNumberOfDice(Math.max(1, parseInt(e.target.value) || 1))}
        className="w-12 h-8 text-center border rounded"
      />
      <Button onClick={() => rollDice(4)} variant="outline" size="icon">
        d4
      </Button>
      <Button onClick={() => rollDice(6)} variant="outline" size="icon">
        d6
      </Button>
      <Button onClick={() => rollDice(8)} variant="outline" size="icon">
        d8
      </Button>
      <Button onClick={() => rollDice(10)} variant="outline" size="icon">
        d10
      </Button>
      <Button onClick={() => rollDice(12)} variant="outline" size="icon">
        d12
      </Button>
      <Button onClick={() => rollDice(20)} variant="outline" size="icon">
        d20
      </Button>
      <Button onClick={() => rollDice(30)} variant="outline" size="icon">
        d30
      </Button>
      <Button onClick={() => rollDice(100)} variant="outline" size="icon">
        d100
      </Button>
      <div className="border-l border-gray-400 h-6 mx-2"></div>
      <EncounterButton onPhaseChange={onPhaseChange} />
    </div>
  )
}
