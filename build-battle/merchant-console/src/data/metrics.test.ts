import { describe, expect, it } from "vitest"
import { utcDayKey } from "@/lib/dates"
import { dailyVolume } from "./metrics"
import { store } from "./store"

/**
 * These assert the ORG standards the module is measured against: bucket in
 * UTC (#4) and keep money in integer minor units (#1).
 */
describe("dailyVolume", () => {
  it("buckets a payment on its UTC date, not the server's local one", () => {
    // 02:30 UTC is the previous calendar day in any negative-offset zone, and
    // the next one in a far-eastern zone. Only a UTC bucket is stable.
    const captured = store.payments.filter((p) => p.status === "captured")
    const rows = dailyVolume(120)
    const byDate = new Map(rows.map((r) => [r.date, r]))

    const expected = new Map<string, number>()
    for (const payment of captured) {
      const key = utcDayKey(payment.createdAt)
      if (!byDate.has(key)) continue
      expected.set(key, (expected.get(key) ?? 0) + payment.amount)
    }

    for (const [date, total] of expected) {
      expect(byDate.get(date)!.captured).toBe(total)
    }
  })

  it("reports every bucket as an integer number of minor units", () => {
    for (const row of dailyVolume(30)) {
      expect(Number.isInteger(row.captured)).toBe(true)
      expect(Number.isInteger(row.refunded)).toBe(true)
    }
  })

  it("returns one row per requested day, oldest first", () => {
    const rows = dailyVolume(30)
    expect(rows).toHaveLength(30)
    const dates = rows.map((r) => r.date)
    expect([...dates].sort()).toEqual(dates)
  })

  it("totals across all buckets equal the sum of the payments in range", () => {
    const rows = dailyVolume(120)
    const dates = new Set(rows.map((r) => r.date))
    const expected = store.payments
      .filter(
        (p) => p.status === "captured" && dates.has(utcDayKey(p.createdAt)),
      )
      .reduce((sum, p) => sum + p.amount, 0)
    const actual = rows.reduce((sum, r) => sum + r.captured, 0)
    expect(actual).toBe(expected)
  })
})
