# Roadmap — Автожурнал

## Phase 0–1 — Foundation + domain engine ✅

- Project scaffold (Expo / RN / TypeScript)
- Product + architecture docs
- Pure domain: fuel, expenses, cost/km, trip, maintenance model
- Decimal comma normalization
- SQLite schema v1 + migration runner
- Backup JSON type (no UI)
- Unit tests for critical math
- Minimal shell + Android smoke

## Phase 2 — Core UX: vehicles + fuel entry (current)

- Vehicle CRUD + active vehicle
- Fast fuel entry (modes A/B)
- Fuel history list
- Consumption with explanation on home/history
- SQLite repositories wired to UI

## Phase 3 — Expenses + cost/km

- Expense entry (non-fuel categories)
- Period filters (month/year/custom)
- Cost/km and ownership summaries
- Multi-vehicle switcher polish

## Phase 4 — Maintenance + trip tools

- Maintenance items UI (remaining km/days)
- Trip calculator screen
- Optional reminder UX (still no push unless decided)

## Phase 5 — Stats, backup, export

- Simple statistics screens (no overbuilt charts at first)
- JSON backup/restore UI
- CSV export for Excel
- Data-loss safeguards / confirmations

## Phase 6 — RuStore release polish

- Listing assets, privacy policy
- Ads / AppMetrica behind service interfaces (patterns from sibling apps)
- Release signing / AAB
- Google Play readiness pass (later)

## Explicit non-goals until justified

Online fuel prices, maps/GPS, OBD, VIN decode, cloud sync, accounts, AI.
