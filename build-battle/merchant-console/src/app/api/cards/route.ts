import { createCard, parseCardInput } from "@/data/cards"
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
  return NextResponse.json({ card, number }, { status: 201 })
}
