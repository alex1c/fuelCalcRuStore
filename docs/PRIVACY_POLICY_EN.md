# Privacy policy (EN) — Auto Journal

**App:** Auto Journal (Автожурнал)  
**Android package:** `com.calculatorplatform.autojournal`  
**Operator:** ForestMusic  
**Document version:** 1.0 (v1 release)

## Summary

Auto Journal is a local-first car journal (fuel fills, expenses, maintenance,
statistics). Data is stored on-device in SQLite. Yandex AppMetrica and Yandex
Mobile Ads are integrated (banners on Home and Statistics; occasional
interstitial on Statistics open subject to frequency policy).

We do **not** claim that “no data is collected” — analytics and ads SDKs process
technical events, Advertising ID, and telemetry under Yandex policies.

Public URL: https://alex1c.github.io/fuelCalcRuStore/privacy.html  
(requires GitHub Pages enabled on the repository)

## Data processed

**On device (not uploaded to ForestMusic servers as journal content):**

- vehicles, fuel entries, expenses, maintenance records, user notes;
- JSON backups and CSV exports created on user request;
- local maintenance date reminders.

**Via SDKs (Yandex / ad network):**

- categorical analytics events (in-app actions without personal fields: no notes,
  vehicle names, odometer readings, amounts, or file paths in event params);
- Advertising ID and SDK telemetry per Yandex policies.

No account is required. No cloud sync. **No** GPS/location, camera, or
microphone access.

## Purposes

- track fuel and ownership costs on device;
- backup/restore on user initiative;
- CSV export and text report via system Share Sheet;
- local maintenance reminders (with user permission);
- product improvement via aggregated analytics;
- advertising (banners + capped interstitial).

## Backup and Share

JSON backup, CSV, and text reports are generated on device. The user chooses
where to save or send files through Android system dialogs.

## Android permissions

- **Notifications** — maintenance reminders only (can be disabled).
- **File access** — system Document Picker for restore only; no broad storage
  access is requested.
- **Internet** — for analytics and ads SDKs.

## Contact

Privacy inquiries: **alex1c-spb@yandex.ru**
