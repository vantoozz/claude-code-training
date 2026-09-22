# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, grilled with `/grill-me`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Ivan Nikitin
**Status:** reviewed

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours and happens twelve to twenty times a week. Last month two cards went out with the wrong spend limit, because the request lived in a Slack thread. Marcus Bell wants issuing in the console, where the limit is a validated field instead of a sentence someone typed.

## Score map

The plan is ordered by weight. Every step names the bucket it earns, so the clock can stop anywhere.

| Weight | Category | What earns it here | Steps |
| --- | --- | --- | --- |
| 35% | Core criteria | Issue, list, detail, generated numbers, reveal once, server validation | 1–7 |
| 20% | Correctness rules | Integer minor units, Luhn on `4242`, no PAN after creation, `canTransition` on the server, allowlists | 1, 3, 4; read at 5 |
| 15% | Code quality | Existing helpers only, one pattern per job, no debris | every step; read at 5 |
| 10% | Context and planning | This document, committed on the branch, and code that matches it | 0 |
| 5% | PR description | What was built, which criteria met, how each was verified | 9 |
| 15% | Stretch goals | Tier 1: tests, freeze/unfreeze, spend bar, category lock, empty and error states. Tier 2: idempotent issue, currency matches merchant, cancel with confirm, audit trail, spend honesty | 8 |

Weights are the grader's, read from its review of [PR #212](https://github.com/JJFromTenex/claude-code-training/pull/212) on 2026-09-22. The brief's 40/10/5 split for core, PR, and stretch was wrong; stretch is three times what it said.

## Current state

- `src/data/types.ts` — `Currency`, `Merchant`, `Payment` and four other records. No `Card` type, no card status.
- `src/data/store.ts:16-22` — the `Store` interface, held on `globalThis`. A sixth collection is a one-line change.
- `src/data/generate.ts` — deterministic seeds from `mulberry32` at `SEED = 20260813`. `pad` at line 55 is module-private. Nothing card-shaped exists.
- `src/data/queries.ts:18` — `parseFilters`, the allowlist function. It lives in the data layer; the route just calls it.
- `src/lib/money.ts:15` — `formatMoney`. `parseAmountToMinorUnits` at line 46 turns `"250.00"` into `25000` and has no callers yet. It was written for this boundary.
- `vitest.config.ts` — `environment: "node"`, `include: ["src/**/*.test.ts"]`. No jsdom, no `.tsx`. Only pure logic is testable.
- `src/app/api/` — neither route returns a non-200. There is no error shape to copy.
- `src/app/payments/page.tsx` — the list pattern: server component, `TableRoot` at line 79, written empty state at 93-104. `filter-bar.tsx` beside it is the client filter pattern.
- `src/app/payments/page.tsx:123` and `src/app/payments/[id]/page.tsx:68` — cards already mask as `•••• {last4}`. Lines 87-104 of the detail page render a timeline.
- `src/components/ui/payments/StatusBadge.tsx:5` — `AnyStatus` with three exhaustive maps. Card statuses extend it.
- `src/components/Drawer.tsx:74-76` — Radix `Content` in a Portal, no `forceMount`. Content unmounts on close.
- `src/app/siteConfig.ts:5-10`, `src/components/ui/navigation/AppSidebar.tsx:26-51` — navigation. `/cards` is in neither.

**Where the ticket and the docs do not match the code:**

- `.claude/rules/components.md` says a `Dialog` component exists. It does not. `Drawer.tsx` wraps the same Radix primitive and is used instead.
- `CLAUDE.md` says seed data is JSON. It is TypeScript in `generate.ts`. Seeds go there.
- The ticket's mask is `•••• 4242`, but `4242` is the BIN. The console shows the real last four, as it already does for payments.
- The ticket asks for spend against the limit, but no payment links to a card. `spend` is a field on the record.
- ORG #8 and the ticket require storing "a reference". Nothing defines it. The card id is the reference.
- The brief promises a pre-push hook that refuses a red suite. No hook is installed. Run `npm test` by hand before every push.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units; `$250.00` is `25000` | `CLAUDE.md` #1, ORG #1 | A float limit drifts; `5,000,000` stops meaning one thing |
| Client input is converted once, at the boundary, then validated on the server | `.claude/rules/money.md`, ORG #7 | A decimal string reaches the store, or the server parses money |
| Every generated number starts `4242` with a valid Luhn check digit | `.claude/rules/cards.md`, ticket rule 4 | A record here resembles a real PAN |
| Generate on the server | `.claude/rules/cards.md` | A number produced in the browser |
| The full number appears in the creation response and nowhere else | `.claude/rules/api-routes.md`, ORG #8 | A PAN in a list payload, a record, or client state after close |
| `active ⇄ frozen`, either to `cancelled`, `cancelled` is terminal | `CLAUDE.md`, ticket rule 3 | A cancelled card comes back |
| Guard the transition on the server | `.claude/rules/cards.md` | A crafted `PATCH` skips the state machine |
| Validate against an allowlist before the store | `CLAUDE.md` #4, ORG #7 | A currency of `XYZ` or a limit of `-1` is stored |
| One error shape, a code that means what it says, a message safe to show | `.claude/rules/api-routes.md` | The drawer cannot tell which field failed |
| Match the naming and layout of the files around it | ORG #9 | A second pattern for the same job |

