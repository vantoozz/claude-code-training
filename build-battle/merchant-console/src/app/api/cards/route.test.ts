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
