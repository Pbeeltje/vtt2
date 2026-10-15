import { describe, expect, it } from "vitest"
import { describeRoll, describeTest, isTestAttribute, parseDiceExpression, rollDice, scoreTest } from "@/lib/dice"

/** A fake die that returns the given faces in order. */
const faces = (...values: number[]) => () => {
  const next = values.shift()
  if (next === undefined) throw new Error("ran out of faces")
  return next
}

describe("parseDiceExpression", () => {
  it("reads dice, keep modifiers and constants", () => {
    expect(parseDiceExpression("d20")).toEqual([{ kind: "dice", sign: 1, count: 1, sides: 20 }])
    expect(parseDiceExpression(" 2D8kh1 + 3 - 1d4 ")).toEqual([
      { kind: "dice", sign: 1, count: 2, sides: 8, keep: { mode: "kh", count: 1 } },
      { kind: "constant", sign: 1, value: 3 },
      { kind: "dice", sign: -1, count: 1, sides: 4 },
    ])
  })

  it.each([
    ["", /dice expression/],
    ["hello", /Can't read/],
    ["2d1", /2 to 1000 sides/],
    ["0d6", /at least one/],
    ["201d6", /At most 200 dice/],
    ["2d6kh3", /Can't keep 3 of 2/],
    ["5", /no dice/],
    ["2d6++1", /Can't read/],
  ])("rejects %j", (input, message) => {
    expect(() => parseDiceExpression(input)).toThrow(message)
  })
})

describe("rollDice", () => {
  it("adds dice and modifiers", () => {
    const result = rollDice("3d6+2", faces(4, 2, 6))
    expect(result.total).toBe(14)
    expect(describeRoll(result)).toBe("rolled 3d6 [4, 2, 6] + 2 = 14")
  })

  it("shortens a single plain die", () => {
    expect(describeRoll(rollDice("1d10", faces(3)))).toBe("rolled a d10: 3")
    expect(describeRoll(rollDice("d20", faces(17)), "Skill")).toBe("Skill: rolled a d20: 17")
    expect(describeRoll(rollDice("d20+2", faces(5)))).toBe("rolled 1d20 [5] + 2 = 7")
  })

  it("keeps the highest die (Job System attacks)", () => {
    const result = rollDice("2d8kh1", faces(3, 7))
    expect(result.total).toBe(7)
    expect(describeRoll(result, "Attack")).toBe("Attack: rolled 2d8kh1 [(3), 7] = 7")
  })

  it("keeps the lowest dice", () => {
    expect(rollDice("4d6kl2", faces(5, 1, 3, 1)).total).toBe(2)
  })

  it("subtracts negative terms", () => {
    expect(rollDice("d20-1d4", faces(10, 3)).total).toBe(7)
  })

  it("uses real random faces within range", () => {
    for (let i = 0; i < 200; i++) {
      const { total } = rollDice("d6")
      expect(total).toBeGreaterThanOrEqual(1)
      expect(total).toBeLessThanOrEqual(6)
    }
  })
})

describe("Tests (d20 roll-under)", () => {
  it("passes on equal to or under the score", () => {
    expect(scoreTest("Strength", 15, 15)).toMatchObject({ pass: true, margin: 0 })
    expect(scoreTest("Strength", 15, 13)).toMatchObject({ pass: true, margin: -2 })
    expect(scoreTest("Strength", 15, 16)).toMatchObject({ pass: false, margin: 1 })
  })

  it("always passes on a 1 and always fails on a 20", () => {
    expect(scoreTest("Mind", 0, 1).pass).toBe(true)
    expect(scoreTest("Mind", 25, 20).pass).toBe(false)
  })

  it("ends the chat text with the roll and spells Dexterity right", () => {
    expect(describeTest(scoreTest("Dexternity", 12, 9))).toBe("Dexterity test vs 12, pass: rolled a d20: 9")
    expect(describeTest(scoreTest("Charisma", 12, 20))).toBe("Charisma test vs 12, fail (natural 20): rolled a d20: 20")
  })

  it("only accepts the four attributes", () => {
    expect(isTestAttribute("Mind")).toBe(true)
    expect(isTestAttribute("Skill")).toBe(false)
    expect(isTestAttribute("toString")).toBe(false)
  })
})
