import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { isLuhnValid } from "@/lib/cards"
import { store } from "@/data/store"
import { POST } from "./route"

function post(body: unknown, raw?: string) {
  return new NextRequest("http://localhost/api/cards", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body),
  })
}

describe("POST /api/cards", () => {
  it("returns 201 with the card and the number beside it", async () => {
    const before = store.cards.length
    const response = await POST(
      post({
        merchantId: "mch_01",
        nickname: "Route test",
        limit: 25_000,
        currency: "USD",
      }),
    )
    expect(response.status).toBe(201)

    const payload = await response.json()
    expect(store.cards.length).toBe(before + 1)
    expect(payload.number).toMatch(/^4242\d{12}$/)
    expect(isLuhnValid(payload.number)).toBe(true)
    expect(payload.card.last4).toBe(payload.number.slice(-4))
  })

  it("never puts the number on the card in the response", async () => {
    const response = await POST(
      post({
        merchantId: "mch_01",
        nickname: "No PAN on card",
        limit: 1_000,
        currency: "USD",
      }),
    )
    const payload = await response.json()
    expect(payload.card).not.toHaveProperty("number")
    expect(JSON.stringify(payload.card)).not.toContain(payload.number)
  })

  it("rejects each invalid field with 400 and names it", async () => {
    const cases = [
      { body: { nickname: "x", limit: 1, currency: "USD" }, field: "merchantId" },
      { body: { merchantId: "mch_01", nickname: "", limit: 1, currency: "USD" }, field: "nickname" },
      { body: { merchantId: "mch_01", nickname: "x", limit: 0, currency: "USD" }, field: "limit" },
      { body: { merchantId: "mch_01", nickname: "x", limit: -1, currency: "USD" }, field: "limit" },
      { body: { merchantId: "mch_01", nickname: "x", limit: 5_000_001, currency: "USD" }, field: "limit" },
      { body: { merchantId: "mch_01", nickname: "x", limit: "250.00", currency: "USD" }, field: "limit" },
      { body: { merchantId: "mch_01", nickname: "x", limit: 1, currency: "XYZ" }, field: "currency" },
      { body: { merchantId: "mch_01", nickname: "x", limit: 1, currency: "GBP" }, field: "currency" },
    ]

    for (const { body, field } of cases) {
      const response = await POST(post(body))
      expect(response.status).toBe(400)
      const payload = await response.json()
      expect(payload.error.field).toBe(field)
      expect(payload.error.message).toBeTruthy()
    }
  })

  it("does not write to the store when it rejects", async () => {
    const before = store.cards.length
    await POST(post({ merchantId: "mch_01", nickname: "", limit: 0, currency: "XYZ" }))
    expect(store.cards.length).toBe(before)
  })

  it("returns 400 rather than throwing on a body that is not JSON", async () => {
    const response = await POST(post(null, "not json at all"))
    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.error.field).toBe("body")
  })
})

describe("POST /api/cards — idempotency", () => {
  function postWithKey(key: string, nickname: string) {
    return POST(
      new NextRequest("http://localhost/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": key },
        body: JSON.stringify({
          merchantId: "mch_01",
          nickname,
          limit: 25_000,
          currency: "USD",
          category: "software",
        }),
      }),
    )
  }

  it("mints one card for a replayed key, not two", async () => {
    const key = "key-replay-once"
    const before = store.cards.length

    const first = await postWithKey(key, "Idempotent first")
    const second = await postWithKey(key, "Idempotent second")

    expect(first.status).toBe(201)
    expect(second.status).toBe(200)
    expect(store.cards.length).toBe(before + 1)

    const a = await first.json()
    const b = await second.json()
    expect(b.card.id).toBe(a.card.id)
    expect(b.card.nickname).toBe("Idempotent first")
  })

  it("does not reveal the number again on a replay", async () => {
    const key = "key-no-second-reveal"
    const first = await postWithKey(key, "Reveal once only")
    const second = await postWithKey(key, "Reveal once only")

    expect((await first.json()).number).toMatch(/^4242\d{12}$/)
    expect(await second.json()).not.toHaveProperty("number")
  })

  it("treats a different key as a different card", async () => {
    const a = await postWithKey("key-distinct-a", "Distinct key A")
    const b = await postWithKey("key-distinct-b", "Distinct key B")
    expect((await a.json()).card.id).not.toBe((await b.json()).card.id)
  })

  it("still issues when no key is sent at all", async () => {
    const response = await POST(
      post({
        merchantId: "mch_01",
        nickname: "No key sent",
        limit: 1_000,
        currency: "USD",
        category: "other",
      }),
    )
    expect(response.status).toBe(201)
    expect((await response.json()).number).toMatch(/^4242\d{12}$/)
  })
})
