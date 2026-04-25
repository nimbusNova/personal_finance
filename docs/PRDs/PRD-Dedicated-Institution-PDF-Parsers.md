# PRD: Dedicated Institution PDF Parsers

**Version:** 1.0  
**Date:** 2026-04-25  
**Status:** Draft  
**Author:** Michael Wu  
**Depends On:** PRD-LLM-Provider-Abstraction.md

---

## 1. Executive Summary

### Current State

The app extracts data from financial PDFs using a 3-stage AI pipeline:
1. **Classify** — LLM reads raw PDF text, identifies institution + doc type
2. **Extract** — LLM parses raw PDF text into structured JSON (holdings / transactions)
3. **Repair** — LLM or heuristic JSON-sanitizer fixes malformed output

Every upload burns LLM tokens (~2–16k per statement), adds 5–30 seconds of latency, introduces non-determinism, and can silently mis-extract numbers (e.g. wrong quantity, dropped holdings). For institutions that publish structured, fixed-format PDFs — like Robinhood, Chase, Charles Schwab, and Wealthfront — the AI is solving a problem that regex and structured text parsing can solve perfectly, every time, for free.

### Proposed State

- **Dedicated parser per institution** — deterministic regex/text-pattern parsers that know exactly where each field lives in each institution's PDF format.
- **Parser registry** — maps detected institution names to their parser implementations, following the same registry pattern used by `lib/ai/registry.ts`.
- **Graceful fallback** — if no dedicated parser matches (unknown institution or version mismatch), fall back to the existing AI pipeline.
- **Zero schema changes** — parsers output the same `ExtractionResult` / data shape that the AI pipeline already produces, so the persistence layer is untouched.

### Why This Change?

| Dimension | AI Pipeline | Dedicated Parser |
|-----------|------------|-----------------|
| Accuracy | ~85–95% (hallucination risk) | ~99.9% (deterministic) |
| Latency | 5–30 seconds | <100 ms |
| Cost | ~$0.01–$0.10 per statement | $0.00 |
| Debuggability | Hard (prompt-sensitive) | Easy (regex line numbers) |
| Coverage | Any institution | Only supported ones |
| Maintenance | Prompt tuning | Update regex on format change |

---

## 2. Current Architecture Analysis

### 2.1 AI Extraction Pipeline (`lib/ai/extraction.ts`)

```
PDF Upload
    │
    ▼
extractPdfText()          ← pdf-parse: raw text from PDF bytes
    │
    ▼
classifyDocument()        ← LLM: doc_type + institution name
    │
    ├─► extractBrokerage()   ← 2 LLM calls: holdings list + account metadata
    ├─► extractBank()        ← 1 LLM call: transactions + balances
    └─► extractCreditCard()  ← 1 LLM call: transactions + statement balance
    │
    ▼
ExtractionResult { success, data, confidence, provider, model }
```

### 2.2 Pain Points

1. **Cost** — Each brokerage statement (e.g. 22-page Robinhood) costs ~2–3 LLM calls, ~8k–20k tokens total.
2. **Non-determinism** — Holdings counts vary run-to-run (e.g. options rows skipped); amounts occasionally rounded wrong.
3. **Latency** — 5–30 seconds blocks the upload UX.
4. **Format fragility** — The LLM cannot reliably distinguish "1S" (short option) vs "1" (long option) in Robinhood's Qty column.
5. **Silent failures** — A confidence score of 0.7 doesn't tell you *which* holding was misread.

### 2.3 What the PDFs Actually Look Like

All four institutions produce **machine-generated, structured PDFs** with consistent column layouts:

| Institution | Doc Type | Pages | Key Structure |
|-------------|----------|-------|---------------|
| Robinhood | Brokerage | ~22 | Fixed-width Portfolio Summary table; Account Activity log |
| Chase | Bank | 2 | Checking Summary box; Transaction Detail table |
| Charles Schwab | Brokerage | ~10 | Positions tables (Equities / ETFs / Other Assets); Transaction Details |
| Wealthfront | Bank | 2 | Account Summary box; Transactions table |

Because `pdf-parse` already extracts clean text preserving column whitespace, these layouts are directly parseable with pattern matching.

---

