import { describe, expect, it } from "vitest"
import {
  MAX_CARD_LIMIT,
  MAX_NICKNAME_LENGTH,
  cardById,
  createCard,
  listCards,
  parseCardInput,
  parseCardStatusFilter,
  setCardStatus,
} from "./cards"
import { store } from "./store"

const valid = {
  merchantId: "mch_01",
  nickname: "Ad spend — Meta",
  limit: 25_000,
  currency: "USD",
}

/** A fresh card per test, so no test depends on another's mutations. */
function issue(overrides: Partial<typeof valid> = {}) {
  const parsed = parseCardInput({ ...valid, ...overrides })
  if (!parsed.ok) throw new Error(`fixture rejected: ${parsed.error.message}`)
  return createCard(parsed.value)
}

describe("parseCardInput — rejections", () => {
  it("rejects a body that is not an object", () => {
    for (const body of [null, "nope", 42, undefined]) {
      const result = parseCardInput(body)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.field).toBe("body")
    }
  })

  it("rejects a missing merchant", () => {
    const result = parseCardInput({ ...valid, merchantId: undefined })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.field).toBe("merchantId")
  })

  it("rejects a merchant that does not exist", () => {
    const result = parseCardInput({ ...valid, merchantId: "mch_99" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.field).toBe("merchantId")
  })

  it("rejects an empty or whitespace-only nickname", () => {
    for (const nickname of ["", "   ", "\t"]) {
      const result = parseCardInput({ ...valid, nickname })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.field).toBe("nickname")
    }
  })

  it("rejects a nickname over the length cap", () => {
    const result = parseCardInput({
      ...valid,
      nickname: "x".repeat(MAX_NICKNAME_LENGTH + 1),
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.field).toBe("nickname")
  })

  it("rejects a zero limit", () => {
    const result = parseCardInput({ ...valid, limit: 0 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.field).toBe("limit")
  })

  it("rejects a negative limit", () => {
    const result = parseCardInput({ ...valid, limit: -1 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.field).toBe("limit")
  })

  it("rejects a limit above the cap", () => {
    const result = parseCardInput({ ...valid, limit: MAX_CARD_LIMIT + 1 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.field).toBe("limit")
  })

  it("rejects a non-integer limit, so no float reaches the store", () => {
    for (const limit of [250.5, 0.01, 1e-3]) {
      const result = parseCardInput({ ...valid, limit })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.field).toBe("limit")
    }
  })

  it("rejects a limit sent as a decimal string, because the API speaks minor units", () => {
    const result = parseCardInput({ ...valid, limit: "250.00" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.field).toBe("limit")
  })

  it("rejects a currency outside the allowlist", () => {
    for (const currency of ["XYZ", "usd", "", null, 1]) {
      const result = parseCardInput({ ...valid, currency })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.field).toBe("currency")
    }
  })

  it("names a field on every rejection, so the caller can point at the input", () => {
    const bad = [
      { ...valid, merchantId: "" },
      { ...valid, nickname: "" },
      { ...valid, limit: 0 },
      { ...valid, currency: "XYZ" },
    ]
    for (const body of bad) {
      const result = parseCardInput(body)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.field).toBeTruthy()
        expect(result.error.message).toBeTruthy()
      }
    }
  })
})

describe("parseCardInput — acceptance", () => {
  it("accepts a valid record and trims the strings", () => {
    const result = parseCardInput({
      ...valid,
      nickname: "  Contractor tools  ",
      merchantId: " mch_01 ",
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.nickname).toBe("Contractor tools")
      expect(result.value.merchantId).toBe("mch_01")
    }
  })

  it("accepts each allowed currency", () => {
    for (const currency of ["USD", "EUR", "GBP"]) {
      expect(parseCardInput({ ...valid, currency }).ok).toBe(true)
    }
  })

  it("accepts the boundary limits, 1 and the cap", () => {
    expect(parseCardInput({ ...valid, limit: 1 }).ok).toBe(true)
    expect(parseCardInput({ ...valid, limit: MAX_CARD_LIMIT }).ok).toBe(true)
  })

  it("accepts a currency that differs from the merchant's own", () => {
    // Decision 1 in the spec: the server checks the allowlist only, so a
    // valid cross-currency post cannot fail.
    expect(parseCardInput({ ...valid, currency: "GBP" }).ok).toBe(true)
  })
})

