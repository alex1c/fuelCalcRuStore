/**
 * Credentials for Auto Journal production signing.
 *
 * Never commit real keystores, `keystore.properties`, or passwords.
 * `credentials/keystore.properties` is gitignored.
 */

## Per-product keystore

Auto Journal package: `com.calculatorplatform.autojournal`

Suggested local (outside repo) layout:

| Item | Example |
|------|---------|
| Keystore file | `%USERPROFILE%\secure\calculator-platform\autojournal-release.jks` |
| Alias | `autojournal` |
| Package | `com.calculatorplatform.autojournal` |

Generate **only** when intentionally creating the production keystore
(do not invent passwords in chat/CI logs):

```powershell
keytool -genkeypair -v -storetype PKCS12 `
  -keystore "$env:USERPROFILE\secure\calculator-platform\autojournal-release.jks" `
  -alias autojournal `
  -keyalg RSA -keysize 2048 -validity 10000
```

Copy `keystore.properties.example` → `keystore.properties` and fill the absolute
`storeFile` path. `APP_VARIANT=production` enables the Expo signing plugin during
prebuild; release tasks then use only this production signing config and fail
closed while the properties file is absent.

Until the keystore exists locally:

`BLOCKED ON PRODUCTION SIGNING`
