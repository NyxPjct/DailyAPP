# DailyAPP 1.4 — statement reconciliation and global search

Version **1.4.0**, build **10**, for personal use on Android and iPhone.

## New in this release

- **Explicit statement reconciliation:** choose a compatible planned transaction while reviewing CSV/OFX rows. Confirm the original record without creating another expense or income entry.
- **Conservative suggestions:** equal BRL cents and direction, dates within seven days, and compatible active accounts. Nothing is matched automatically. Future source dates, flagged transfers/card payments, partial payments, and approximate amounts are excluded from confirmation.
- **Preserved history:** confirmation keeps the record’s ID, description, category, notes, reminder and recurrence/installment links; it marks Paid/Received and uses the statement date. Old and new source markers survive current backups and prevent reimports.
- **Atomic review:** combine new rows and planned confirmations in one validated save. Stale edits, repeated targets, or incompatible data reject the entire batch without partial changes.
- **Global search:** find tasks, transactions, accounts, goals, cards, transfers, notes, and task steps across all months, including archived records. Filter by type or notes, open original forms, and use Ctrl+K / Cmd+K when no form is open. Queries stay local and are not saved.

Both features work offline in English, Portuguese, Spanish, French, and German. Earlier backups remain accepted. Version 1.4 or later retains every linked statement marker when restoring a reconciled backup.

## Downloads and Android migration

- **Android:** `DailyAPP-1.4-pessoal.apk`, Android 7 or later. **This build uses a new signing certificate** because the earlier private key was unavailable in the recreated environment. Export and verify an external backup in the old app before uninstalling it, then install 1.4 and restore your backup. The package identifier is unchanged, so Android cannot update the old certificate directly.
- **iPhone:** `DailyAPP-1.4-sem-assinatura.ipa`, arm64 and iOS 15.4 or later. The IPA is unsigned and needs personal signing; the mobile guide links official AltServer/AltStore instructions for Windows.
- **Computer:** `DailyAPP-index.zip`; extract and open `index.html` in Chrome or Edge. Use backups to transfer records between separate browser and phone installations.

Each file includes a SHA-256 checksum. Android uses a Release build with app/WebView debugging disabled. iPhone is built with Xcode 26.3 on GitHub Actions. The README includes the updated feature guide and 30 screenshots with fictional data.

## Validation

**147 distinct test cases have passed.** The full run passed 146; one iOS navigation test hit its time limit and passed when rerun separately. Eight final UI checks also passed after the search date display update. Coverage includes strict matching, stale changes, atomic storage failures, marker/backup compatibility, all search record types, archived records, keyboard behavior, and accessibility/offline layouts in all five languages at 320 px. Browser tests simulate native plugin contracts; real-device installation, migration, file pickers, keyboard, sharing, and notifications still need on-device confirmation.
