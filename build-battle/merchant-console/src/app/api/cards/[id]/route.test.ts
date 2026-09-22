import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { createCard } from "@/data/cards"
import { PATCH } from "./route"

function patch(id: string, body: unknown) {
  const request = new NextRequest(`http://localhost/api/cards/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  return PATCH(request, { params: Promise.resolve({ id }) })
}

/** A fresh card per test, so no test depends on another's mutations. */
function issue(nickname: string) {
  return createCard({
    merchantId: "mch_01",
    nickname,
    limit: 25_000,
    currency: "USD",
    category: "other",
  }).card
}

describe("PATCH /api/cards/[id]", () => {
  it("freezes an active card and appends the event", async () => {
    const card = issue("Route freeze")
    const response = await patch(card.id, { status: "frozen" })
    expect(response.status).toBe(200)

    const payload = await response.json()
    expect(payload.card.status).toBe("frozen")
    expect(payload.card.events.at(-1).status).toBe("frozen")
  })

  it("unfreezes back to active", async () => {
    const card = issue("Route unfreeze")
    await patch(card.id, { status: "frozen" })
    const response = await patch(card.id, { status: "active" })
    expect(response.status).toBe(200)
  })

  it("returns 409 on a move the state machine refuses", async () => {
    const card = issue("Route terminal")
    await patch(card.id, { status: "cancelled" })

    const response = await patch(card.id, { status: "active" })
    expect(response.status).toBe(409)
    const payload = await response.json()
    expect(payload.error.message).toContain("cancelled")
  })

  it("returns 404 for a card that does not exist", async () => {
    const response = await patch("card_999999", { status: "frozen" })
    expect(response.status).toBe(404)
    expect((await response.json()).error.field).toBe("id")
  })

  it("returns 400 for a status outside the allowlist", async () => {
    const card = issue("Route bogus status")
    for (const status of ["lost", "ACTIVE", "", null, 7]) {
      const response = await patch(card.id, { status })
      expect(response.status).toBe(400)
      expect((await response.json()).error.field).toBe("status")
    }
  })

  it("leaves the card untouched when it refuses", async () => {
    const card = issue("Route untouched")
    await patch(card.id, { status: "cancelled" })
    const events = card.events.length

    await patch(card.id, { status: "active" })
    expect(card.status).toBe("cancelled")
    expect(card.events).toHaveLength(events)
  })
})
