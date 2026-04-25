# PRD: Trends Page — Historical Portfolio & Spending Analysis

**Version:** 1.0
**Date:** 2026-04-24
**Status:** Draft
**Author:** AI-assisted

---

## 1. Goal

Add a **Trends** page that visualizes historical changes in net worth, asset allocation, and spending over time. This transforms the app from a static snapshot viewer into a true personal finance intelligence tool where users can spot patterns, measure progress, and identify drift in their financial behavior.

The Trends page is the natural fourth pillar of the Dashboard navigation, complementing **Overview** (current state), **Holdings** (positions), and **Spending** (monthly drill-down).

---

## 2. User Value

| Value | Description |
|-------|-------------|
| **Wealth Trajectory** | See net worth grow (or shrink) over weeks, months, or years — the single most motivating metric for long-term financial health. |
| **Allocation Drift Detection** | Notice when a target allocation drifts (e.g., equity grows to 80% because of market run-up) before it becomes a problem. |
| **Spending Pattern Recognition** | Identify seasonal spending spikes, lifestyle inflation, or category creep month-over-month. |
| **Goal Tracking** | Compare actual net worth against implied goals derived from the life-stage profile. |
| **Month-over-Month Accountability** | Key metric cards show deltas at a glance: "Net worth +5.2% this month" or "Spending -3.1% vs last month." |

---

## 3. Functional Requirements

### 3.1 Time-Range Selector

| ID | Requirement | Priority |
|----|-------------|----------|
| T1.1 | Global time-range selector on the Trends page: **1M**, **3M**, **6M**, **1Y**, **YTD**, **All**. Defaults to **6M**. | P0 |
| T1.2 | Date range is applied to **all** charts on the page simultaneously. | P0 |
| T1.3 | If insufficient data exists for the selected range (e.g., user selects 1Y but only has 2 months of uploads), the UI shows the available data with a subtle "Showing 2 months of data" notice. | P1 |

### 3.2 Net Worth Trend Chart

| ID | Requirement | Priority |
|----|-------------|----------|
| T2.1 | **Line chart** showing total net worth over time. | P0 |
| T2.2 | Net worth = Σ(brokerage snapshot totalValue) + Σ(bank accountBalances) − Σ(credit_card accountBalances). | P0 |
| T2.3 | Data points align to **statement dates** (the natural cadence of user uploads). No interpolation between missing dates. | P0 |
| T2.4 | Y-axis shows currency format. X-axis shows dates (adaptive: MMM YYYY for 6M+, MMM DD for 1M). | P0 |
| T2.5 | Hover tooltip shows exact date and net worth value. | P0 |
| T2.6 | Optional secondary line for **invested value only** (toggleable, off by default). | P1 |
| T2.7 | If no historical data, show empty state: "Upload statements across multiple months to see your net worth trend." | P0 |

### 3.3 Investment Distribution Change

| ID | Requirement | Priority |
|----|-------------|----------|
| T3.1 | **Stacked area chart** showing asset allocation (by `assetClass`) over time. | P0 |
| T3.2 | Asset classes: equity, bond, commodity, cash, cash_equivalent, alternative, unknown. Colors match `AllocationChart.tsx` `COLOR_MAP` for consistency. | P0 |
| T3.3 | Each layer = percentage of total invested value at that snapshot date. | P0 |
| T3.4 | Hover tooltip shows the exact percentage of each asset class at that point in time. | P0 |
| T3.5 | If only one snapshot exists, show a static pie chart (the current allocation) with a note: "Upload more statements to see allocation drift over time." | P1 |
| T3.6 | A small "Target Allocation" dashed line overlay (from `life_stage_profiles.targetAllocationJson`) if a life-stage profile exists. | P2 |

### 3.4 Spending Change

| ID | Requirement | Priority |
|----|-------------|----------|
| T4.1 | **Grouped bar chart** showing total spending per month, broken down by category. | P0 |
| T4.2 | One bar group = one calendar month. Each segment = one transaction category. | P0 |
| T4.3 | Categories ordered by total amount (largest first, left-to-right in legend). | P1 |
| T4.4 | Hover tooltip shows per-category and total for that month. | P0 |
| T4.5 | If no transaction data, show empty state: "Upload credit card or bank statements to see spending trends." | P0 |

### 3.5 Key Metrics (Period-over-Period)