## 3. Proposed Architecture

### 3.1 High-Level Flow

```
PDF Upload
    │
    ▼
extractPdfText()              ← unchanged (pdf-parse)
    │
    ▼
detectInstitution(text)       ← fast keyword scan, no LLM
    │
    ├─ Robinhood  ──► RobinhoodParser.parse(text)
    ├─ Chase      ──► ChaseParser.parse(text)
    ├─ Schwab     ──► SchwabParser.parse(text)
    ├─ Wealthfront──► WealthfrontParser.parse(text)
    └─ (unknown)  ──► existing AI pipeline (unchanged)
    │
    ▼
ExtractionResult (same shape as before)
```

### 3.2 Parser Interface

```typescript
// lib/parsers/types.ts
export interface InstitutionParser {
  readonly institution: string;          // canonical name, e.g. "Robinhood"
  readonly docType: 'brokerage' | 'bank' | 'credit_card';
  detect(text: string): boolean;         // fast: does this text belong to us?
  parse(text: string): ExtractionResult; // synchronous, no I/O
}
```

### 3.3 Parser Registry

```typescript
// lib/parsers/registry.ts
import { RobinhoodParser }  from './robinhood';
import { ChaseParser }      from './chase';
import { SchwabParser }     from './schwab';
import { WealthfrontParser} from './wealthfront';

const PARSERS: InstitutionParser[] = [
  new RobinhoodParser(),
  new ChaseParser(),
  new SchwabParser(),
  new WealthfrontParser(),
];

export function findParser(text: string): InstitutionParser | null {
  return PARSERS.find(p => p.detect(text)) ?? null;
}
```

### 3.4 Integration Point in Extraction Pipeline

Modify `extractFromPDF()` in `lib/ai/extraction.ts`:

```typescript
export async function extractFromPDF(filePath, pdfId, onProgress) {
  onProgress?.('reading_pdf');
  const pdfText = await extractPdfText(filePath);

  // ── NEW: try dedicated parser first ──
  const parser = findParser(pdfText);
  if (parser) {
    onProgress?.('parsing');
    const result = parser.parse(pdfText);
    result.data.source = 'dedicated_parser';   // audit trail
    return result;
  }

  // ── EXISTING: fall back to AI pipeline ──
  onProgress?.('classifying');
  // ... rest unchanged
}
```

---

## 4. Institution Parser Specifications

### 4.1 Robinhood

**Detection signals** (any one is sufficient):
- Text contains `"Robinhood"` in the first 500 characters
- Text contains `"500 Colonial Center Parkway"` or `"help@robinhood.com"`

**PDF text structure** (as produced by pdf-parse from a sample 22-page statement):

```
Page 1 of 22
03/01/2026 to 03/31/2026
Michael Wu
Individual Account #:562113779
...
Account Summary  Opening Balance  Closing Balance
Brokerage Cash Balance *   $30,761.03   $9,230.69
Deposit Sweep Balance       $0.00        $0.00
Total Securities **         $175,254.64  $193,962.57
Portfolio Value             $206,015.67  $203,193.26
...
Portfolio Summary
Securities Held in Account  Sym/Cusip  Acct Type  Qty  Price  Mkt Value  Est. Dividend Yield  % of Total Portfolio
Apple
Estimated Yield: 0.42%  AAPL  Margin  33.069475  $253.79000  $8,392.70  $35.39  4.05%
...
Account Activity
Description  Symbol  Acct Type  Transaction  Date  Qty  Price  Debit  Credit
Cash Div: R/D 2026-02-09 P/D 2026-03-02 ...  ETR  Margin  CDIV  03/02/2026  ...  $12.89
```

**Fields to extract:**

*Account metadata:*
| Field | Source | Pattern |
|-------|--------|---------|
| `account_holder` | Page header | Line before `"Individual Account"` |
| `account_number` | Page header | `Individual Account #:(\d+)` |
| `statement_date` | Page header | End date of `"MM/DD/YYYY to MM/DD/YYYY"` |
| `account_type` | Literal | `"Individual Brokerage"` |
| `cash.settled_cash` | Account Summary | Closing Balance of `"Brokerage Cash Balance"` |
| `total_value` | Account Summary | Closing Balance of `"Portfolio Value"` |

