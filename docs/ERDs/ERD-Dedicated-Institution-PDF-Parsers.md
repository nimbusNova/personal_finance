# ERD: Dedicated Institution PDF Parsers

> **Corresponds to:** [PRD: Dedicated Institution PDF Parsers](../PRDs/PRD-Dedicated-Institution-PDF-Parsers.md)  
> **Parent ERD:** [ERD-LLM-Provider-Abstraction.md](./ERD-LLM-Provider-Abstraction.md)  
> **Last updated:** 2026-04-25  
> **Stack:** Next.js 14, pdf-parse, TypeScript (no new DB tables)

---

## What Changed From Previous Architecture

### New Modules

| Module | Purpose | Phase |
|--------|---------|-------|
| `lib/parsers/types.ts` | `InstitutionParser` interface + shared result types | 1 |
| `lib/parsers/utils.ts` | Shared text-parsing helpers (`parseDollar`, `parseDate`, etc.) | 1 |
| `lib/parsers/registry.ts` | `findParser(text)` — detects institution and returns matching parser | 1 |
| `lib/parsers/wealthfront.ts` | Wealthfront Cash Account parser | 2 |
| `lib/parsers/chase.ts` | JPMorgan Chase checking/savings parser | 2 |
| `lib/parsers/schwab.ts` | Charles Schwab brokerage parser | 3 |
| `lib/parsers/robinhood.ts` | Robinhood brokerage parser | 4 |

### Modified Modules

| Module | Change | Reason |
|--------|--------|--------|
| `lib/ai/extraction.ts` | Call `findParser()` before AI pipeline; short-circuit if match | Route known institutions to dedicated parser |

### No DB Schema Changes

The existing `pdfs.provider` and `pdfs.model` columns already capture parser identity. Dedicated parsers write `provider = "dedicated_parser"` and `model = "{institution}-v1"` into `ExtractionResult`, which the existing persistence layer stores unchanged.

---

## 1. Module Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PDF EXTRACTION PIPELINE                               │
│                        (with dedicated parsers)                              │
└─────────────────────────────────────────────────────────────────────────────┘

PDF Upload (/api/v1/upload)
    │
    ▼
lib/services/extraction.ts
    │
    ▼
lib/ai/extraction.ts :: extractFromPDF()
    │
    ├─► extractPdfText()          ← pdf-parse (unchanged)
    │         │
    │         ▼  raw text
    │
    ├─► lib/parsers/registry.ts :: findParser(text)
    │         │
    │         ├─ detect() → RobinhoodParser   ──► parse() ──► ExtractionResult
    │         ├─ detect() → WealthfrontParser ──► parse() ──► ExtractionResult
    │         ├─ detect() → SchwabParser      ──► parse() ──► ExtractionResult
    │         ├─ detect() → ChaseParser       ──► parse() ──► ExtractionResult
    │         └─ null (no match)
    │                   │
    │                   ▼  fallback
    │
    └─► AI Pipeline (unchanged)
              │
              ├─ classifyDocument()   ← LLM call
              ├─ extractBrokerage()   ← 2 LLM calls
              ├─ extractBank()        ← 1 LLM call
              └─ extractCreditCard()  ← 1 LLM call


Each InstitutionParser depends on:

    lib/parsers/types.ts          ← InstitutionParser interface
    lib/parsers/utils.ts          ← parseDollar, parseDate, parseAmount,
                                     stripAnnotations, extractSection
```

---

## 2. Interface Definitions

### `InstitutionParser` (lib/parsers/types.ts)

```
┌─────────────────────────────┐
│      InstitutionParser      │  <<interface>>
├─────────────────────────────┤
│ institution: string         │  canonical name ("Robinhood", "Chase", ...)
│ docType: DocType            │  'brokerage' | 'bank' | 'credit_card'
├─────────────────────────────┤
│ detect(text): boolean       │  O(n) keyword scan, never throws
│ parse(text): ParseResult    │  synchronous, no I/O, never throws
└─────────────────────────────┘
           ▲
           │ implements
    ┌──────┴──────────────────────────────────────────────────┐
    │              │              │                │           │
RobinhoodParser ChaseParser SchwabParser WealthfrontParser  (future)
```

### `ParseResult` (lib/parsers/types.ts)

```
┌───────────────────────────────────────┐
│            ParseResult                │
├───────────────────────────────────────┤
│ success: boolean                      │
│ data?: BrokerageData | BankData       │
│ error?: string                        │
│ confidence?: number   (always 0.99)   │
│ provider?: string     ("dedicated_parser") │
│ model?: string        ("robinhood-v1") │
└───────────────────────────────────────┘
```

This is a strict subset of the existing `ExtractionResult` from `lib/ai/extraction.ts`, so the persistence layer requires zero changes.

---

## 3. Parser-to-PDF Section Mapping

### Robinhood (brokerage, ~22 pages)

```
PDF Section                  Parser target
─────────────────────────    ──────────────────────────────────────────
Page header                → account_holder, account_number, statement_period
Account Summary table      → cash.settled_cash, total_value
Income & Expense Summary   → income_summary.{dividends,stock_lending}
Portfolio Summary (pp 3-8) → holdings[]
  ↳ 2-line-per-holding:
    Line 1: security name
    Line 2: "Estimated Yield: X% SYM TYPE QTY $PRICE $MKT $DIV PCT%"
  ↳ options: name contains "Call"/"Put"; qty "1S" = short
