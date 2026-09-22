"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import * as React from "react"

/**
 * Freeze and unfreeze from the list. The PATCH is the enforcement; this only
 * offers the move the state machine already allows, and refreshes rather than
 * reloading so the operator keeps their filter and scroll position.
 */
export function CardStatusActions({
  cardId,
  status,
  nickname,
}: {
  cardId: string
  status: CardStatus
  nickname: string
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // cancelled is terminal, so there is nothing to offer.
  if (status === "cancelled") {
    return <span className="text-sm text-gray-400">—</span>
  }

  const next: CardStatus = status === "active" ? "frozen" : "active"
  const label = status === "active" ? "Freeze" : "Unfreeze"

  async function change() {
    if (pending) return
    setPending(true)
    setError(null)

    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setError(payload?.error?.message ?? "That change was refused.")
        return
      }

      router.refresh()
    } catch {
      setError("The console could not reach the server.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant="secondary"
        className="py-1 text-xs"
        onClick={change}
        disabled={pending}
        aria-label={`${label} ${nickname}`}
      >
        {pending ? "Saving…" : label}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