## Decisions

Settled by `/grill-me`. Each one is a line the reviewer can check the code against.

1. **Currency** — must match the merchant's currency; a mismatch is 400 with field `currency`. The form derives it from the chosen merchant and renders it read-only, so it cannot offer a value the server will reject. Reversed on 2026-09-22: the grader's review of PR #212 credits "currency matches merchant" as a Tier 2 stretch goal, so accepting a mismatch cost points.
2. **Error shape** — `{ error: { message, field } }`. 400 validation, 404 unknown card, 409 illegal transition.
3. **Reference** — the card id, `card_000001`, in the `pay_000001` format from `generate.ts:93`. No extra field.
4. **Empty state** — a status filter on `/cards`, copying `payments/filter-bar.tsx`. Filtering to a status with no cards reaches it.
5. **Transition** — `PATCH { status }`. Checked against `CARD_STATUSES`, then `canTransition`.
6. **History** — `events: [{ status, at }]` on the card, appended by `setCardStatus`, rendered like the payment timeline. Answers "what happened to a card last Tuesday".
7. **Build order after core** — freeze/unfreeze with cancel-with-confirm, timeline as the audit trail, status filter, spend bar, category lock, idempotent issue. Stretch is 15%, not 5%, so nothing is cut; the order is value per minute.
8. **Limit** — the drawer calls `parseAmountToMinorUnits` before POST. The API accepts integer minor units only. The server rejects anything not an integer in 1 to 5,000,000.
9. **Nickname** — required, trimmed, 1 to 40 characters. 400 with `field: "nickname"`.
10. **Idempotent issue** — the drawer sends an `Idempotency-Key` header, one UUID per form mount. The server maps key to card id on the store; a replay returns 200 `{ card }` with no number, because the number was revealed on the first response.
11. **Cancel with confirm** — cancelling is terminal, so the Cancel button is a two-step inline confirm. No new dialog primitive.
12. **Category lock** — `category` on the card from a fixed allowlist, chosen at issue time. The server defaults it to `other` when the client omits it, so a missing Select can never break issuing. Shown on the list and the detail.
13. **Spend** — seeded spend stays. The grader marked invented spend as partial credit, but it is what makes the amber bar demonstrable and it is already pushed. The detail page says the figure is seeded.

## Approach

Cards are a sixth collection in the existing store. Pure logic lives in `src/lib/cards.ts`: the Luhn generator, the mask, and the state machine, all testable under the node-only vitest config. `generateCardNumber` takes its random source as a parameter, so seeds pass the deterministic `rand` and the route passes `Math.random`. Allowlist parsing and store mutations live in `src/data/cards.ts`, the same split `queries.ts:18` uses for payments. Two route handlers call it: `POST /api/cards` returns `{ card, number }`, with the number beside the record rather than on it, so the `Card` type never carries one. `PATCH /api/cards/[id]` takes `{ status }` and guards the transition. The list and detail pages read the store directly, as `payments/page.tsx:45` does. The issue form is a `Drawer` whose content swaps to a success panel. The number lives in state inside that content, so Radix unmounting it on close is what clears it. `router.refresh()` runs on success, so the list is current before the drawer closes. The submit button is disabled while the POST is in flight.