Account Activity (pp 9-15) → transactions[]
  ↳ anchor: MM/DD/YYYY date token
  ↳ transaction codes: CDIV|GDBP|SLIP|Buy|Sell|STO|BTC|STC|BTO|ACH|...
Total Funds Paid/Received  → (validation only, not stored)
```

### Chase (bank, 2 pages)

```
PDF Section                  Parser target
─────────────────────────    ──────────────────────────────────────────
Page header                → account_holder, account_number, statement_period
CHECKING SUMMARY            → beginning_balance, ending_balance
TRANSACTION DETAIL          → transactions[]
  ↳ each row: MM/DD  {desc}  [{amount}]  {balance}
  ↳ credits: only balance shown → amount = balance - prev_balance
  ↳ debits: amount (negative) + balance both present
```

### Charles Schwab (brokerage, ~10 pages)

```
PDF Section                  Parser target
─────────────────────────    ──────────────────────────────────────────
Page header                → account_holder, account_number, statement_period
Account Summary             → total_value (Ending Account Value)
Positions - Equities        → holdings[] with asset_class="equity"
Positions - Exchange Traded Funds → holdings[] with asset_class="etf"
Positions - Other Assets    → holdings[] with asset_class="reit"
  ↳ each row: SYM  DESC(M),◊  QTY  PRICE  MKT_VAL  COST  UNREAL  YIELD  INC  PCT
  ↳ strip (M),◊ annotations; track current section for asset_class
Cash and Cash Investments   → cash.settled_cash (Ending Balance)
Gain or (Loss) Summary      → unrealized_gain_loss
Transaction Details         → transactions[]
  ↳ date: MM/DD (settlement date); paired Purchase + Dividend rows
```

### Wealthfront (bank, 2 pages)

```
PDF Section                  Parser target
─────────────────────────    ──────────────────────────────────────────
Page header                → account_holder, account_number, statement_period
ACCOUNT SUMMARY             → beginning_balance, ending_balance, credits, debits
TRANSACTIONS                → transactions[] (usually "No Transactions" → [])
SWEEP TRANSACTIONS          → (ignored, internal sweep)
```

---

## 4. Detection Priority & Signal Patterns

```
Priority  Parser        Detection signals (checked in order)
────────  ────────────  ──────────────────────────────────────────────────────
1         Robinhood     "robinhood" in first 500 chars (case-insensitive)
                        OR "500 Colonial Center Parkway"
                        OR "help@robinhood.com"

2         Wealthfront   "wealthfront" in first 500 chars (case-insensitive)
                        OR "support@wealthfront.com"

3         Schwab        ("charles" AND "schwab" in first 1000 chars)
                        OR "Schwab One" in first 1000 chars
                        OR "schwab.com" in first 500 chars

4         Chase         "JPMorgan Chase" in first 500 chars
                        OR "Chase Total Checking" in first 1000 chars
                        OR "chase.com" in first 500 chars

5         (fallback)    AI pipeline (no parser matched)
```

All `detect()` calls complete in <1 ms on any modern hardware.

---

## 5. Data Flow Within `extractFromPDF`

```
extractFromPDF(filePath, pdfId, onProgress)
│
├── extractPdfText(filePath)
│       └── returns: pdfText (string)
│
├── findParser(pdfText)          ← NEW (lib/parsers/registry.ts)
│       │
│       ├── [match found]
│       │       │
│       │       └── parser.parse(pdfText)
│       │               │
│       │               └── returns ParseResult {
│       │                     success: true,
│       │                     data: { ...fields, source: 'dedicated_parser' },
│       │                     confidence: 0.99,
│       │                     provider: 'dedicated_parser',
│       │                     model: 'robinhood-v1' | 'chase-v1' | ...
│       │                   }
│       │
│       └── [no match]
│               │
│               └── continue to AI pipeline ↓
│
└── [AI pipeline — unchanged]
        ├── classifyDocument()
        ├── extractBrokerage() / extractBank() / extractCreditCard()
        └── returns ExtractionResult
```

---

## 6. File Structure

```
web/
├── lib/
│   ├── parsers/
│   │   ├── types.ts          ← InstitutionParser interface, ParseResult
│   │   ├── utils.ts          ← parseDollar, parseDate, parseAmount,
│   │   │                        stripAnnotations, extractSection
│   │   ├── registry.ts       ← findParser(text): InstitutionParser | null
│   │   ├── robinhood.ts      ← RobinhoodParser
│   │   ├── chase.ts          ← ChaseParser
│   │   ├── schwab.ts         ← SchwabParser
│   │   └── wealthfront.ts    ← WealthfrontParser
│   └── ai/
│       └── extraction.ts     ← modified: calls findParser() before AI
│
└── __tests__/
    └── parsers/
        ├── utils.test.ts
        ├── robinhood.test.ts
        ├── chase.test.ts
        ├── schwab.test.ts
        └── wealthfront.test.ts
```

---

## 7. No New DB Tables Required

All extracted data flows through the existing persistence path unchanged:

```
ParseResult.data
    │
    ▼
lib/services/extraction.ts  (existing — persists holdings, transactions, balances)
    │
    ├── pdfs              (provider='dedicated_parser', model='chase-v1', ...)
    ├── holdings          (unchanged schema)
    ├── transactions      (unchanged schema)
    ├── account_balances  (unchanged schema)
    └── portfolio_snapshots (unchanged schema)
```

The only fields that change meaning are `pdfs.provider` (was LLM provider name, now `"dedicated_parser"`) and `pdfs.model` (was model ID, now institution slug). Both are `TEXT` columns with no constraints, so no migration is needed.
