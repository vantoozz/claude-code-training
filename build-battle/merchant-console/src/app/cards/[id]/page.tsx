import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { formatInZone } from "@/lib/dates"
import { maskCard } from "@/lib/cards"
import { cx } from "@/lib/utils"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { notFound } from "next/navigation"

export default async function CardDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)!
  const remaining = card.limit - card.spend

  return (
    <div className="p-4 sm:p-6">
      <Link
        href="/cards"
        className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-50"
      >
        ← All cards
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
          {card.nickname}
        </h1>
        <StatusBadge status={card.status} />
      </div>
      <p className="mt-1 font-mono text-sm text-gray-500">{card.id}</p>

      <Divider />

      <SpendBar spend={card.spend} limit={card.limit} currency={card.currency} />

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant.name}
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </Field>
        <Field label="Number">
          <span className="tabular-nums">{maskCard(card.last4)}</span>
        </Field>
        <Field label="Currency">{card.currency}</Field>
        <Field label="Spend limit">
          {formatMoney(card.limit, card.currency)}
        </Field>
        <Field label="Spent">{formatMoney(card.spend, card.currency)}</Field>
        <Field label="Remaining">
          {formatMoney(remaining, card.currency)}
        </Field>
        <Field label="Issued (UTC)">
          <span className="font-mono text-sm">{card.createdAt}</span>
        </Field>
        <Field label={`Issued (${merchant.timezone})`}>
          {formatInZone(card.createdAt, merchant.timezone)}
        </Field>
      </dl>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Status history
      </h2>
      <ol className="mt-4 space-y-4">
        {card.events.map((event, index) => (
          <li key={index} className="flex gap-3">
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm capitalize text-gray-900 dark:text-gray-50">
                {index === 0 ? "Issued — active" : event.status}
              </p>
              <p className="text-sm text-gray-500">
                {formatInZone(event.at, merchant.timezone)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

/**
 * Spend against the limit. Amber past 80% so someone scanning the page sees a
 * card about to run out before the operator calls about it.
 */
function SpendBar({
  spend,
  limit,
  currency,
}: {
  spend: number
  limit: number
  currency: "USD" | "EUR" | "GBP"
}) {
  const percent = limit > 0 ? Math.min(100, (spend / limit) * 100) : 0
  const near = percent >= 80

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
          Spend against limit
        </h2>
        <p className="text-sm tabular-nums text-gray-500">
          {formatMoney(spend, currency)} of {formatMoney(limit, currency)} ·{" "}
          {Math.round(percent)}%
        </p>
      </div>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Spend is ${Math.round(percent)} percent of the limit`}
      >
        <div
          className={cx(
            "h-full rounded-full",
            near ? "bg-amber-500" : "bg-emerald-600 dark:bg-emerald-500",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      {near && (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-500">
          Past 80% of the limit.
        </p>
      )}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">
        {children}
      </dd>
    </div>
  )
}
