# Product Spec — Автожурнал V1

**Package:** `com.calculatorplatform.autojournal`  
**Platform:** Android / RuStore first (Google Play later)  
**Storage:** local-first, no accounts, no backend

## Goal

Записать обычную заправку примерно за **10 секунд** и сразу увидеть понятный результат: расход, стоимость километра, расходы автомобиля.

Цепочка продукта:

**Заправки → расход топлива → ₽/км → расходы → ТО → статистика**

## Out of scope (V1 / this phase)

Ads, AppMetrica, charts UI, notifications, backup UI, CSV UI, PDF, share, maps, GPS, gas stations, online prices, OBD, VIN, AI, cloud sync, auth.

---

## Vehicles

| Field | Required | Notes |
|-------|----------|-------|
| id | yes | UUID |
| displayName | yes | User label |
| make | no | |
| model | no | |
| fuelType | yes | e.g. petrol95, diesel, lpg, electric (metadata only in V1) |
| currentOdometerKm | yes | Integer km; updated from latest fuel/expense input by UI later |
| createdAt / updatedAt | yes | ISO-8601 |

Multiple vehicles. Calculations are always scoped by `vehicleId`.

---

## Fuel entries

| Field | Required | Notes |
|-------|----------|-------|
| id | yes | UUID |
| vehicleId | yes | |
| recordedAt | yes | date/time of fill |
| odometerKm | yes | Integer km |
| litersMl | yes | Integer milliliters (canonical volume) |
| totalCostKopecks | yes | Integer minor currency units (canonical money) |
| pricePerLiterKopecks | yes | Stored for display; must match rounding rules |
| fullTank | yes | boolean |
| note | no | |
| createdAt / updatedAt | yes | |

### Input modes (domain)

- **A:** liters + price/L → total  
- **B:** liters + total → price/L  

Canonical stored truth for aggregation: **`litersMl` + `totalCostKopecks`**.  
`pricePerLiterKopecks` is kept consistent via rounding rules (see `DECISIONS.md`).

---

## Fuel consumption (л/100 км)

**Method:** full-tank method only.

### Rules

1. Sort entries by `odometerKm ASC`, then `recordedAt ASC`, then `id ASC`.
2. The **first full-tank** entry is a baseline. No consumption yet → `insufficient_data`.
3. A **valid interval** ends at a later full-tank entry. Fuel for the interval =
   sum of liters of every entry **after** the start full-tank **up to and including**
   the end full-tank. Distance = end odometer − start odometer.
4. Partial fills never produce their own л/100 км row.
5. History with no full tank → no consumption.
6. Only one full tank → insufficient data.
7. Distance ≤ 0 → invalid interval (not shown as consumption).

### Example A

10 000 full → 10 500 full / 40 L → **8.0 л/100 км** (500 km, 40 L).

### Example B

10 000 full → 10 300 / 20 L partial → 10 600 full / 25 L →  
distance 600, fuel 45 → **7.5 л/100 км**.

### Averages

Never average л/100 км values arithmetically.  
Average = `sum(fuelLiters) / sum(distanceKm) × 100` over valid intervals
(or over filtered intervals in a period when endpoints are valid).

### History edits

Consumption is **always recomputed** from raw fuel entries.  
Backdated inserts, edits, and deletes must recalculate correctly.  
Order of `createdAt` must not affect math — only odometer/time sort rules.

---

## Odometer validation

Domain returns structured error codes (not UI strings).

- New/edited entry must fit among neighbors when sorted by the same rules.
- Decreasing odometer vs previous neighbor → `ODOMETER_DECREASING`.
- Same odometer as a neighbor → `ODOMETER_NOT_INCREASING`.
- Inserting between existing entries is allowed when the value sits strictly between neighbors.

---

## Expenses

| Field | Required | Notes |
|-------|----------|-------|
| id | yes | |
| vehicleId | yes | |
| recordedAt | yes | |
| odometerKm | no | |
| amountKopecks | yes | |
| category | yes | see list |
| note | no | |
| createdAt / updatedAt | yes | |

### Categories V1

`fuel`, `maintenance`, `repair`, `parts`, `insurance`, `washing`, `parking`, `fines`, `tires`, `tax`, `other`

### No double-counting fuel

Fuel money comes from **fuel entries**.  
Expense records with category `fuel` are **rejected** by domain validation in V1.  
Category bucket `fuel` in reports is filled only from fuel entries.

Aggregation:

```text
total = sum(fuelEntry.totalCost) + sum(expense.amount)
byCategory.fuel = sum(fuelEntry.totalCost)
byCategory.<other> = sum(expense.amount where category = other)
```

---

## Cost per kilometer

```text
costPerKm = totalCosts / distanceKm
```

**Denominator (lifetime / period):**  
`max(odometerKm) − min(odometerKm)` among fuel entries in scope (vehicle, optional date filter on `recordedAt`).

Valid only when:

- ≥ 1 fuel entry contributing money OR ≥ 1 expense contributing money, **and**
- distanceKm > 0 from fuel odometers in scope.

Otherwise → `insufficient_data`.

Result includes explanation fields: totalCosts, distanceKm, formula parts.

---

## Ownership / period stats (domain only)

For a vehicle and optional `[from, to]` on `recordedAt`:

- total / fuel / non-fuel costs
- costs by category
- cost per km (when valid)
- month / year helpers are period filters, not separate formulas

No charts in this phase.

---

## Maintenance reminders (model only)

| Field | Required | Notes |
|-------|----------|-------|
| id | yes | |
| vehicleId | yes | |
| title | yes | |
| lastServiceDate | no | |
| lastServiceOdometerKm | no | |
| intervalKm | no | |
| intervalDays | no | |
| note | no | |
| active | yes | |
| createdAt / updatedAt | yes | |

Domain can compute remaining km/days for future UI. No notification infrastructure now.

---

## Trip calculator

**Fuel estimate** (always separate):

- input: distanceKm, consumptionLPer100Km, fuelPricePerLiter
- output: estimatedLiters, estimatedFuelCost

**Real trip cost** (optional, separate concept):

- when valid costPerKm exists: `distanceKm × costPerKm`

Never mix “fuel-only trip cost” with “ownership cost × distance” in one number without labeling.

---

## Numeric input

`8.5` and `8,5` are the same value after normalize. Applies to liters, prices, totals, consumption, and odometer text when parsed from strings.

---

## Backup / CSV (architecture only)

- JSON backup is the restore format (`auto-journal-backup`, versioned).
- CSV is for Excel analysis later — not a restore format.
- No file picker/share UI in Phase 0–1.