*Holdings (Portfolio Summary section):*

Each holding spans two lines in the text:
- Line 1: `{name}\nEstimated Yield: {pct}%`
- Line 2: `{symbol}  {acct_type}  {qty}  ${price}  ${mkt_value}  ${div}  {portfolio_pct}%`

Options holdings have an additional name format: `{SYMBOL} {MM/DD/YYYY} {Call|Put} ${strike}`

Special parsing rules:
- **Short options**: `Qty` contains `"1S"` → `quantity = -1`, `is_short = true`
- **Negative market values**: shown as `($38.00)` → parse as `-38.00`
- **Asset class**: Equities vs Options determined by name pattern (`Call`/`Put` keywords)

| Field | Rule |
|-------|------|
| `symbol` | First whitespace-delimited token on data line |
| `quantity` | 3rd token; if `"1S"` then `-1`, else `parseFloat` |
| `price` | 4th token, strip `$` |
| `market_value` | 5th token, strip `$`, handle `(X)` → negative |
| `name` | From preceding name line |

*Transactions (Account Activity section):*

The activity table starts after `"Account Activity"` header and ends at `"Total Funds Paid and Received"`.

Transaction code taxonomy:

| Code | Meaning | Category |
|------|---------|----------|
| `CDIV` | Cash dividend | Income |
| `GDBP` | Gold Deposit Boost Payment | Income |
| `SLIP` | Stock Lending Income Payment | Income |
| `GMPC` | Gold Plan Credit | Fee Credit |
| `Buy` | Stock purchase | Trade |
| `Sell` | Stock sale | Trade |
| `STO` | Sell to open (options) | Options |
| `BTC` | Buy to close (options) | Options |
| `STC` | Sell to close (options) | Options |
| `BTO` | Buy to open (options) | Options |
| `OASGN` | Option assignment | Options |
| `OEXP` | Option expiration | Options |
| `ACH` | ACH deposit/withdrawal | Transfer |

**Output shape:**
```typescript
{
  doc_type: 'brokerage',
  institution: 'Robinhood',
  account_type: 'Individual Brokerage',
  account_holder: string,
  account_number: string,
  statement_date: string,          // ISO: YYYY-MM-DD (closing date)
  statement_period: { start_date, end_date },
  holdings: Holding[],
  cash: { settled_cash: number, unsettled_cash: 0 },
  total_value: number,
  transactions: Transaction[],     // from Account Activity
  income_summary: {
    dividends_period: number,
    dividends_ytd: number,
    stock_lending_period: number,
  },
  extraction_confidence: 0.99,     // deterministic parser
}
```

---

### 4.2 Chase

**Detection signals:**
- Text contains `"JPMorgan Chase Bank"` or `"Chase Total Checking"` or `"Chase.com"` in first 500 chars

**PDF text structure:**

```
JPMorgan Chase Bank, N.A.
P O Box 182051
Columbus, OH 43218 - 2051

December 05, 2025 through January 07, 2026
Account Number:  000000106569236

MICHAEL WU
1702 WINDING WAY
PASADENA CA 91107-1363

CHECKING SUMMARY    Chase Total Checking
                              AMOUNT
Beginning Balance            $8,274.63
Deposits and Additions       24,644.61
Electronic Withdrawals       -29,076.21
Ending Balance               $3,843.03

TRANSACTION DETAIL
 DATE   DESCRIPTION                           AMOUNT    BALANCE
12/05   Tiktok Inc  Payroll  PPD ID: ...      4,618.89  12,893.52
12/05   12/04 Payment To Chase Card IN 9570   -1,944.76 10,948.76
```

**Fields to extract:**

*Account metadata:*
| Field | Source | Pattern |
|-------|--------|---------|
| `account_holder` | Address block | ALL-CAPS name line |
| `account_number` | Header | `Account Number:\s+(\d+)` |
| `statement_date` | Header | End date of `"Month DD, YYYY through Month DD, YYYY"` |
| `statement_period` | Header | Both dates parsed |
| `account_type` | Checking Summary header | e.g. `"Chase Total Checking"` |
| `beginning_balance` | Checking Summary | `Beginning Balance\s+\$?([\d,]+\.\d{2})` |
| `ending_balance` | Checking Summary | `Ending Balance\s+\$?([\d,]+\.\d{2})` |