describe("createCard", () => {
  it("adds one card to the store and returns the number beside it", () => {
    const before = store.cards.length
    const { card, number } = issue({ nickname: "Store growth check" })
    expect(store.cards.length).toBe(before + 1)
    expect(number).toMatch(/^4242\d{12}$/)
    expect(card.last4).toBe(number.slice(-4))
  })

  it("never puts the number on the record", () => {
    const { card } = issue({ nickname: "No PAN on record" })
    expect(card).not.toHaveProperty("number")
    expect(JSON.stringify(card)).not.toContain("4242424")
  })

  it("issues active at zero spend with one opening event", () => {
    const { card } = issue({ nickname: "Fresh card" })
    expect(card.status).toBe("active")
    expect(card.spend).toBe(0)
    expect(card.events).toHaveLength(1)
    expect(card.events[0].status).toBe("active")
  })

  it("gives each card a distinct id in the pay_000001 shape", () => {
    const a = issue({ nickname: "Distinct A" }).card
    const b = issue({ nickname: "Distinct B" }).card
    expect(a.id).not.toBe(b.id)
    expect(a.id).toMatch(/^card_\d{6}$/)
  })

  it("stores the limit as the integer it was given", () => {
    const { card } = issue({ nickname: "Integer limit", limit: 123_456 })
    expect(card.limit).toBe(123_456)
    expect(Number.isInteger(card.limit)).toBe(true)
  })
})

describe("cardById", () => {
  it("finds a card it just created", () => {
    const { card } = issue({ nickname: "Findable" })
    expect(cardById(card.id)).toBe(card)
  })

  it("returns undefined for an unknown id", () => {
    expect(cardById("card_999999")).toBeUndefined()
  })
})

describe("listCards", () => {
  it("returns newest first", () => {
    const dates = listCards().map((c) => c.createdAt)
    const sorted = [...dates].sort((a, b) => b.localeCompare(a))
    expect(dates).toEqual(sorted)
  })

  it("filters to one status", () => {
    const frozen = listCards("frozen")
    expect(frozen.length).toBeGreaterThan(0)
    expect(frozen.every((c) => c.status === "frozen")).toBe(true)
  })

  it("does not hand out the store's own array", () => {
    const listed = listCards()
    expect(listed).not.toBe(store.cards)
  })
})

describe("parseCardStatusFilter", () => {
  it("passes through a real status", () => {
    expect(parseCardStatusFilter("frozen")).toBe("frozen")
  })

  it("falls back to all for anything else", () => {
    for (const value of ["lost", "ACTIVE", "", null]) {
      expect(parseCardStatusFilter(value)).toBe("all")
    }
  })
})

describe("setCardStatus", () => {
  it("freezes an active card and records the event", () => {
    const { card } = issue({ nickname: "Freeze me" })
    const result = setCardStatus(card.id, "frozen")
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.card.status).toBe("frozen")
      expect(result.card.events.at(-1)?.status).toBe("frozen")
    }
  })

  it("unfreezes back to active", () => {
    const { card } = issue({ nickname: "Round trip" })
    setCardStatus(card.id, "frozen")
    expect(setCardStatus(card.id, "active").ok).toBe(true)
  })

  it("refuses to reverse a cancelled card, and says why", () => {
    const { card } = issue({ nickname: "Terminal" })
    setCardStatus(card.id, "cancelled")
    const result = setCardStatus(card.id, "active")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe("illegal_transition")
      if (result.reason === "illegal_transition") {
        expect(result.from).toBe("cancelled")
      }
    }
  })

  it("reports an unknown card separately from an illegal move", () => {
    const result = setCardStatus("card_999999", "frozen")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("not_found")
  })

  it("leaves the card untouched when it refuses", () => {
    const { card } = issue({ nickname: "Untouched" })
    setCardStatus(card.id, "cancelled")
    const events = card.events.length
    setCardStatus(card.id, "active")
    expect(card.status).toBe("cancelled")
    expect(card.events).toHaveLength(events)
  })
})
