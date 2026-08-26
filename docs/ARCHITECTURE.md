# Architecture — Автожурнал

## Stack

- Expo SDK 57 + React Native 0.86 + TypeScript strict
- Expo Router under `src/app/`
- Expo Development Build (not Expo Go as production target)
- Android / RuStore first
- **expo-sqlite** for local persistence
- No backend, no accounts

## Layers

```text
UI (src/app, src/features) — thin shell in Phase 0–1
        │
        ▼
units / presenters (parse decimal comma, format) — later UI wiring
        │
        ▼
Domain (src/domain) — pure TypeScript, Jest-tested
        │
        ▼
Persistence (src/persistence) — SQLite schema, migrations, repositories
```

Rules:

- UI must not contain consumption / money / cost-per-km formulas.
- Persistence must not contain UI copy or presentation logic.
- Domain has no React / Expo imports.

### Domain pipeline

```text
input → normalize → validate → calculate → result (+ explanation fields)
```

## Persistence choice: expo-sqlite

**Why:** Official Expo module for SDK 57 (`expo-sqlite` ~57), transactions, SQL schema,
simple migrations, works offline, predictable JSON export for backup, no heavy ORM.

**Schema version:** stored in `schema_migrations`.  
Migrations start at **version 1**. App upgrades must run migrations before reads/writes.

**Not chosen:** AsyncStorage (weak querying/migrations), custom file-only DB (reinventing SQL), WatermelonDB (heavier than needed).

## Backup model (not implemented UI)

Versioned JSON document:

```json
{
  "format": "auto-journal-backup",
  "version": 1,
  "createdAt": "...",
  "appVersion": "...",
  "vehicles": [],
  "fuelEntries": [],
  "expenses": [],
  "maintenance": [],
  "settings": {}
}
```

Restore path (future): import → migrate backup version → write in a transaction → replace or merge per explicit user choice.

CSV (future): user analysis export only — not restore.

## Money & volume

- Volume: integer **milliliters**
- Money: integer **kopecks** (minor units; currency code default `RUB`)
- Avoid chaining float money math across aggregates

## Multi-vehicle isolation

Every query and calculation takes `vehicleId`. Domain helpers filter before math.

## Permissions

Phase 0–1: no extra Android permissions. Add only when a feature needs them.