*Transactions (Transaction Detail section):*

The table starts after `"TRANSACTION DETAIL"` and ends at page end or next section header.

Format is: `{MM/DD}  {description}  {signed_amount}  {running_balance}`

Rules:
- **Positive amount** = credit (deposit, income)
- **Negative amount** = debit (payment, withdrawal)
- Amount and balance columns may be right-aligned; parse by splitting from right
- Description may span multiple words including internal IDs (`PPD ID:`, `Web ID:`, Zelle reference codes)

Description normalization:
| Pattern | Merchant/Category |
|---------|------------------|
| `Payroll PPD ID:` | `Income` → payroll deposit |
| `Zelle Payment From {name}` | `Transfer In` |
| `Zelle Payment To {name}` | `Transfer Out` |
| `Payment To Chase Card Ending IN {last4}` | `Credit Card Payment` |
| `Robinhood Debits {account}` | `Brokerage Transfer` |
| `{Merchant} Web Online` | `Online Payment` / infer category from merchant |
| `{Merchant} Pcs Svc` | `Subscriptions` |
| `Mortgage Pnc Pymt` | `Housing` |
| `Schwab Brokerage Moneylink` | `Brokerage Transfer` |
| `Wealthfront EDI Pymnts` | `Brokerage Transfer` |

**Output shape:**
```typescript
{
  doc_type: 'bank',
  institution: 'Chase',
  account_name: string,            // e.g. "Chase Total Checking"
  account_type: 'checking',
  account_holder: string,
  account_number: string,
  statement_date: string,          // ISO end date
  statement_period: { start_date, end_date },
  beginning_balance: number,
  ending_balance: number,
  transactions: Transaction[],
  extraction_confidence: 0.99,
}
```

---

### 4.3 Charles Schwab

**Detection signals:**
- Text contains `"charles"` and `"SCHWAB"` (case-insensitive) in first 500 chars
- Or `"Schwab One® Account"` or `"Charles Schwab & Co"` in first 1000 chars

**PDF text structure:**

```
Schwab One® Account of
                               Account Number    Statement Period
MICHAEL WU                     7406-8532         March 1-31, 2026
...
Account Summary
...
Ending Account Value as of 03/31   $62,996.62
Beginning Account Value as of 03/01  $55,672.42
...
                           This Statement  YTD
Beginning Account Value    $55,672.42      $51,544.80
Deposits                   10,000.00       14,000.00
...

Positions - Equities
Symbol  Description              Quantity   Price($)   Market Value($)  Cost Basis($)  Unrealized Gain/(Loss)($)  Est. Yield  Est. Annual Income($)  % of Acct
GOOGL   ALPHABET INC (M),◊      0.0771     287.56000  22.17            14.37          7.80                       0.27%       0.06                    <1%

Positions - Exchange Traded Funds
[same columns]

Transaction Details
Date  Category  Action                Symbol/CUSIP  Description              Quantity  Price/Rate per Share($)  Amount($)
03/02 Purchase  Reinvested Shares ETR  ENTERGY CORP NEW  0.0036  107.1229  (0.39)
      Dividend  Qual Div Reinvest ETR  ENTERGY CORP NEW                              0.39
```

**Fields to extract:**

*Account metadata:*
| Field | Source | Pattern |
|-------|--------|---------|
| `account_holder` | Page header | Name line before account number |
| `account_number` | Page header | `(\d{4}-\d{4})` or masked `\*{4}-\*(\d{3})` |
| `statement_date` | Period header | Last day of `"Month D-D, YYYY"` or `"Month D-DD, YYYY"` |
| `account_type` | Literal | `"Schwab One Brokerage"` |
| `ending_value` | Account Summary | `Ending Account Value as of` line |
| `beginning_value` | Account Summary | `Beginning Account Value as of` line |
| `deposits` | Summary table | `Deposits\s+([\d,]+\.\d{2})` |
| `dividends_interest` | Summary table | `Dividends and Interest\s+([\d,]+\.\d{2})` |
| `unrealized_gain_loss` | Gain/Loss Summary | `Unrealized\s+\$?([\d,]+\.\d{2})` |