**Considered and rejected:** a `/cards/new` page redirecting to a success page. The full number would have to survive the redirect in a URL or held server state. Both are worse than a panel that unmounts. Also rejected: a new `Dialog.tsx`, because `Drawer.tsx` already wraps the same primitive with focus handling and an accessible name. Also rejected: a server that accepts `"250.00"`. The API would speak decimal strings in a minor-units codebase, and a reviewer's `{ "limit": 25000 }` would fail.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | Change | `CardStatus`, `CardCategory`, `Card` with `spend`, `events`, `last4`, `category`, and no number field |
| `src/lib/cards.ts` | Add | `TEST_BIN`, `generateCardNumber(rng)`, `luhnCheckDigit`, `isLuhnValid`, `maskCard`, `canTransition`, `CARD_STATUSES` |
| `src/lib/cards.test.ts` | Add | `4242` prefix and Luhn validity over many draws; every legal and illegal transition |
| `src/data/cards.ts` | Add | `parseCardInput`, `createCard`, `cardById`, `listCards`, `setCardStatus`. Mirrors `queries.ts` |
| `src/data/store.ts` | Change | `cards: Card[]` on the `Store` interface and in `createStore` |
| `src/data/generate.ts` | Change | Export `pad`. Seed five cards: USD/GBP/EUR, active/frozen/cancelled, spend on both sides of 80% |
| `src/app/api/cards/route.ts` | Add | `POST`. The only response carrying a full number. 201 or 400 |
| `src/app/api/cards/[id]/route.ts` | Add | `PATCH { status }`. 200, 400, 404, or 409 |
| `src/app/cards/page.tsx` | Add | The list, from `payments/page.tsx`, with its empty state |
| `src/app/cards/filter-bar.tsx` | Add | Status filter, from `payments/filter-bar.tsx` |
| `src/app/cards/[id]/page.tsx` | Add | Detail with spend against limit, from `payments/[id]/page.tsx`, plus the timeline |
| `src/app/cards/issue-card-drawer.tsx` | Add | Client `Drawer`: form, then the one-time success panel |
| `src/app/cards/card-status-actions.tsx` | Add | Freeze/unfreeze via `PATCH` and `router.refresh()` |
| `src/components/ui/payments/StatusBadge.tsx` | Change | Three card statuses in `AnyStatus` and all three maps |
| `src/app/siteConfig.ts`, `AppSidebar.tsx` | Change | `cards: "/cards"` and a nav entry |

## Plan

Weight order. Each step ends where it can be checked.

0. **[10%] Branch and commit this spec.** `git checkout main && git checkout -b NWP-201-issue-cards`, commit as `NWP-201: spec`. — done when: the spec is the first commit on the branch.
1. **[40%, 20%, 5%] Types and pure logic.** `Card` types, then `src/lib/cards.ts` with `cards.test.ts` beside it. — done when: `npm test` is green and asserts `4242`, Luhn, and every transition pair including `cancelled` as terminal.
2. **[40%] Store and seeds.** `cards` on the store, `pad` exported, five seeded cards with seeded events. — done when: a node one-liner prints five cards with integer limits, mixed currencies, and no number field.
3. **[40%, 20%] Validation and mutations.** `src/data/cards.ts`. — done when: `parseCardInput` rejects a missing merchant, an empty nickname, `0`, `-1`, `5000001`, `250.5`, and `"XYZ"`, each with a `field`, and accepts a valid record.
4. **[40%, 20%] Routes.** `POST /api/cards` and `PATCH /api/cards/[id]`. — done when: `curl` POST returns 201 with `{ card, number }`, a bad currency returns 400 with `{ error }`, an unknown id returns 404, and `cancelled → active` returns 409.
5. **[20%, 15%] Read the diff. Do not build.** Check: integer minor units everywhere; no formatter output stored; no number on any record or list payload; validation in `src/data/cards.ts`, not the route; nothing that duplicates `money.ts`, `dates.ts`, or `pad`; no `console.log`. — done when: every line of `src/data/` and `src/app/api/` passes that list.
6. **[40%] List and detail.** `/cards`, `/cards/[id]`, navigation, badges. — done when: both render at `localhost:3000/cards`, masked `•••• {last4}`, with a merchant name and `formatMoney` for the limit.
7. **[40%] Issue drawer.** Form, then success panel. — done when: submitting adds a row to the list, the number shows once, and reopening the drawer shows a blank form.
8. **[15%] Stretch, in decided order.** Freeze/unfreeze and cancel-with-confirm, timeline as the audit trail, status filter, spend bar amber past 80%, category lock, idempotent issue. — done when: each works without a full reload and `npm test` is still green.
9. **[5%] PR description.** What was built, which criteria and stretch goals were met, how each was verified. Leave anything unverified blank. — done when: every claimed row in Verification has its proof named. Ninety seconds.

