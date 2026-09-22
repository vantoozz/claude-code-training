import { setCardStatus } from "@/data/cards"
import { isCardStatus } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Change a card's status.
 *
 * The status is checked against the allowlist here and the transition is
 * guarded in src/data/cards.ts, so a crafted request cannot step outside the
 * state machine however the UI behaves.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { message: "Send a JSON body.", field: "body" } },
      { status: 400 },
    )
  }

  const status =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).status
      : undefined

  if (!isCardStatus(status)) {
    return NextResponse.json(
      {
        error: {
          message: "Status must be active, frozen, or cancelled.",
          field: "status",
        },
      },
      { status: 400 },
    )
  }

  const result = setCardStatus(id, status)
  if (result.ok) return NextResponse.json({ card: result.card })

  if (result.reason === "not_found") {
    return NextResponse.json(
      { error: { message: "No card with that id.", field: "id" } },
      { status: 404 },
    )
  }

  return NextResponse.json(
    {
      error: {
        message: `A ${result.from} card cannot become ${status}.`,
        field: "status",
      },
    },
    { status: 409 },
  )
}