| ID | Requirement | Priority |
|----|-------------|----------|
| T5.1 | **4 stat cards** at the top of the page, styled like `StatCard.tsx`. | P0 |
| T5.2 | Cards: (1) Net Worth Change, (2) Invested Value Change, (3) Spending Change, (4) Top Spending Category Change. | P0 |
| T5.3 | Comparison period = selected range's first data point vs. latest data point. For example, if 6M is selected, compare current month vs. 6 months ago. | P0 |
| T5.4 | Show absolute delta + percentage delta. Color: green for positive net worth / negative spending, red for negative net worth / positive spending. | P0 |
| T5.5 | If not enough data for comparison, show "—" with a tooltip: "Need at least 2 data points." | P1 |

---

## 4. Architecture

### 4.1 Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Charts** | Recharts (already in project) | Used by `AllocationChart.tsx` and `transactions/page.tsx`. Zero additional dependencies. |
| **Chart Types** | `LineChart`, `AreaChart` (stacked), `BarChart` | Recharts native — no extra packages needed. |
| **Responsive** | `ResponsiveContainer` from Recharts | Already used; handles resize automatically. |
| **Tooltips** | Custom Recharts tooltip | Match existing dark theme (`bg-gray-900` border, white text). |

### 4.2 Page Structure

```
web/app/trends/page.tsx
├── TimeRangeSelector (local component)
├── KeyMetricsGrid (4 × StatCard)
├── NetWorthSection
│   └── NetWorthChart (LineChart)
├── AllocationSection
│   └── AllocationHistoryChart (AreaChart stacked)
└── SpendingSection
    └── SpendingTrendChart (BarChart grouped)
```

### 4.3 Reuse Strategy

| Component | Reuse? | Notes |
|-----------|--------|-------|
| `StatCard.tsx` | **Yes** | Already supports `change` prop with TrendingUp/TrendingDown icons. |
| `AllocationChart.tsx` | **Partial** | Reuse `COLOR_MAP` constant for color consistency. The chart itself is a pie chart; Trends needs stacked area. |
| `Navbar.tsx` | **Modify** | Add `{ href: '/trends', label: 'Trends', icon: TrendingUp }` to `dashboardSubItems`. |
| `usePrivacy` | **Yes** | All currency values respect `showAmounts`. |
| `formatCurrencyPrivate` | **Yes** | Used for all monetary values. |

---

## 5. Data Requirements

### 5.1 Data Sources

| Chart | Primary Table(s) | Key Columns |
|-------|-----------------|-------------|
| Net Worth | `portfolio_snapshots`, `accountBalances` | `statementDate`, `totalValue`, `cashBalance` (snapshots); `statementDate`, `balance`, `accountId` → joined with `accounts.accountType` |
| Allocation | `portfolio_snapshots` + `holdings` | `statementDate` (snapshot), `assetClass`, `marketValue` (holding) |
| Spending | `transactions` | `date`, `category`, `amount` |

### 5.2 Aggregation Logic

**Net Worth by Date:**
```typescript
// Pseudocode
for each unique statementDate across snapshots and accountBalances:
  netWorth = 0
  for each snapshot on this date:
    netWorth += snapshot.totalValue
  for each accountBalance on this date:
    account = lookup account
    if account.accountType === 'bank':
      netWorth += balance
    if account.accountType === 'credit_card':
      netWorth -= balance  // debt reduces net worth
```

> Note: In practice, snapshot dates and account balance dates may not perfectly align. Use the closest prior date for each account type if a given date has partial coverage. Document this behavior in the UI with a small info tooltip.

**Allocation by Date:**
```typescript
for each unique snapshot date:
  for each assetClass in ['equity','bond','commodity','cash','cash_equivalent','alternative','unknown']:
    sum marketValue of holdings with that assetClass
  totalInvested = sum of all marketValues
  pct = (sum / totalInvested) * 100
```

**Spending by Month:**
```typescript
for each (year, month) in transactions:
  for each category:
    sum(amount)
```

### 5.3 API Endpoints

| Endpoint | Method | Query Params | Returns |
|----------|--------|--------------|---------|
| `/api/v1/trends/net-worth` | GET | `start_date`, `end_date` (ISO) | `{ data: [{ date, netWorth, investedValue }] }` |
| `/api/v1/trends/allocation` | GET | `start_date`, `end_date` | `{ data: [{ date, equity, bond, commodity, cash, cash_equivalent, alternative, unknown }] }` |
| `/api/v1/trends/spending` | GET | `start_date`, `end_date` | `{ data: [{ year, month, category, total, count }] }` |

**Alternative: Single endpoint**

A single `/api/v1/trends` endpoint returning all three datasets in one request is acceptable and may be preferable to avoid waterfall requests. The frontend can destructure the response:

```json
{
  "netWorth": [...],
  "allocation": [...],
  "spending": [...]
}
```