*Holdings — three sections:*

The document has three separate positions tables: `Positions - Equities`, `Positions - Exchange Traded Funds`, `Positions - Other Assets`. Each uses the same column layout.

Column layout (after header row):
```
{symbol}  {description with annotations}  {quantity}  {price}  {market_value}  {cost_basis}  {unrealized}  {est_yield}  {est_annual_income}  {pct_acct}
```

Annotation stripping rules:
- `(M)` = marginable flag → strip
- `,◊` = dividend reinvestment enabled → strip, set `dividend_reinvest: true`
- `,` at end of description = section separator → strip
- REIT = asset class indicator

Asset class mapping:
| Section | `asset_class` |
|---------|--------------|
| Positions - Equities | `"equity"` |
| Positions - Exchange Traded Funds | `"etf"` |
| Positions - Other Assets | `"reit"` (or infer from REIT label) |

*Transactions:*

The Transaction Details section has compound rows (one Purchase row + one Dividend row per reinvested dividend). Parse each line independently.

| Field | Rule |
|-------|------|
| `date` | Settlement date at line start (`MM/DD`) |
| `category` | `Purchase` / `Dividend` / `Deposit` |
| `action` | `Reinvested Shares` / `Qual Div Reinvest` / `Non-Qualified Div` / `Journaled Funds` / `Div For Reinvest` |
| `symbol` | Token matching ticker pattern |
| `quantity` | Numeric token before price |
| `amount` | Last numeric token; `(X)` → negative |

*Cash:*
| Field | Source |
|-------|--------|
| `settled_cash` | `Cash and Cash Investments` section, Ending Balance |
| `pending_dividends` | `Pending Dividends and Accrued Interest` line |

**Output shape:**
```typescript
{
  doc_type: 'brokerage',
  institution: 'Charles Schwab',
  account_type: 'Schwab One Brokerage',
  account_holder: string,
  account_number: string,
  statement_date: string,          // ISO YYYY-MM-DD (last day of period)
  statement_period: { start_date, end_date },
  holdings: Holding[],             // equities + ETFs + other assets combined
  cash: { settled_cash: number, unsettled_cash: number },
  total_value: number,             // ending_account_value
  cost_basis_total: number,
  unrealized_gain_loss: number,
  transactions: Transaction[],
  extraction_confidence: 0.99,
}
```

---

### 4.4 Wealthfront

**Detection signals:**
- Text contains `"Wealthfront"` in first 300 chars
- Or text contains `"support@wealthfront.com"` or `"Green Dot Bank"` with `"Wealthfront"`

**PDF text structure:**

```
Michael Wu
174 Kayak Dr
San Jose, CA 95111

STATEMENT PERIOD             ACCOUNT NUMBER
Feb. 13, 2026 to Mar. 12, 2026   1015-4449-0900-14

ACCOUNT SUMMARY 1
Beginning Balance on Feb. 13, 2026   $55,290.15
Credits                              + $0.00
Debits                               - $0.00
Ending Balance on Mar. 12, 2026      $55,290.15

TRANSACTIONS
DATE    DESCRIPTION    AMOUNT
No Transactions

SWEEP TRANSACTIONS 2
DATE    DESCRIPTION    AMOUNT
No Transactions
```

**Fields to extract:**

| Field | Source | Pattern |
|-------|--------|---------|
| `account_holder` | Address block | Name line at top |
| `account_number` | Header | `(\d{4}-\d{4}-\d{4}-\d{2})` |
| `statement_date` | Header | End date of `"Mon. DD, YYYY to Mon. DD, YYYY"` |
| `statement_period` | Header | Both dates |
| `beginning_balance` | Account Summary | `Beginning Balance on .+ \$?([\d,]+\.\d{2})` |
| `ending_balance` | Account Summary | `Ending Balance on .+ \$?([\d,]+\.\d{2})` |
| `credits` | Account Summary | `Credits\s+\+ \$?([\d,]+\.\d{2})` |
| `debits` | Account Summary | `Debits\s+- \$?([\d,]+\.\d{2})` |
| `transactions` | Transactions section | Empty if `"No Transactions"` |
| `sweep_transactions` | Sweep Transactions section | Empty if `"No Transactions"` |

