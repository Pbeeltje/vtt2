import { describe, expect, it } from "vitest"
import { describeRoll, parseDiceExpression, rollDice } from "@/lib/dice"

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
    expect(describeRoll(result)).toBe("rolled 3d6+2: 3d6 [4, 2, 6] + 2 = 14")
  })

  it("keeps the highest die (Job System attacks)", () => {
    const result = rollDice("2d8kh1", faces(3, 7))
    expect(result.total).toBe(7)
    expect(describeRoll(result, "Attack")).toBe("Attack: rolled 2d8kh1: 2d8kh1 [(3), 7] = 7")
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
