"use client"

import { Button } from "@/components/ui/button"
import EncounterButton from "./EncounterButton"

export default function BottomBar({ onDiceRoll, onPhaseChange }) {
  const rollDice = (sides: number) => {
    const result = Math.floor(Math.random() * sides) + 1
    onDiceRoll(sides, result)
  }

  return (
    <div className="bg-gray-200 p-2 flex justify-center space-x-2 items-center w-full">
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

