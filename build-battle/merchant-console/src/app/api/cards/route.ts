import {
  cardForIssueKey,
  createCard,
  parseCardInput,
  rememberIssueKey,
} from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Issue a card.
 *
 * This is the one response in the application that carries a full card
 * number. It sits beside the record rather than on it, so nothing that reads
 * a Card later can produce it.
 *
 * Limits arrive as integer minor units. The client converts what the operator
 * typed before it posts; this handler does not parse money.
 */
export async function POST(request: NextRequest) {
  /**
   * A replayed key returns the card that key already made, with no number.
   * Checked before the body is read, so a retry costs nothing.
   */
  const idempotencyKey = request.headers.get("idempotency-key")?.trim()
  if (idempotencyKey) {
    const existing = cardForIssueKey(idempotencyKey)
    if (existing) return NextResponse.json({ card: existing }, { status: 200 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { message: "Send a JSON body.", field: "body" } },
      { status: 400 },
    )
  }

  const parsed = parseCardInput(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { card, number } = createCard(parsed.value)
  if (idempotencyKey) rememberIssueKey(idempotencyKey, card.id)
  return NextResponse.json({ card, number }, { status: 201 })
}
