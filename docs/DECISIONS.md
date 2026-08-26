# Decisions — Автожурнал

## 2026-08-26 — Expo + sibling-app stack

Status: Accepted

Context: wallpaperAppRustore and ceramicTilesAppRuStore already ship Expo SDK 57.

Decision: Same stack; independent repo; no shared package yet.

Consequences: Local-first SQLite app; ads/analytics deferred.

---

## 2026-08-26 — Persistence: expo-sqlite

Status: Accepted

Context: Need schema version, migrations, transactions, backup-friendly dump.

Decision: `expo-sqlite` + numbered SQL migrations from version 1. No custom ORM.

Why: Fits Expo, enough for journal CRUD, predictable backup via table export to JSON.

---

## 2026-08-26 — Canonical fuel money/volume

Status: Accepted

Context: Input modes A (liters + price/L) and B (liters + total) must not create two truths.

Decision:

1. Canonical aggregation fields: **`litersMl`** (int) and **`totalCostKopecks`** (int).
2. `pricePerLiterKopecks` is stored for UI continuity but **must** be produced by the same rounding helpers as modes A/B.
3. Aggregates (fuel spend, cost/km fuel part) use **`totalCostKopecks` only**, never `price × liters` again.
4. Rounding:
   - liters → nearest milliliter (`round(liters * 1000)`)
   - money → nearest kopeck (`round(major * 100)`)
   - Mode A total = `roundKopecks(litersMl * pricePerLiterKopecks / 1000)`
   - Mode B price = `roundKopecks(totalCostKopecks * 1000 / litersMl)` when litersMl > 0

Why: Integer minor units avoid float artefacts in user-facing money.

---

## 2026-08-26 — Odometer validation uses chronological neighbors

Status: Accepted

Context: A new fill dated after 50 000 km but entered as 49 000 km is impossible;
a forgotten fill dated between existing fills must still be allowed.

Decision: Validate odometer monotonicity along `recordedAt ASC, id ASC` neighbors.
Consumption math still sorts by `odometerKm ASC, recordedAt ASC, id ASC`.

---

## 2026-08-26 — Full-tank consumption method

Status: Accepted

Context: Partial fills must not invent fake segment consumption.

Decision:

- Sort: odometer ASC, recordedAt ASC, id ASC.
- First full tank = baseline only.
- Valid segment = previous full → next full; fuel = sum(liters) of entries after start through end inclusive; distance = Δ odometer.
- Partial-only tails after last full do not yield consumption until the next full.
- Averages = total liters / total distance × 100 over included segments (never mean of rates).

---

## 2026-08-26 — Derived state is never source of truth

Status: Accepted

Context: Edits/deletes/backdated inserts must refresh stats.

Decision: Do not persist consumption or cost/km as authoritative rows. Recompute from fuel/expense records.

---

## 2026-08-26 — Fuel not double-counted in expenses

Status: Accepted

Context: A fill-up is already a cash expense.

Decision:

- Reports inject fuel spend from fuel entries into category `fuel`.
- Creating an `Expense` with `category: 'fuel'` is a domain validation error (`FUEL_EXPENSE_NOT_ALLOWED`).
- Total ownership cost = fuel entry totals + non-fuel expenses.

---

## 2026-08-26 — Cost per km denominator

Status: Accepted

Context: ₽/км is meaningless without traveled distance.

Decision: `distanceKm = max(fuel.odometerKm) − min(fuel.odometerKm)` in scope. Require `distanceKm > 0`. Result carries explanation totals. No silent `0` or Infinity.

---

## 2026-08-26 — Decimal comma now

Status: Accepted

Context: Prior apps hit `8,5` late in QA.

Decision: `normalizeDecimalInput` / `parseUserDecimalNumber` in `src/units` accept comma and dot from day one; domain tests cover both.

---

## 2026-08-26 — Backup JSON vs CSV

Status: Accepted

Decision: JSON backup = full restore format (`format: auto-journal-backup`, versioned). CSV = analysis export only (later). No backup UI in Phase 0–1.

---

## 2026-08-26 — Trip fuel vs ownership trip cost

Status: Accepted

Decision: Trip calculator returns separate fields: `estimatedFuelCost` and optional `estimatedOwnershipCost`. UI must not merge them into one unlabeled number.