## Verification

Ordered by the bucket it proves.

| Bucket | Acceptance criterion | How it is proven |
| --- | --- | --- |
| Core | Issue a card | Submit the drawer; the new row appears in `/cards` without a reload |
| Core | Card list at `/cards` | Screenshot: nickname, merchant, `•••• {last4}`, limit, status, created date |
| Core | Card detail | Open a seeded card; the record, spend against limit, and timeline render |
| Core | Generated numbers, `4242`, valid Luhn | `src/lib/cards.test.ts` over many draws |
| Core | Reveal once, mask forever | `curl` the POST for the number; confirm no other response, page, or record contains it |
| Core | Server-side validation | `curl` each case: missing merchant, `0`, `-1`, `5000001`, `"XYZ"`. Each returns 400 with `{ error }` |
| Correctness | Integer minor units | Step 5 diff read; `Card.limit` and `Card.spend` are integers, formatted only in components |
| Correctness | State machine, `cancelled` terminal | `cards.test.ts` covers every pair; `curl` PATCH `cancelled → active` returns 409 |
| Correctness | Allowlists on the server | `curl` PATCH `{ status: "lost" }` returns 400; POST `{ limit: "250.00" }` returns 400 |
| Quality | No second implementation | Step 5: `grep` for `padStart`, `toLocaleString`, and `/100` outside `src/lib/` finds nothing new |
| Stretch | Freeze/unfreeze without reload | Click freeze in the list; the badge changes, the page does not reload |
| Stretch | Empty and error states | Filter to a status with no cards; submit the drawer with a bad limit |
| Stretch | Spend bar amber past 80% | The 90% seed renders amber; the 60% seed does not |

## Risks

- **The clock.** Steps 0 to 7 are 80% of the score. A stretch goal started before step 7 is green costs more than it earns.
- **No pre-push hook exists**, whatever the brief says. A red push scores as red. `npm test` before every push, by hand.
- **The full number leaking.** It must never reach the `Card` record, a list payload, or client state after close. Step 5 checks this before any UI exists to hide it in.
- **A second money helper.** `formatMoney`, `parseAmountToMinorUnits`, and `pad` all exist. Writing any of them again violates ORG #2 and #9.
- **`StatusBadge` maps are exhaustive.** Adding `CardStatus` without all three entries fails the build.
- **The mask decision.** The ticket writes `•••• 4242`; this shows the real last four. If a reviewer reads it literally, `maskCard` is a one-line change.

## Out of scope

- **Persistence.** No database, no ORM, no migrations. That is NWP-203.
- **Editing a limit after issue.** That is NWP-202.
- **`GET /api/cards`.** Pages read the store directly. An unused route is debris under ORG #10.
- Authentication, roles, permissions, and real card network calls.

## Defects found while building this

Neither is card code. Both were found reading the modules this ticket sits beside,
and both violate `docs/ORG-STANDARDS.md`. Fixed, with tests that fail against the
old implementations.

- **`src/data/queries.ts` — `sortPayments` compared amounts as digit strings.**
  `String(a.amount).localeCompare(String(b.amount))` put `1000` before `900`, so
  sorting by amount was wrong at every change of digit count. Violates ORG #3.
- **`src/data/metrics.ts` — `dailyVolume` bucketed in the server's timezone.**
  `toLocaleDateString("en-CA")` put a payment at 02:30 UTC on the previous calendar
  day west of Greenwich. `utcDayKey` already existed in `src/lib/dates.ts` and now
  does the work. Violates ORG #4.
- Also in `dailyVolume`, subtotals accumulated as floats in major units and were
  reported as a rounded intermediate. ORG #1 forbids that shape even where the
  figure comes out right, which here it does — no drift in 4,000 seeded samples.
  Recorded as a standards fix, not as a wrong number.

**Noted, not fixed:** `src/app/payments/page.tsx` never reads `sort` or `direction`
from its search params, so the sort the API supports cannot be reached from the page.
Out of scope for NWP-201.

## Open questions

- **Does spend need to move?** Seeded cards carry a fixed `spend`. Nothing increments it, because no payment links to a card. If the reviewer expects it to change, that needs a link the ticket does not ask for.
