import { CardCategory, CardStatus } from "@/data/types"

/**
 * Card logic with no I/O, so it is testable under the node-only vitest config.
 *
 * Numbers are generated on the server only, always on the 4242 test BIN, and
 * never stored. A card record carries last4; the full number is returned once,
 * in the creation response, and nowhere else.
 */

/** The test BIN. Nothing here may resemble a real PAN. */
export const TEST_BIN = "4242"

const CARD_NUMBER_LENGTH = 16

export const CARD_STATUSES: readonly CardStatus[] = [
  "active",
  "frozen",
  "cancelled",
]

export const CARD_CATEGORIES: readonly CardCategory[] = [
  "advertising",
  "software",
  "contractors",
  "travel",
  "other",
]

/** Allowlist guard. A missing category is not an error; it defaults to other. */
export function isCardCategory(value: unknown): value is CardCategory {
  return (
    typeof value === "string" &&
    CARD_CATEGORIES.includes(value as CardCategory)
  )
}

/**
 * active ⇄ frozen, either to cancelled, and cancelled is terminal.
 * A status cannot transition to itself; that is a no-op, not a move.
 */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

/** Allowlist guard for anything arriving from a client. */
export function isCardStatus(value: unknown): value is CardStatus {
  return (
    typeof value === "string" && CARD_STATUSES.includes(value as CardStatus)
  )
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

/** The digit that makes `digits` a Luhn-valid number once appended. */
export function luhnCheckDigit(digits: string): number {
  let sum = 0
  let double = true
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  return (10 - (sum % 10)) % 10
}

export function isLuhnValid(number: string): boolean {
  if (!/^\d+$/.test(number)) return false
  let sum = 0
  let double = false
  for (let i = number.length - 1; i >= 0; i--) {
    let digit = Number(number[i])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  return sum % 10 === 0
}

/**
 * Sixteen digits: the test BIN, random filler, and a Luhn check digit.
 * The random source is a parameter so seeds pass the deterministic generator
 * and route handlers pass Math.random.
 */
export function generateCardNumber(rng: () => number = Math.random): string {
  let body = TEST_BIN
  while (body.length < CARD_NUMBER_LENGTH - 1) {
    body += String(Math.min(9, Math.floor(rng() * 10)))
  }
  return body + String(luhnCheckDigit(body))
}

export function last4Of(number: string): string {
  return number.slice(-4)
}

/** The only card number rendering outside the creation response. */
export function maskCard(last4: string): string {
  return `•••• ${last4}`
}
