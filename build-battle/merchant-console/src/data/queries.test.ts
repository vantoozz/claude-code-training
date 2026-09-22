import { describe, expect, it } from "vitest"
import { Payment } from "./types"
import { sortPayments } from "./queries"

function payment(amount: number, createdAt: string): Payment {
  return {
    id: `pay_${amount}`,
    merchantId: "mch_01",
    amount,
    currency: "USD",
    status: "captured",
    method: "card",
    cardBrand: "visa",
    last4: "4242",
    createdAt,
    description: "Test",
  }
}

describe("sortPayments by amount", () => {
  const amounts = [90_000, 4_500, 120_000, 900, 1_000]
  const payments = amounts.map((a, i) =>
    payment(a, `2026-08-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`),
  )

  it("orders ascending by value, not by digit string", () => {
    const sorted = sortPayments(payments, "amount", "asc")
    expect(sorted.map((p) => p.amount)).toEqual([
      900, 1_000, 4_500, 90_000, 120_000,
    ])
  })

  it("orders descending by value", () => {
    const sorted = sortPayments(payments, "amount", "desc")
    expect(sorted.map((p) => p.amount)).toEqual([
      120_000, 90_000, 4_500, 1_000, 900,
    ])
  })

  it("puts the largest amount first when sorted descending", () => {
    const sorted = sortPayments(payments, "amount", "desc")
    expect(sorted[0].amount).toBe(Math.max(...amounts))
  })

  it("does not mutate the array it was given", () => {
    const original = [...payments]
    sortPayments(payments, "amount", "asc")
    expect(payments).toEqual(original)
  })
})

describe("sortPayments by createdAt", () => {
  const payments = [
    payment(100, "2026-08-03T00:00:00.000Z"),
    payment(200, "2026-08-01T00:00:00.000Z"),
    payment(300, "2026-08-02T00:00:00.000Z"),
  ]

  it("orders newest first by default", () => {
    const sorted = sortPayments(payments)
    expect(sorted.map((p) => p.createdAt.slice(8, 10))).toEqual(["03", "02", "01"])
  })

  it("orders oldest first ascending", () => {
    const sorted = sortPayments(payments, "createdAt", "asc")
    expect(sorted.map((p) => p.createdAt.slice(8, 10))).toEqual(["01", "02", "03"])
  })
})
