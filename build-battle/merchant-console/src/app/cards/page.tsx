import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@/components/Table"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { listCards, parseCardStatusFilter } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { formatDate } from "@/lib/dates"
import { maskCard } from "@/lib/cards"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { CardsFilterBar } from "./filter-bar"

/** Reads the store directly, as payments/page.tsx does. */
export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const filter = parseCardStatusFilter(params.status ?? null)
  const cards = listCards(filter)

  return (
    <section aria-label="Cards">
      <div className="flex flex-col justify-between gap-2 px-4 py-6 sm:flex-row sm:items-center sm:p-6">
        <CardsFilterBar current={filter} />
      </div>

      <TableRoot className="border-t border-gray-200 dark:border-gray-800">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Nickname</TableHeaderCell>
              <TableHeaderCell>Merchant</TableHeaderCell>
              <TableHeaderCell>Number</TableHeaderCell>
              <TableHeaderCell>Created</TableHeaderCell>
              <TableHeaderCell className="text-right">Spend limit</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cards.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-16 text-center">
                  <p className="font-medium text-gray-900 dark:text-gray-50">
                    No {filter === "all" ? "" : filter} cards yet
                  </p>
                  <p className="mt-1 text-gray-500">
                    {filter === "all"
                      ? "Issue one and it will appear here."
                      : "Pick a different status, or issue a card."}
                  </p>
                </TableCell>
              </TableRow>
            )}
            {cards.map((card) => {
              const merchant = merchantById(card.merchantId)
              return (
                <TableRow key={card.id}>
                  <TableCell>
                    <Link
                      href={`/cards/${card.id}`}
                      className="font-medium text-blue-600 hover:underline dark:text-blue-500"
                    >
                      {card.nickname}
                    </Link>
                  </TableCell>
                  <TableCell>{merchant?.name}</TableCell>
                  <TableCell className="tabular-nums text-gray-500">
                    {maskCard(card.last4)}
                  </TableCell>
                  <TableCell>{formatDate(card.createdAt)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
                    {formatMoney(card.limit, card.currency)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={card.status} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableRoot>

      <div className="px-4 py-4 sm:px-6">
        <p className="text-sm text-gray-500">
          {cards.length.toLocaleString()}{" "}
          {cards.length === 1 ? "card" : "cards"}
          {filter === "all" ? "" : ` with status ${filter}`}
        </p>
      </div>
    </section>
  )
}
