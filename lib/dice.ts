// Dice expressions rolled on the server, e.g. "d20", "3d6+2", "2d8kh1" (keep highest 1), "4d6kl3".
import { randomInt } from "crypto"

export type DiceTerm =
  | { kind: "dice"; sign: 1 | -1; count: number; sides: number; keep?: { mode: "kh" | "kl"; count: number } }
  | { kind: "constant"; sign: 1 | -1; value: number }

export type RolledTerm =
  | { kind: "dice"; sign: 1 | -1; notation: string; sides: number; rolls: number[]; kept: number[]; subtotal: number }
  | { kind: "constant"; sign: 1 | -1; value: number }

export interface DiceRollResult {
  expression: string
  terms: RolledTerm[]
  total: number
}

export const MAX_EXPRESSION_LENGTH = 100
export const MAX_DICE = 200
export const MAX_SIDES = 1000
export const MAX_CONSTANT = 10_000

const TERM = /^(\d*)d(\d+)(?:(kh|kl)(\d+))?$/

/** Parses an expression into terms; throws an Error with a user-facing message if invalid. */
export function parseDiceExpression(input: string): DiceTerm[] {
  const expression = input.replace(/\s+/g, "").toLowerCase()
  if (!expression || expression.length > MAX_EXPRESSION_LENGTH) throw new Error("Enter a dice expression like 2d6+1")
  const parts = expression.match(/[+-]?[^+-]+/g)
  if (!parts || parts.join("") !== expression) throw new Error(`Can't read "${input}"`)

  let totalDice = 0
  const terms = parts.map((part): DiceTerm => {
    const sign: 1 | -1 = part.startsWith("-") ? -1 : 1
    const body = part.replace(/^[+-]/, "")
    if (/^\d+$/.test(body)) {
      const value = Number(body)
      if (value > MAX_CONSTANT) throw new Error(`Modifier ${value} is too large`)
      return { kind: "constant", sign, value }
    }
    const m = TERM.exec(body)
    if (!m) throw new Error(`Can't read "${body}" (try 2d6, d20 or 2d8kh1)`)
    const count = m[1] === "" ? 1 : Number(m[1])
    const sides = Number(m[2])
    if (count < 1) throw new Error("Roll at least one die")
    if (sides < 2 || sides > MAX_SIDES) throw new Error(`Dice need 2 to ${MAX_SIDES} sides`)
    totalDice += count
    if (totalDice > MAX_DICE) throw new Error(`At most ${MAX_DICE} dice per roll`)
    if (m[3]) {
      const keepCount = Number(m[4])
      if (keepCount < 1 || keepCount > count) throw new Error(`Can't keep ${keepCount} of ${count} dice`)
      return { kind: "dice", sign, count, sides, keep: { mode: m[3] as "kh" | "kl", count: keepCount } }
    }
    return { kind: "dice", sign, count, sides }
  })
  if (!terms.some((t) => t.kind === "dice")) throw new Error("The expression has no dice")
  return terms
}

/** Indices of the dice to keep: the highest (kh) or lowest (kl) `count`, ties by position. */
function keptIndices(rolls: number[], keep?: { mode: "kh" | "kl"; count: number }): number[] {
  const all = rolls.map((_, i) => i)
  if (!keep) return all
  const order = [...all].sort((a, b) => (keep.mode === "kh" ? rolls[b] - rolls[a] : rolls[a] - rolls[b]) || a - b)
  return order.slice(0, keep.count).sort((a, b) => a - b)
}

export function rollDice(expression: string, random: (sides: number) => number = (s) => randomInt(1, s + 1)): DiceRollResult {
  const terms = parseDiceExpression(expression).map((term): RolledTerm => {
    if (term.kind === "constant") return term
    const rolls = Array.from({ length: term.count }, () => random(term.sides))
    const kept = keptIndices(rolls, term.keep)
    const notation = `${term.count}d${term.sides}${term.keep ? `${term.keep.mode}${term.keep.count}` : ""}`
    return { kind: "dice", sign: term.sign, notation, sides: term.sides, rolls, kept, subtotal: kept.reduce((sum, i) => sum + rolls[i], 0) }
  })
  const total = terms.reduce((sum, t) => sum + t.sign * (t.kind === "dice" ? t.subtotal : t.value), 0)
  return { expression: formatExpression(terms), terms, total }
}

function formatExpression(terms: RolledTerm[]): string {
  return terms
    .map((t, i) => {
      const body = t.kind === "dice" ? t.notation : String(t.value)
      return i === 0 ? (t.sign < 0 ? `-${body}` : body) : `${t.sign < 0 ? "-" : "+"}${body}`
    })
    .join("")
}

/**
 * One-line chat text, e.g. "rolled 2d8kh1 [(3), 7] + 1 = 8". Dropped dice are in parentheses.
 * A single plain die reads "rolled a d10: 3".
 */
export function describeRoll(result: DiceRollResult, label?: string): string {
  const prefix = label ? `${label}: ` : ""
  const [only] = result.terms
  if (result.terms.length === 1 && only.kind === "dice" && only.sign > 0 && only.rolls.length === 1) {
    return `${prefix}rolled a d${only.sides}: ${result.total}`
  }
  const parts = result.terms.map((t, i) => {
    const sign = i === 0 ? (t.sign < 0 ? "-" : "") : t.sign < 0 ? " - " : " + "
    if (t.kind === "constant") return `${sign}${t.value}`
    const keptSet = new Set(t.kept)
    const dice = t.rolls.map((r, idx) => (keptSet.has(idx) || t.kept.length === t.rolls.length ? String(r) : `(${r})`))
    return `${sign}${t.notation} [${dice.join(", ")}]`
  })
  return `${prefix}rolled ${parts.join("")} = ${result.total}`
}

export const TEST_ATTRIBUTES = { Strength: "STR", Dexternity: "DEX", Mind: "MND", Charisma: "CHA" } as const
export type TestAttribute = keyof typeof TEST_ATTRIBUTES

export function isTestAttribute(value: unknown): value is TestAttribute {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(TEST_ATTRIBUTES, value)
}

export interface TestResult {
  attribute: TestAttribute
  score: number
  roll: number
  pass: boolean
  /** Roll minus score: the row of the partial success table (negative is better). */
  margin: number
}

/** Scores a Test's d20: equal to or under the score passes; 1 always passes and 20 always fails. */
export function scoreTest(attribute: TestAttribute, score: number, roll: number): TestResult {
  const pass = roll === 1 || (roll !== 20 && roll <= score)
  return { attribute, score, roll, pass, margin: roll - score }
}

/** Chat text ending in the roll, e.g. "Mind test vs 12, pass: rolled a d20: 9". */
export function describeTest(test: TestResult): string {
  const name = test.attribute === "Dexternity" ? "Dexterity" : test.attribute
  const natural = test.roll === 1 || test.roll === 20 ? ` (natural ${test.roll})` : ""
  return `${name} test vs ${test.score}, ${test.pass ? "pass" : "fail"}${natural}: rolled a d20: ${test.roll}`
}
