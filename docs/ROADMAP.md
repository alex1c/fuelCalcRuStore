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

## Phase 2 — Core UX: vehicles + fuel entry ✅

- Vehicle CRUD + active vehicle
- Fast fuel entry (modes A/B)
- Fuel history list
- Consumption with explanation on home/history
- SQLite repositories wired to UI

## Phase 3 — Expenses + cost/km ✅

- Expense entry (non-fuel categories)
- Period filters (month/year/custom)
- Cost/km and ownership summaries
- Multi-vehicle switcher polish

## Phase 4 — Maintenance + backup/export ✅

- Maintenance items UI (remaining km/days)
- JSON backup/restore UI + CSV + share report
- Optional reminder UX (local notifications)

## Phase 5 — Ads, analytics, trip, RC polish ✅

- Real backup → mutate → DocumentPicker restore → restart smoke
- AppMetrica (privacy-safe events) + Yandex Mobile Ads
- Home/Stats banners; capped interstitial on Statistics
- Trip calculator UI
- UX polish + empty states
- Release identity 1.0.0 / versionCode 1
- Production signing / AAB: blocked until autojournal keystore exists

## Phase 6 — RuStore submission (in progress)

- [x] Release scripts + checklist (`docs/RUSTORE_RELEASE.md`)
- [x] Privacy policy draft + HTML (`docs/PRIVACY_POLICY_*.md`, `docs/privacy.html`)
- [x] Store listing copy draft (`docs/STORE_LISTING_RU.md`)
- [ ] Production AppMetrica key + ad unit IDs in `.env`
- [ ] Production keystore + signed AAB verification
- [ ] RuStore screenshots + live privacy URL
- [ ] Google Play readiness pass (later)

## Explicit non-goals until justified

Online fuel prices, maps/GPS, OBD, VIN decode, cloud sync, accounts, AI.