**Decision:** Start with a single `/api/v1/trends` endpoint. Split later if payload size becomes an issue (unlikely for personal use with SQLite).

---

## 6. UI Specification

### 6.1 Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Trends                                        [1M] [3M] [6M] [1Y] [YTD] [All]  │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐│
│  │ Net Worth  │ │ Invested   │ │ Spending   │ │ Top Cat    ││
│  │  +5.2%     │ │  +3.1%     │ │  -3.1%     │ │  Shopping  ││
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘│
├──────────────────────────────────────────────────────────────┤
│  Net Worth Over Time                                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                                                        │ │
│  │              [Line Chart]                              │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│  Investment Distribution Change                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              [Stacked Area Chart]                      │ │
│  └────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│  Monthly Spending by Category                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              [Grouped Bar Chart]                     │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 Responsive Behavior

| Breakpoint | Layout Change |
|------------|---------------|
| **Desktop (≥1024px)** | 4-column metric cards. Charts side-by-side where space allows (net worth full width, allocation + spending in 2-col grid). |
| **Tablet (768–1023px)** | 2-column metric cards. All charts full width, stacked vertically. |
| **Mobile (<768px)** | 1-column metric cards (scrollable horizontally or stacked). Charts are 300px minimum height. Time range selector becomes a horizontal scroll or dropdown. |

### 6.3 Dark Theme Styling

All charts must use the existing dark theme:

- Background: transparent (inherits `bg-gray-800` card background)
- Grid lines: `stroke="#374151"` (gray-700)
- Axis text: `fill="#9ca3af"` (gray-400)
- Tooltip: `backgroundColor: '#1f2937'`, `border: '1px solid #374151'` (matches existing)
- Recharts default margin: `{ top: 10, right: 10, left: 0, bottom: 0 }` with `left` increased to 40 if Y-axis labels are wide.

---

## 7. Performance Considerations

### 7.1 Data Volume Assumptions

- **Portfolio snapshots:** ~12 per year (monthly statements) × N accounts. For 5 accounts over 5 years = 300 rows.
- **Holdings:** ~20–50 per snapshot = 6,000–15,000 rows over 5 years.
- **Transactions:** ~100–300 per month. Over 5 years = 6,000–18,000 rows.

All well within SQLite's comfort zone. Aggregation queries should complete in <100ms.

### 7.2 Optimization Strategies

| Strategy | Priority | Notes |
|----------|----------|-------|
| **Server-side aggregation** | P0 | Do all grouping/summing in SQL (Drizzle `sql` helper or raw SQLite). Return pre-aggregated JSON. |
| **Single request** | P0 | One `/api/v1/trends` call per page load, not three. |
| **No client-side caching needed** | P1 | Data changes only when new statements are uploaded. Simple `useEffect` fetch on mount is sufficient. |
| **Lazy chart loading** | P2 | If bundle size becomes a concern, dynamic import `recharts` components. Not needed initially. |

---

## 8. Database Queries (Reference Implementation)

### 8.1 Net Worth Trend

```typescript
// Drizzle pseudocode
const snapshots = db
  .select({
    date: schema.portfolioSnapshots.statementDate,
    totalValue: sql<number>`SUM(${schema.portfolioSnapshots.totalValue})`,
    cashBalance: sql<number>`SUM(${schema.portfolioSnapshots.cashBalance})`,
  })
  .from(schema.portfolioSnapshots)
  .groupBy(schema.portfolioSnapshots.statementDate)
  .all();

const balances = db
  .select({
    date: schema.accountBalances.statementDate,
    type: schema.accounts.accountType,
    total: sql<number>`SUM(${schema.accountBalances.balance})`,
  })
  .from(schema.accountBalances)
  .innerJoin(schema.accounts, eq(schema.accountBalances.accountId, schema.accounts.id))
  .groupBy(schema.accountBalances.statementDate, schema.accounts.accountType)
  .all();
```

### 8.2 Allocation History

```typescript
const allocationHistory = db
  .select({
    date: schema.portfolioSnapshots.statementDate,
    assetClass: schema.holdings.assetClass,
    totalValue: sql<number>`SUM(${schema.holdings.marketValue})`,
  })
  .from(schema.holdings)
  .innerJoin(schema.portfolioSnapshots, eq(schema.holdings.snapshotId, schema.portfolioSnapshots.id))
  .groupBy(schema.portfolioSnapshots.statementDate, schema.holdings.assetClass)
  .all();
```

### 8.3 Spending Trend

