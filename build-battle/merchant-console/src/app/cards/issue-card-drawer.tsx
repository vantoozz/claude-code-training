"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import { Input } from "@/components/Input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { Currency } from "@/data/types"
import { useRouter } from "next/navigation"
import * as React from "react"

interface MerchantOption {
  id: string
  name: string
  currency: Currency
}

interface Issued {
  number: string
  nickname: string
  last4: string
  limit: number
  currency: Currency
}

/**
 * Issue a card, then reveal its number exactly once.
 *
 * The number lives in state inside the drawer content, which Radix unmounts on
 * close, and onOpenChange clears it as well. Either way it is gone once the
 * drawer shuts, and no later request can produce it.
 */
export function IssueCardDrawer({
  merchants,
}: {
  merchants: MerchantOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [issued, setIssued] = React.useState<Issued | null>(null)

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        // Every close path runs through here, including the Done button and
        // Escape, so the revealed number is discarded exactly once and is not
        // recoverable. A second close path is how it leaked before.
        if (!next) setIssued(null)
      }}
    >
      <DrawerTrigger asChild>
        <Button className="w-full py-1.5 sm:w-fit">Issue a card</Button>
      </DrawerTrigger>
      <DrawerContent className="sm:max-w-lg">
        {issued ? (
          <RevealPanel issued={issued} />
        ) : (
          <IssueForm
            merchants={merchants}
            onIssued={(next) => {
              setIssued(next)
              // The list is current before anyone closes the drawer.
              router.refresh()
            }}
          />
        )}
      </DrawerContent>
    </Drawer>
  )
}

function IssueForm({
  merchants,
  onIssued,
}: {
  merchants: MerchantOption[]
  onIssued: (issued: Issued) => void
}) {
  const [merchantId, setMerchantId] = React.useState("")
  const [nickname, setNickname] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [currency, setCurrency] = React.useState<Currency | null>(null)
  const [error, setError] = React.useState<{
    message: string
    field: string
  } | null>(null)
  const [sending, setSending] = React.useState(false)

  /** The client converts once, at the boundary. The API speaks minor units. */
  const limit = parseAmountToMinorUnits(amount)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (sending) return

    if (!currency) {
      setError({ message: "Pick a merchant first.", field: "merchantId" })
      return
    }

    if (limit === null) {
      setError({
        message: "Enter an amount like 250 or 250.00.",
        field: "limit",
      })
      return
    }

    setSending(true)
    setError(null)

    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ merchantId, nickname, limit, currency }),
      })
      const payload = await response.json()

      if (!response.ok) {
        setError(
          payload?.error ?? {
            message: "The card could not be issued. Try again.",
            field: "form",
          },
        )
        return
      }

      onIssued({
        number: payload.number,
        nickname: payload.card.nickname,
        last4: payload.card.last4,
        limit: payload.card.limit,
        currency: payload.card.currency,
      })
    } catch {
      setError({
        message: "The console could not reach the server.",
        field: "form",
      })
    } finally {
      setSending(false)
    }
  }

  const fieldError = (field: string) =>
    error?.field === field ? error.message : null

  return (
    <form onSubmit={submit}>
      <DrawerHeader>
        <DrawerTitle>Issue a virtual card</DrawerTitle>
        <DrawerDescription>
          Single-merchant, always virtual, with a limit from the moment it
          exists.
        </DrawerDescription>
      </DrawerHeader>

      <DrawerBody className="space-y-4">
        <div>
          <label
            htmlFor="card-nickname"
            className="text-sm font-medium text-gray-900 dark:text-gray-50"
          >
            Nickname
          </label>
          <Input
            id="card-nickname"
            name="nickname"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="Ad spend — Meta"
            maxLength={40}
            className="mt-2"
            aria-invalid={Boolean(fieldError("nickname"))}
            aria-describedby={
              fieldError("nickname") ? "card-nickname-error" : undefined
            }
          />
          {fieldError("nickname") && (
            <p id="card-nickname-error" className="mt-1 text-sm text-red-600">
              {fieldError("nickname")}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="card-merchant"
            className="text-sm font-medium text-gray-900 dark:text-gray-50"
          >
            Merchant
          </label>
          <Select
            value={merchantId}
            onValueChange={(next) => {
              setMerchantId(next)
              // Preselect the merchant's own currency; the operator may change it.
              const merchant = merchants.find((m) => m.id === next)
              if (merchant) setCurrency(merchant.currency)
            }}
          >
            <SelectTrigger
              id="card-merchant"
              className="mt-2"
              aria-invalid={Boolean(fieldError("merchantId"))}
            >
              <SelectValue placeholder="Pick a merchant" />
            </SelectTrigger>
            <SelectContent>
              {merchants.map((merchant) => (
                <SelectItem key={merchant.id} value={merchant.id}>
                  {merchant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldError("merchantId") && (
            <p className="mt-1 text-sm text-red-600">
              {fieldError("merchantId")}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label
              htmlFor="card-limit"
              className="text-sm font-medium text-gray-900 dark:text-gray-50"
            >
              Spend limit
            </label>
            <Input
              id="card-limit"
              name="limit"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="250.00"
              className="mt-2"
              aria-invalid={Boolean(fieldError("limit"))}
              aria-describedby={
                fieldError("limit") ? "card-limit-error" : undefined
              }
            />
            {fieldError("limit") && (
              <p id="card-limit-error" className="mt-1 text-sm text-red-600">
                {fieldError("limit")}
              </p>
            )}
          </div>

          <div className="w-32">
            <label
              htmlFor="card-currency"
              className="text-sm font-medium text-gray-900 dark:text-gray-50"
            >
              Currency
            </label>
            {/*
              Derived from the merchant, not chosen. A card settles against its
              merchant, so offering a currency the server will reject is a form
              that lies. The server verifies the match regardless.
            */}
            <Input
              id="card-currency"
              name="currency"
              value={currency ?? ""}
              readOnly
              aria-readonly="true"
              placeholder="—"
              className="mt-2 tabular-nums"
              aria-describedby="card-currency-hint"
            />
            <p id="card-currency-hint" className="mt-1 text-xs text-gray-500">
              Set by the merchant
            </p>
          </div>
        </div>

        {error && error.field === "form" && (
          <p role="alert" className="text-sm text-red-600">
            {error.message}
          </p>
        )}
      </DrawerBody>

      <DrawerFooter>
        <Button type="submit" disabled={sending} className="w-full">
          {sending ? "Issuing…" : "Issue card"}
        </Button>
      </DrawerFooter>
    </form>
  )
}

/** The one place a full card number is ever shown. */
function RevealPanel({ issued }: { issued: Issued }) {
  return (
    <>
      <DrawerHeader>
        <DrawerTitle>{issued.nickname} is live</DrawerTitle>
        <DrawerDescription>
          This is the only time the full number is shown. Copy it now — the
          console keeps the last four and nothing else.
        </DrawerDescription>
      </DrawerHeader>

      <DrawerBody className="space-y-4">
        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500">Card number</p>
          <p className="mt-1 font-mono text-lg tabular-nums text-gray-900 dark:text-gray-50">
            {issued.number}
          </p>
        </div>
        <p className="text-sm text-gray-500">
          Spend limit {formatMoney(issued.limit, issued.currency)} · masked
          everywhere else as •••• {issued.last4}
        </p>
      </DrawerBody>

      <DrawerFooter>
        <DrawerClose asChild>
          <Button className="w-full">Done</Button>
        </DrawerClose>
      </DrawerFooter>
    </>
  )
}
