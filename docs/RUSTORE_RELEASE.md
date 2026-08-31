# RuStore release checklist — Автожурнал

## Current status

- **Phase 5 + remediation:** complete (`f64f077`)
- **Tests:** 77/77 PASS, lint/typecheck PASS
- **Responsive:** 360 dp / 390 dp verified
- **Blockers:** production AppMetrica key, Yandex ad unit IDs, production keystore

## Before production prebuild

- [ ] Identity: `Автожурнал` / `com.calculatorplatform.autojournal` / 1.0.0 / versionCode 1
- [ ] Icons: `assets/autojournal-icon.png` + adaptive foreground
- [ ] Privacy URL live (HTTPS) — publish `docs/privacy.html`
- [ ] Analytics / ads production IDs in local `.env` only (see `.env.example`)
- [ ] Keystore ready for **this** package (`credentials/README.md`)

## Build

```powershell
$env:APP_VARIANT = "production"
$env:GRADLE_USER_HOME = "D:\g"
$env:KEEP_PRODUCTION_AUTOLINKING = "1"
# Windows: build from a short real path (e.g. D:\aj) if CMake hits MAX_PATH (~260).
npm run prebuild:android:production
cd android
.\gradlew.bat bundleRelease
cd ..
node scripts/verify-release-signing.cjs android/app/build/outputs/bundle/release/app-release.aab
npm run restore:dev-autolinking
```

Release signing is injected by `scripts/with-release-signing.js` during prebuild.
`bundleRelease` **fails closed** when `credentials/keystore.properties` is absent.

Copy the signed AAB to `release-artifacts/autojournal-1.0.0-v1.aab` (gitignored).

## Verify AAB

- [ ] Package matches `com.calculatorplatform.autojournal`
- [ ] versionName 1.0.0 / versionCode 1 match listing
- [ ] Signing certificate registered in RuStore console
- [ ] Manifest permission audit (see below)
- [ ] No `expo-dev-client` / dev launcher in merged manifest
- [ ] `SYSTEM_ALERT_WINDOW` absent in release merge
- [ ] Legacy storage permissions blocked

## Permissions (production expectations)

| Permission | Purpose | Release note |
|------------|---------|--------------|
| `INTERNET` | Network | Required (ads / analytics) |
| `ACCESS_NETWORK_STATE` | Network | Required (SDK) |
| `com.google.android.gms.permission.AD_ID` | Yandex Mobile Ads | Expected |
| `com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE` | AppMetrica / install referrer | Expected |
| `VIBRATE` | Notifications | Harmless |
| `POST_NOTIFICATIONS` | Maintenance reminders | User-granted on Android 13+ |
| `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` | Legacy storage | **Blocked** in app.config |
| `SYSTEM_ALERT_WINDOW` | Dev overlay | **Blocked** in production |

## RuStore listing inputs

See `docs/STORE_LISTING_RU.md` for title, short/long description, keywords.

Screenshots: capture from emulator or device, optionally process with a sibling
`scripts/store-assets/` script pattern (1080×1920 portrait).

## After publication

- [ ] Add RuStore app URL to Yandex Advertising Network
- [ ] Register AppMetrica app with production key
- [ ] `npm run restore:dev-autolinking` for local dev work
