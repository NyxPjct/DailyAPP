# DailyAPP 1.3 — statement imports and integrated calendar

Version **1.3.0**, build **9**, for personal use on Android and iPhone.

## New in this release

- **Local statement imports:** CSV with column mapping and bank/card OFX for one account. Files stay on the device; no bank login or server upload is required.
- **Review before saving:** choose original currency, optional wallet, rows, categories, and paid/received status. Inspect original and converted amounts and totals. Future-dated entries start as Planned.
- **Duplicate checks:** hashed source identifiers/fingerprints block known reimports. Possible duplicates, transfers, and card payments start unchecked. Review remains necessary; the app cannot identify every duplicate or internal transfer and does not reconcile existing planned entries automatically.
- **Validated batches:** cancel, invalid files, changed source data, capacity limits, or storage failure preserve existing data. Import accepts up to 5 MB and 5,000 rows per file, with 25 review rows per page.
- **Integrated calendar:** tasks, income, bills, and installments share dates and indicators. Filter by tasks/finances and pending status, confirm existing transactions without creating new expenses, and create a transaction on the selected date.

All new screens work offline in English, Portuguese, Spanish, French, and German. Earlier tasks, finances, accounts, budgets, reports, currency preferences, and backups remain supported. Current backups retain import markers; future recurring occurrences do not copy source identifiers.

Foreign-currency imports use a saved current/manual rate and store BRL cents, not historical bank rates. Keep the original statement for its source details. Internal transfers should be recorded under Accounts; importing a card payment already represented by installments would double-count spending.

## Downloads

- **Android:** `DailyAPP-1.3-pessoal.apk` — Android 7 or later. Export a backup and install over the existing personal app without uninstalling it. The identifier and signing certificate are preserved.
- **iPhone:** `DailyAPP-1.3-sem-assinatura.ipa` — arm64, iOS 15.4 or later. This IPA is **unsigned** and requires personal signing before installation. Windows users can follow the official AltServer/AltStore instructions linked in `docs/CELULAR.md`.
- **Computer:** `DailyAPP-index.zip` — extract and open `index.html` in Chrome or Edge. Browser and phone records are separate; use backups to transfer them.

Each file includes a companion SHA-256 checksum. The Android Release build disables app/WebView debugging. The iPhone archive is built with Xcode 26.3 on GitHub Actions. These are personal-use downloads, not app-store publication.

## Validation

All **127 automated tests passed**, including existing features, CSV/OFX parsing and encoding, ambiguous date/number formats, currency validation, duplicate detection, canceled imports, storage failure, calendar filters and payment confirmation, and accessibility/offline layouts at 320 px in all five languages. Native plugin contracts are simulated in browser tests; real-device file pickers, keyboard, notifications, sharing, signing, and installation still need on-device confirmation.

The README includes the updated feature guide, fictional CSV/OFX examples, and **28 refreshed screenshots**.
