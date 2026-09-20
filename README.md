# Folio

A local-first personal finance workspace with a responsive ADO-style sidebar, light/dark themes, real statement imports, editable records, and persistent browser storage.

## Run Locally

Use Node.js 22.12+ and npm.

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open the URL printed by Vite, normally http://127.0.0.1:5173. Keep using the same hostname and port: browser data is isolated by origin.

The first visit creates fictional demo data. Explore it or use **Import statement > Try a sample statement**. Before importing real finances, use **Settings > Start fresh**, choose your name and currency, and add an account or create one during import.

## Workspace

- Overview: current net worth, monthly cash flow, category breakdown, recent spending, upcoming bills, and goal progress.
- Transactions: add/edit/delete, search, account/category/date filters, sorting, pagination, bulk categorization/review/deletion, CSV export, and potential tax-deduction flags.
- Accounts: checking, savings, cash, credit cards, opening balances, and paired transfers excluded from spending/income.
- Budgets: customizable categories, colors, monthly limits, and over-budget indicators.
- Bills and subscriptions: monthly/yearly/weekly/one-time reminders, pause/resume, and payment recording with optional ledger entries.
- Savings goals: target dates, contributions, and progress; allocations are not double-counted as assets.
- Investments and debts: manual valuations, cost basis, outstanding loans, and fixed-APR payoff scenarios.
- Shared expenses: groups, equal or custom-amount splits, cent-accurate allocation, simplified debts, partial payments, and settlement history. No payment is sent.
- Income: gross pay, withholding, other deductions, received/expected payslips, hours, rates, timesheet statuses, and exports.
- Document vault: upload/download PDF, CSV, PNG, JPG, and WebP files; classify statements, medical bills, receipts, tax records, and payslips; edit metadata and notes.
- Tax center: yearly organization, flagged expenses, preparation checklist, CSV export, and configurable flat-rate reserve scenarios.
- Reports: six-month cash flow, merchant rankings, spending mix, current net worth, and exports.
- Rules: case-insensitive merchant rules, category assignment, renaming, priority ordering, and explicit reapplication to existing records.
- Activity: latest 1,000 workspace changes, search, and CSV export.
- Settings: name, currency, date convention, theme, complete file-inclusive backups, restore, storage persistence requests, and confirmed reset.

## Statement Imports

CSV is the recommended format. Include a Date/Transaction Date column, Description/Merchant/Particulars column, and either Amount or separate Debit/Credit columns. Preambles, quoted fields, and common delimiters are handled by Papa Parse. Map columns and choose the date convention before importing.

```csv
Date,Description,Amount
2026-09-18,AMZN Marketplace,-42.50
2026-09-19,Payroll,3200.00
```

Amounts normally use negative expenses and positive income. For card exports with positive charges, explicitly enable **Positive amounts are card charges**. Decimal-comma amounts and common currency/debit/credit notation are supported. Always inspect the preview, particularly refunds and payments.

The app detects common bank names and masked account suffixes when present. Only a unique matching suffix/institution preselects an existing account. Otherwise choose or create one. Detection is a suggestion, not a bank connection or identity guarantee. Store only the last four account digits.

Text-based PDFs are processed locally with PDF.js. The supported layout has a date, description, and one terminal amount per row. Extraction is best-effort and can omit lines. Scans/OCR, encrypted PDFs, and complex debit/credit/running-balance tables are not supported. Use your bank's CSV export for those statements. All imported PDF transactions are marked for review.

Limits: 15 MB per statement/file, 150 PDF pages, 10,000 CSV rows per import. Invalid source rows are reported, not silently fabricated. Possible duplicates (account, date, amount, normalized description) are unchecked and can be explicitly included. You must confirm the review before saving. Unknown merchants go to Uncategorized. Optional archival stores the original file in the vault.

## Financial Boundaries

- Money uses integer cents. One currency per workspace; no FX conversion. Real populated workspaces lock the currency. Demo currency changes only relabel fictional amounts.
- Account balances equal opening balance plus recorded transactions. An opening balance is from before the first imported transaction, not the statement closing balance. Card debt should be negative.
- Transfers and card repayments should use the Transfer category. Classify imported repayments yourself; they are not reliably inferred across all banks.
- Payroll/timesheets, shared expenses, goal allocations, and document amounts do not automatically change your bank ledger. This avoids double-counting. Bills only create transactions when explicitly requested.
- Refunds appear as positive cash flow rather than netting against a prior expense. Review their category and tax relevance.
- Tax figures are illustrative flat-effective-rate planning only, not jurisdiction-specific tax calculations, deduction validation, filing, or professional advice. Salary gross comes from received payslips; missing payslips mean an incomplete estimate.
- Recurring reminders are in-app, not background email/push notifications. Investment values are manual, not live quotes.

## Privacy and Backups

Records and files are saved in IndexedDB in the current browser profile and site origin. Parsing happens on-device. Fonts, icons, and the goal image are bundled/served locally; there are no analytics or external APIs.

This is **not an encrypted cloud vault**. There is no sign-in, server database, bank sync, multi-device sync, or multi-user collaboration. Anyone using the same browser profile can access the workspace. Clearing site data, private browsing, browser eviction, or changing origins can make data unavailable. Use a trusted device and keep backups. Avoid editing the same workspace concurrently in multiple tabs.

**Settings > Export backup** includes records and actual document contents. The JSON is unencrypted; secure it like a bank statement. Restore validates shapes and references, then replaces the workspace/files in one IndexedDB transaction. Maximum restore size is 100 MB; keep the vault small enough to stay below that limit. Browser storage capacity varies.

## Deploy

```sh
npm run build
npm run preview -- --host 127.0.0.1
```

Host the generated `dist` directory on an HTTPS static host such as Netlify, Vercel, Cloudflare Pages, or Azure Static Web Apps. Build command: `npm run build`; output directory: `dist`. The included `netlify.toml` configures a Netlify build and basic security headers. Hash-based navigation needs no server route rewrites.

No hosting account is configured and nothing is publicly deployed by this repository. A hosted copy still keeps each visitor's data only in their own browser. To move data from localhost to the hosted origin, export a backup locally and restore it on the hosted site. Public hosting does not add authentication, cloud storage, or cross-device sync.

## Verification

```sh
npm test
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit tests cover cent arithmetic, signs, dates, categorization, duplicate fingerprints, shares, settlements, payoff math, and CSV parsing. Browser tests exercise all views, transaction CRUD/persistence, CSV and generated text-PDF imports, duplicates, shared settlements, payroll, bill recurrence, real document backup/restore/deletion, fresh-workspace imports, currency rejection, themes, and responsive layouts.

## Implementation

React 19 + TypeScript + Vite, Zod validation, IndexedDB via idb-keyval, Papa Parse, PDF.js, date-fns, Recharts, and Lucide icons. `src/model.ts` owns data schemas; `src/finance.ts` owns calculations; `src/importer.ts` owns parsing; `src/storage.ts` owns persistence and backups. Feature views share a validated editor and workspace context.

Feature research: [YNAB](https://www.ynab.com/features), [Splitwise](https://www.splitwise.com/), and [Monarch](https://www.monarch.com/features). Landscape photograph served locally from [Unsplash](https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1). The app is not affiliated with these services or any displayed bank/merchant.