```typescript
const spendingTrend = db
  .select({
    year: sql<number>`strftime('%Y', ${schema.transactions.date})`,
    month: sql<number>`strftime('%m', ${schema.transactions.date})`,
    category: schema.transactions.category,
    total: sql<number>`SUM(${schema.transactions.amount})`,
    count: sql<number>`COUNT(*)`,
  })
  .from(schema.transactions)
  .groupBy(
    sql`strftime('%Y', ${schema.transactions.date})`,
    sql`strftime('%m', ${schema.transactions.date})`,
    schema.transactions.category
  )
  .all();
```

---

## 9. Empty States

| Condition | Message |
|-----------|---------|
| No portfolio snapshots | "Upload brokerage statements to see your net worth trend." |
| Only 1 snapshot | "Upload more monthly statements to see how your allocation changes over time." |
| No transactions | "Upload credit card or bank statements to see spending trends." |
| Data exists but range filter yields nothing | "No data in the selected time range. Try a wider range." |

---

## 10. Dependencies

| Package | Version | Already Installed? |
|---------|---------|-------------------|
| `recharts` | `^2.10.0` | ✅ Yes (used by AllocationChart, TransactionsPage) |
| `lucide-react` | — | ✅ Yes (need `TrendingUp` icon for navbar) |
| `clsx` / `tailwind-merge` | — | ✅ Yes (used throughout) |

**No new dependencies required.**

---

## 11. Checklist

### Backend
- [ ] Create `web/app/api/v1/trends/route.ts` with GET handler
- [ ] Implement net worth aggregation query (snapshots + accountBalances)
- [ ] Implement allocation history aggregation query (snapshots + holdings)
- [ ] Implement spending trend aggregation query (transactions grouped by Y-M + category)
- [ ] Support `start_date` and `end_date` query params for filtering
- [ ] Add `jsonResponse` wrapper for consistent response format

### Frontend
- [ ] Create `web/app/trends/page.tsx` page component
- [ ] Add `Trends` item to `dashboardSubItems` in `Navbar.tsx`
- [ ] Create `TrendKeyMetrics` component (4 StatCards with period-over-period deltas)
- [ ] Create `NetWorthChart` component (Recharts `LineChart`)
- [ ] Create `AllocationHistoryChart` component (Recharts `AreaChart` stacked)
- [ ] Create `SpendingTrendChart` component (Recharts `BarChart` grouped)
- [ ] Create `TimeRangeSelector` component (1M / 3M / 6M / 1Y / YTD / All)
- [ ] Add `getTrends(startDate, endDate)` to `web/lib/api.ts`
- [ ] Wire up `usePrivacy` context for amount masking
- [ ] Implement empty states for all three chart sections
- [ ] Responsive layout (grid breakpoints: 1-col mobile, 2-col tablet, 4-col desktop for metrics)

### Polish
- [ ] Chart tooltips match existing dark theme
- [ ] Time-range selector updates all charts simultaneously
- [ ] Page handles "insufficient data" gracefully (single data point, no transactions, etc.)
- [ ] `npm run build` passes with no errors
- [ ] Mobile testing: charts readable at 375px width

---

## 12. Future Enhancements (Post-MVP)

| Feature | Description |
|---------|-------------|
| **Benchmark Overlay** | Add S&P 500 or custom benchmark line to net worth chart for relative performance context. |
| **Drill-down on Allocation** | Click a date point on the stacked area chart to see the exact holdings table for that snapshot. |
| **Category Trend Drill-down** | Click a bar segment to open a modal of transactions in that category for that month (reuses existing transaction modal pattern). |
| **Life-Stage Goal Line** | Overlay target net worth trajectory from life-stage profile onto the net worth chart. |
| **Export** | "Download CSV" button for each chart's raw data. |
| **Annotations** | Manual annotations on the chart ("Bought house", "Market crash") stored in a new `timeline_events` table. |

---

## 13. Decisions Log

| Question | Decision |
|----------|----------|
| Single or multiple API endpoints? | **Single** (`/api/v1/trends`) — one request, simpler frontend. Split if payload grows. |
| Chart library? | **Recharts** — already in project, used by 2 existing pages. No new dependency. |
| How to align snapshot vs. account balance dates? | Use exact statement dates. If a date has snapshots but no account balance, use the most recent prior balance. Document in tooltip. |
| Net worth definition? | Snapshots totalValue + bank balances − credit card debt. Cash within brokerage is included in snapshot totalValue. |
| What if user has only 1 data point? | Show the single point on the line chart (looks like a dot). Show allocation as a static pie chart. Show empty state for spending if no transactions. |
| Time range default? | **6M** — balances recency with enough data for meaningful trend lines. |
| YTD behavior? | January 1 of current year to now. If no data in Jan, show from first available date in year. |