**Output shape:**
```typescript
{
  doc_type: 'bank',
  institution: 'Wealthfront',
  account_name: 'Wealthfront Cash Account',
  account_type: 'cash',
  account_holder: string,
  account_number: string,
  statement_date: string,
  statement_period: { start_date, end_date },
  beginning_balance: number,
  ending_balance: number,
  transactions: Transaction[],     // typically empty
  extraction_confidence: 0.99,
}
```

---

## 5. Shared Parsing Utilities

Common helpers needed across parsers, extracted into `lib/parsers/utils.ts`:

```typescript
// Dollar string to number: "$1,234.56" → 1234.56, "($38.00)" → -38.00
parseDollar(s: string): number

// Date string to ISO: "03/02/2026" → "2026-03-02", "Mar. 12, 2026" → "2026-03-12"
parseDate(s: string, yearHint?: string): string

// Signed number: "-1,944.76" → -1944.76, "4,618.89" → 4618.89
parseAmount(s: string): number

// Strip annotation tokens from security description: "(M),◊" → ""
stripAnnotations(s: string): string

// Extract section of text between two header markers
extractSection(text: string, startMarker: RegExp, endMarker: RegExp): string
```

---

## 6. Detection Logic

Detection runs in O(n) over the first 1000 characters of extracted PDF text and is resolved before any parsing begins. The order matters because some institutions share common words (e.g. "Account"):

```
Priority 1: Robinhood   — "Robinhood" (very distinctive)
Priority 2: Wealthfront — "Wealthfront" (very distinctive)
Priority 3: Schwab      — "charles" + "SCHWAB" or "Schwab One"
Priority 4: Chase       — "JPMorgan Chase" or "Chase Total Checking"
Priority 5: (fallback)  — AI pipeline
```

If multiple signals match, the highest-priority parser wins. Each `detect()` must be fast (<1 ms) and must not throw.

---

## 7. Output Schema Compatibility

All parsers must output data that validates against the existing Zod schemas in `lib/ai/extraction.ts`:

| Doc Type | Schema | Required fields |
|----------|--------|----------------|
| `brokerage` | `BrokerageSchema` | `doc_type`, `holdings[]`, `cash` |
| `bank` | `BankSchema` | `doc_type`, `beginning_balance`, `ending_balance`, `transactions[]` |

Parsers set `extraction_confidence: 0.99` to distinguish them from AI output (which ranges 0–1 based on model confidence). The `provider` field is set to `"dedicated_parser"` and `model` to the institution slug (e.g. `"robinhood-v1"`).

---

## 8. Fallback Strategy

If `findParser(text)` returns `null`:
1. Log `[parser] no dedicated parser found, falling back to AI` at info level.
2. Continue into the existing `classifyDocument()` → `extractBrokerage/Bank/CreditCard()` pipeline.
3. The `ExtractionResult` will have `provider` set to the LLM provider name as before.

If a dedicated parser throws an uncaught error:
1. Log the error at warn level with institution name and error message.
2. Fall back to the AI pipeline (do not surface error to user).
3. Mark the result with `fallback_reason: 'parser_error'` in the data object.

---

## 9. Testing Strategy

### 9.1 Unit Tests

For each parser, create `web/__tests__/parsers/{institution}.test.ts`:

- **Golden file tests**: store the raw `pdf-parse` text output from each sample PDF as a fixture file (`__tests__/fixtures/{institution}_sample.txt`). Run the parser against the fixture and assert exact field values.
- **Edge case tests**:
  - Robinhood: short options (`1S`), negative market values `($38.00)`, option assignment events (`OASGN`)
  - Chase: Zelle transactions, multi-word descriptions, PPD IDs
  - Schwab: `(M),◊` annotation stripping, REIT classification, empty periods, compound dividend+purchase rows
  - Wealthfront: `"No Transactions"` → empty array
- **Confidence test**: all parsers return `extraction_confidence >= 0.99`
- **Schema validation test**: parser output passes the relevant Zod schema

### 9.2 Integration Tests

- Upload each sample PDF through the full `/api/v1/upload` route
- Assert: `source === 'dedicated_parser'`, no LLM calls fired
- Assert: all expected holdings/transactions present

