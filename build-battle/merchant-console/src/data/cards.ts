import {
  canTransition,
  generateCardNumber,
  isCardCategory,
  isCardStatus,
  last4Of,
} from "@/lib/cards"
import { isCurrency } from "@/lib/money"
import { pad } from "./generate"
import { merchantById } from "./merchants"
import { store } from "./store"
import { Card, CardCategory, CardStatus, Currency } from "./types"

/**
 * Allowlist parsing and store mutations for cards. The same split queries.ts
 * uses for payments: validation lives here, the route handler just calls it.
 *
 * Limits arrive as integer minor units. The client converts a typed "250.00"
 * with parseAmountToMinorUnits before it posts; this layer never parses money.
 */

export const MAX_CARD_LIMIT = 5_000_000
export const MAX_NICKNAME_LENGTH = 40

export interface CardInput {
  merchantId: string
  nickname: string
  /** Integer minor units. */
  limit: number
  currency: Currency
  category: CardCategory
}

/** One error shape everywhere: a message safe to show, and the field at fault. */
export interface CardError {
  message: string
  field: string
}

export type ParsedCardInput =
  | { ok: true; value: CardInput }
  | { ok: false; error: CardError }

const invalid = (message: string, field: string): ParsedCardInput => ({
  ok: false,
  error: { message, field },
})

/**
 * Reject early and return. Everything the client sent is checked before any of
 * it reaches the store.
 */
export function parseCardInput(body: unknown): ParsedCardInput {
  if (typeof body !== "object" || body === null) {
    return invalid("Send a JSON object.", "body")
  }
  const input = body as Record<string, unknown>

  const merchantId =
    typeof input.merchantId === "string" ? input.merchantId.trim() : ""
  if (!merchantId) return invalid("Pick a merchant.", "merchantId")
  const merchant = merchantById(merchantId)
  if (!merchant) {
    return invalid("That merchant does not exist.", "merchantId")
  }

  const nickname =
    typeof input.nickname === "string" ? input.nickname.trim() : ""
  if (!nickname) return invalid("Give the card a nickname.", "nickname")
  if (nickname.length > MAX_NICKNAME_LENGTH) {
    return invalid(
      `Keep the nickname to ${MAX_NICKNAME_LENGTH} characters or fewer.`,
      "nickname",
    )
  }

  const { limit } = input
  if (typeof limit !== "number" || !Number.isInteger(limit)) {
    return invalid(
      "The spend limit must be a whole number of minor units.",
      "limit",
    )
  }
  if (limit < 1) return invalid("The spend limit must be above zero.", "limit")
  if (limit > MAX_CARD_LIMIT) {
    return invalid(
      `The spend limit cannot exceed ${MAX_CARD_LIMIT} minor units.`,
      "limit",
    )
  }

  if (!isCurrency(input.currency)) {
    return invalid("Pick USD, EUR, or GBP.", "currency")
  }

  /**
   * A card settles against its merchant, so a currency the merchant does not
   * trade in produces a balance nobody can reconcile. The form derives this
   * from the chosen merchant; the server verifies it anyway.
   */
  if (input.currency !== merchant.currency) {
    return invalid(
      `${merchant.name} settles in ${merchant.currency}, so the card cannot be issued in ${input.currency}.`,
      "currency",
    )
  }

  /**
   * A missing category is not a rejection. It defaults to other, so a client
   * that never sends one can still issue a card; anything sent that is not on
   * the allowlist is still refused.
   */
  if (input.category !== undefined && !isCardCategory(input.category)) {
    return invalid(
      `Category must be one of advertising, software, contractors, travel, other.`,
      "category",
    )
  }
  const category: CardCategory = isCardCategory(input.category)
    ? input.category
    : "other"

  return {
    ok: true,
    value: { merchantId, nickname, limit, currency: input.currency, category },
  }
}

/** Highest existing suffix plus one, so an id is never reused. */
function nextCardId(): string {
  const highest = store.cards.reduce((max, card) => {
    const suffix = Number(card.id.replace("card_", ""))
    return Number.isFinite(suffix) && suffix > max ? suffix : max
  }, 0)
  return `card_${pad(highest + 1)}`
}

/**
 * The number is returned beside the record rather than on it, so the Card type
 * never carries one and no later read can produce it.
 */
export function createCard(input: CardInput): { card: Card; number: string } {
  const number = generateCardNumber()
  const createdAt = new Date().toISOString()

  const card: Card = {
    id: nextCardId(),
    merchantId: input.merchantId,
    nickname: input.nickname,
    limit: input.limit,
    spend: 0,
    currency: input.currency,
    status: "active",
    category: input.category,
    last4: last4Of(number),
    createdAt,
    events: [{ status: "active", at: createdAt }],
  }

  store.cards.push(card)
  return { card, number }
}

export const cardById = (id: string) => store.cards.find((c) => c.id === id)

/**
 * The card a previous request with this key already created, if any.
 *
 * A double-click or a retry after a timeout replays the same key, and the
 * caller answers with the existing card rather than minting a second one. The
 * number is deliberately not returned on a replay: it was revealed once, on
 * the first response, and that is the only time it exists.
 */
export function cardForIssueKey(key: string): Card | undefined {
  const id = store.issueKeys.get(key)
  return id ? cardById(id) : undefined
}

export function rememberIssueKey(key: string, cardId: string): void {
  store.issueKeys.set(key, cardId)
}

export type CardStatusFilter = CardStatus | "all"

/** Allowlist for the list filter. Anything unrecognised reads as "all". */
export function parseCardStatusFilter(value: string | null): CardStatusFilter {
  return isCardStatus(value) ? value : "all"
}

/** Newest first, matching how payments list. */
export function listCards(filter: CardStatusFilter = "all"): Card[] {
  const cards =
    filter === "all"
      ? [...store.cards]
      : store.cards.filter((card) => card.status === filter)
  return cards.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export type StatusChange =
  | { ok: true; card: Card }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "illegal_transition"; from: CardStatus }

/**
 * The state machine is guarded here, not in the UI, so a crafted PATCH cannot
 * skip it. Every accepted change appends an event.
 */
export function setCardStatus(id: string, to: CardStatus): StatusChange {
  const card = cardById(id)
  if (!card) return { ok: false, reason: "not_found" }
  if (!canTransition(card.status, to)) {
    return { ok: false, reason: "illegal_transition", from: card.status }
  }

  card.status = to
  card.events.push({ status: to, at: new Date().toISOString() })
  return { ok: true, card }
}
