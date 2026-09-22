import { describe, expect, it } from "vitest"
import { CardStatus } from "@/data/types"
import {
  CARD_STATUSES,
  TEST_BIN,
  canTransition,
  generateCardNumber,
  isCardStatus,
  isLuhnValid,
  last4Of,
  luhnCheckDigit,
  maskCard,
} from "./cards"

/** Deterministic source, so a failure is reproducible. */
function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe("generateCardNumber", () => {
  it("returns sixteen digits on the test BIN with a valid Luhn check digit", () => {
    const number = generateCardNumber(mulberry32(20260813))
    expect(number).toMatch(/^\d{16}$/)
    expect(number.startsWith(TEST_BIN)).toBe(true)
    expect(isLuhnValid(number)).toBe(true)
  })

  it("holds over a thousand draws, so no filler digit breaks the check", () => {
    const rng = mulberry32(1)
    for (let i = 0; i < 1000; i++) {
      const number = generateCardNumber(rng)
      expect(number).toMatch(/^4242\d{12}$/)
      expect(isLuhnValid(number)).toBe(true)
    }
  })

  it("is deterministic for a given source, so seeds are stable across runs", () => {
    expect(generateCardNumber(mulberry32(7))).toBe(
      generateCardNumber(mulberry32(7)),
    )
  })

  it("varies between draws from the same source", () => {
    const rng = mulberry32(99)
    const drawn = new Set<string>()
    for (let i = 0; i < 5; i++) drawn.add(generateCardNumber(rng))
    expect(drawn.size).toBeGreaterThan(1)
  })
})

describe("luhnCheckDigit", () => {
  it("appends the digit that makes the number valid", () => {
    const body = "424242424242424"
    const number = body + String(luhnCheckDigit(body))
    expect(isLuhnValid(number)).toBe(true)
  })

  it("returns a single digit zero to nine", () => {
    for (const body of ["4242", "1", "999999999999999"]) {
      const digit = luhnCheckDigit(body)
      expect(digit).toBeGreaterThanOrEqual(0)
      expect(digit).toBeLessThanOrEqual(9)
    }
  })
})

describe("isLuhnValid", () => {
  it("rejects a number one digit off", () => {
    const number = generateCardNumber(mulberry32(3))
    const lastDigit = Number(number.slice(-1))
    const wrong = number.slice(0, -1) + String((lastDigit + 1) % 10)
    expect(isLuhnValid(wrong)).toBe(false)
  })

  it("rejects anything that is not all digits", () => {
    expect(isLuhnValid("4242-4242-4242-4242")).toBe(false)
    expect(isLuhnValid("")).toBe(false)
    expect(isLuhnValid("4242abcd42424242")).toBe(false)
  })
})

describe("canTransition", () => {
  it("allows active and frozen to swap", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("allows either live status to cancel", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal, so nothing comes back from it", () => {
    for (const to of CARD_STATUSES) {
      expect(canTransition("cancelled", to)).toBe(false)
    }
  })

  it("refuses a status transitioning to itself", () => {
    for (const status of CARD_STATUSES) {
      expect(canTransition(status, status)).toBe(false)
    }
  })

  it("covers every ordered pair, so no combination is undefined", () => {
    const allowed = new Set(["active>frozen", "active>cancelled", "frozen>active", "frozen>cancelled"])
    for (const from of CARD_STATUSES) {
      for (const to of CARD_STATUSES) {
        expect(canTransition(from, to)).toBe(allowed.has(`${from}>${to}`))
      }
    }
  })
})

describe("isCardStatus", () => {
  it("accepts the three real statuses", () => {
    for (const status of CARD_STATUSES) {
      expect(isCardStatus(status)).toBe(true)
    }
  })

  it("rejects anything a client could invent", () => {
    for (const value of ["lost", "ACTIVE", "", null, undefined, 1, {}]) {
      expect(isCardStatus(value)).toBe(false)
    }
  })
})

describe("maskCard", () => {
  it("renders four bullets, a space, and the last four", () => {
    expect(maskCard("4321")).toBe("•••• 4321")
  })

  it("masks what last4Of pulls off a generated number", () => {
    const number = generateCardNumber(mulberry32(11))
    expect(maskCard(last4Of(number))).toBe(`•••• ${number.slice(12)}`)
  })
})

describe("last4Of", () => {
  it("returns the final four digits", () => {
    expect(last4Of("4242424242424242")).toBe("4242")
    expect(last4Of("4242111122223333")).toBe("3333")
  })
})

describe("CARD_STATUSES", () => {
  it("lists exactly the three statuses in the CardStatus union", () => {
    const expected: CardStatus[] = ["active", "frozen", "cancelled"]
    expect(CARD_STATUSES).toEqual(expected)
  })
})
