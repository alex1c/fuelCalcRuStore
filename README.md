# Автожурнал (Auto Journal)

Local-first автомобильный журнал для Android / RuStore.

**Package:** `com.calculatorplatform.autojournal`  
**Version:** 1.0.0 (versionCode 1)  
**Status:** Phase 5 complete — ready for production signing

## Features

- Fuel entry (~10 s), full-tank consumption, cost per km
- Expenses, maintenance (km/date), multi-vehicle
- Statistics, trip calculator
- JSON backup/restore, CSV export, share report
- Local maintenance reminders
- AppMetrica + Yandex Mobile Ads (privacy-safe events)

## Stack

- Expo SDK 57 + React Native 0.86 + TypeScript
- Expo Router, expo-sqlite (migrations)
- Jest — 77 unit tests

## Scripts

```bash
npm install
npm run validate          # lint + typecheck + test
npm start
npm run android
```

Production release (see `docs/RUSTORE_RELEASE.md`):

```powershell
$env:APP_VARIANT='production'
$env:GRADLE_USER_HOME='D:\g'
npm run prebuild:android:production
```

## Docs

- `docs/PRODUCT_SPEC.md` — product model
- `docs/ARCHITECTURE.md` — layers and persistence
- `docs/ROADMAP.md` — phases
- `docs/DECISIONS.md` — canonical rules
- `docs/RUSTORE_RELEASE.md` — release checklist
- `docs/STORE_LISTING_RU.md` — RuStore copy draft
- `docs/PRIVACY_POLICY_RU.md` — privacy (publish `docs/privacy.html`)

## Production inputs (not in git)

- `credentials/keystore.properties` + keystore file
- `.env` — AppMetrica key, Yandex ad unit IDs (see `.env.example`)