### 9.3 Regression Tests

- Run both the AI pipeline and dedicated parser on each sample PDF
- Compare field-by-field; flag any discrepancies for human review
- This acts as a ground truth validation for the AI pipeline's accuracy

---

## 10. Implementation Plan

### Phase 1 — Infrastructure (1–2 days)

- [ ] Create `web/lib/parsers/` directory
- [ ] Define `InstitutionParser` interface in `lib/parsers/types.ts`
- [ ] Create `lib/parsers/utils.ts` with shared helpers (`parseDollar`, `parseDate`, `parseAmount`, `stripAnnotations`, `extractSection`)
- [ ] Create `lib/parsers/registry.ts` with `findParser()`
- [ ] Wire `findParser()` into `extractFromPDF()` in `lib/ai/extraction.ts`
- [ ] Write unit tests for utils

### Phase 2 — Chase + Wealthfront Parsers (1–2 days)

Start with the simpler bank formats:
- [ ] `lib/parsers/chase.ts` — `ChaseParser`
- [ ] `lib/parsers/wealthfront.ts` — `WealthfrontParser`
- [ ] Golden file fixtures from sample PDFs
- [ ] Unit + integration tests passing

### Phase 3 — Schwab Parser (2–3 days)

- [ ] `lib/parsers/schwab.ts` — `SchwabParser`
- [ ] Handle three positions sections (Equities / ETFs / Other Assets)
- [ ] Handle compound transaction rows (Purchase + Dividend on same line group)
- [ ] Unit + integration tests passing

### Phase 4 — Robinhood Parser (2–3 days)

Most complex due to options, short positions, and long activity log:
- [ ] `lib/parsers/robinhood.ts` — `RobinhoodParser`
- [ ] Holdings extraction with options support
- [ ] Activity log extraction with transaction code taxonomy
- [ ] Unit + integration tests passing

### Phase 5 — Validation + Hardening (1 day)

- [ ] Run regression tests (AI vs parser comparison)
- [ ] Add parser version to `ExtractionResult` for auditability
- [ ] Add metrics: log parse time, institution, field counts
- [ ] Update upload UI to show `"Parsed locally"` badge when dedicated parser was used

---

## 11. File Structure

```
web/lib/parsers/
├── types.ts           ← InstitutionParser interface + ParsedDocument types
├── utils.ts           ← parseDollar, parseDate, parseAmount, extractSection, ...
├── registry.ts        ← findParser(), PARSERS array
├── robinhood.ts       ← RobinhoodParser
├── chase.ts           ← ChaseParser
├── schwab.ts          ← SchwabParser
└── wealthfront.ts     ← WealthfrontParser

web/__tests__/parsers/
├── robinhood.test.ts
├── chase.test.ts
├── schwab.test.ts
└── wealthfront.test.ts

web/__tests__/fixtures/
├── robinhood_sample.txt    ← raw pdf-parse output from sample PDF
├── chase_sample.txt
├── schwab_sample.txt
└── wealthfront_sample.txt
```

---

## 12. Open Questions

1. **Format versioning** — Robinhood changed their PDF layout at least once in 2025. Should parsers include a version detection mechanism (e.g. check column header text) and fail explicitly if the layout doesn't match, rather than silently producing wrong output?

2. **Options in holdings** — Should short options (Robinhood `1S` qty) be stored as separate `holdings` entries with `quantity: -1`, or as a separate `options` array on the result? The existing schema has no `options` array.

3. **Transaction completeness for brokerage** — Robinhood's Account Activity includes both trades and cash events (dividends, ACH). Should brokerage parsers populate the `transactions[]` field on the result, or only the `holdings[]`? The current AI pipeline only extracts holdings for brokerage statements.

4. **Wealthfront investment account** — The sample PDF is for the Wealthfront Cash Account (Green Dot Bank). Wealthfront also has an investment account with ETF holdings. Should we support both under the same parser?

5. **PDF format drift** — When Robinhood/Chase/Schwab update their PDF templates, the parser silently fails and falls back to AI. Should we add a `parserVersion` field and alert when a document looks like a supported institution but doesn't match the expected layout?
