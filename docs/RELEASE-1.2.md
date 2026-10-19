# DailyAPP 1.2 — accounts, budgets and daily planning

Version **1.2.0**, build **8**, for personal use on Android and iPhone.

## New in this release

- **Accounts and wallets:** bank, cash, and savings accounts with dated opening balances, linked transactions, archive/reactivation, and editable internal transfers. Transfers preserve the combined balance and never count as income or expenses.
- **Category budgets:** independent monthly limits, paid and planned spending, and in-app notices at 80% and 100%.
- **Monthly reports:** confirmed income, expenses, net result, previous-month comparison, five largest expenses, and categories that have exceeded their limits.
- **Quick expenses:** frequent previous expenses prefill a new form for review. Nothing is recorded until Save.
- **Task steps and daily focus:** up to 30 checklist steps per task and three selected priorities on Today. Recurring task occurrences reset their checklist.
- **Password-protected backups:** authenticated AES-256-GCM encryption with PBKDF2-SHA256 (600,000 iterations), fresh salt/nonce, and a restoration preview. Plain JSON and older backups remain supported. The exported file is encrypted; live local storage is unchanged. Passwords are not stored or recoverable.

All new screens work offline and are translated into English, Portuguese, Spanish, French, and German. Currency conversion and automatic currency selection with language are preserved. Existing records remain intact and are not automatically assigned to accounts.

## Downloads and installation

- **Android:** `DailyAPP-1.2-pessoal.apk` — Android 7 or later. Export a backup and install over the existing personal APK without uninstalling it. The package identifier and existing signing certificate are preserved.
- **iPhone:** `DailyAPP-1.2-sem-assinatura.ipa` — iOS 15.4 or later, arm64. This IPA is **unsigned** and needs personal signing before installation; it does not install by opening the file. Windows users can follow the official AltServer/AltStore instructions linked from `docs/CELULAR.md`.
- **Computer:** `DailyAPP-index.zip` — extract and open `index.html` in Chrome or Edge. Browser records are separate from phone records; use a backup to transfer data.

Each download has a companion SHA-256 file. Android uses a Release build with application and WebView debugging disabled. iPhone is built with Xcode 26.3 on the GitHub Actions macOS runner. No app-store publication or Apple signing is included.

## Validation

All **104 automated tests passed**, covering existing features and the new financial calculations, transfer conservation, card payment account assignment, category thresholds, reporting, task limits, protected backup round-trips, tampering, wrong passwords, canceled restoration, five-language layouts at 320 px, accessibility, and offline use. Native plugins are simulated in browser tests; real-phone keyboard, notifications, sharing, signing, and installation still need on-device confirmation.

The README includes a guide to every feature and 24 refreshed screenshots using fictional data and explicitly labeled sample exchange rates.
