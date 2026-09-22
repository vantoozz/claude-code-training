"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/Select"
import { CARD_STATUSES } from "@/lib/cards"
import { useRouter } from "next/navigation"

/** The status filter, following payments/filter-bar.tsx. */
export function CardsFilterBar({ current }: { current: string }) {
  const router = useRouter()

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <label htmlFor="card-status" className="text-sm text-gray-500">
        Status
      </label>
      <Select
        value={current}
        onValueChange={(value) => {
          router.push(value === "all" ? "/cards" : `/cards?status=${value}`)
        }}
      >
        <SelectTrigger id="card-status" className="w-full sm:w-44">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {CARD_STATUSES.map((status) => (
            <SelectItem key={status} value={status} className="capitalize">
              {status}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
