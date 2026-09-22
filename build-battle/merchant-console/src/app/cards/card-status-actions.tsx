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
  /** Cancelling is terminal, so it takes two deliberate clicks. */
  const [confirming, setConfirming] = React.useState(false)

  // cancelled is terminal, so there is nothing to offer.
  if (status === "cancelled") {
    return <span className="text-sm text-gray-400">—</span>
  }

  const next: CardStatus = status === "active" ? "frozen" : "active"
  const label = status === "active" ? "Freeze" : "Unfreeze"

  async function change(to: CardStatus) {
    if (pending) return
    setPending(true)
    setError(null)

    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: to }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setError(payload?.error?.message ?? "That change was refused.")
        return
      }

      setConfirming(false)
      router.refresh()
    } catch {
      setError("The console could not reach the server.")
    } finally {
      setPending(false)
    }
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-start gap-1">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Cancel for good?
        </p>
        <div className="flex gap-2">
          <Button
            variant="destructive"
            className="py-1 text-xs"
            onClick={() => change("cancelled")}
            disabled={pending}
            aria-label={`Confirm cancelling ${nickname}`}
          >
            {pending ? "Cancelling…" : "Yes, cancel"}
          </Button>
          <Button
            variant="ghost"
            className="py-1 text-xs"
            onClick={() => setConfirming(false)}
            disabled={pending}
            aria-label={`Keep ${nickname}`}
          >
            Keep
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-xs text-red-600">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="py-1 text-xs"
          onClick={() => change(next)}
          disabled={pending}
          aria-label={`${label} ${nickname}`}
        >
          {pending ? "Saving…" : label}
        </Button>
        <Button
          variant="ghost"
          className="py-1 text-xs"
          onClick={() => setConfirming(true)}
          disabled={pending}
          aria-label={`Cancel ${nickname}`}
        >
          Cancel
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
