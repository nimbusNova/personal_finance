# Implementation Plan - Personal Finance Portfolio Intelligence

## Revised Phase 1 Scope (10-12 weeks)

### Philosophy
- **MVP-first**: Get PDF ingestion working end-to-end before adding complexity
- **Kimi-native**: Zero OCR libraries, let Kimi handle everything
- **Single-user**: No auth complexity, simple password gate
- **Data ownership**: JSON export from day one

---

## Week 1-2: Foundation

### M1: Infrastructure & Auth
**Goal:** Working Next.js + FastAPI + Supabase skeleton

**Backend (FastAPI)**
```
api/
├── main.py                 # FastAPI app
├── config.py              # Settings (Kimi key, Supabase creds)
├── database/
│   ├── connection.py      # Supabase client
│   └── models.py          # SQLAlchemy models from ERD
├── routers/
│   ├── auth.py            # Simple password auth
│   ├── upload.py          # PDF upload endpoint
│   └── health.py          # Health check
└── requirements.txt
```

**Frontend (Next.js)**
```
web/
├── app/
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Dashboard
│   ├── upload/page.tsx    # PDF upload
│   └── login/page.tsx     # Simple password gate
├── components/
│   ├── UploadDropzone.tsx
│   └── Navigation.tsx
├── lib/
│   └── supabase.ts        # Supabase client
└── package.json
```

**Deliverables:**
- [ ] FastAPI running locally
- [ ] Next.js on Vercel
- [ ] Supabase project created
- [ ] Tables created (users, accounts, pdfs, portfolio_snapshots, holdings)
- [ ] Simple password login working

**Stack:**
- Next.js 14 (App Router, TypeScript, Tailwind)
- FastAPI (local dev → Railway for prod)
- Supabase (PostgreSQL + Storage)
- shadcn/ui (components)

---

## Week 3-4: PDF Pipeline Core

### M2: Kimi PDF Ingestion
**Goal:** Upload PDF → Kimi extracts → Store in DB

**Backend Work:**
- [ ] Supabase Storage integration
- [ ] Kimi API client with retry logic
- [ ] Document type detection (brokerage vs credit card)
- [ ] Extraction schema validation
- [ ] `extraction_jobs` table for job tracking

**Kimi Prompts:**
```python
BROKERAGE_PROMPT = """
Analyze this brokerage statement PDF. 
Return JSON with:
- doc_type: "brokerage"
- institution: string
- account_type: string (401k, IRA, Taxable, etc)
- statement_date: YYYY-MM-DD
- holdings: array of {symbol, name, quantity, price, market_value, cost_basis}
- cash: {settled_cash}
- extraction_confidence: 0-1

Be precise. If uncertain, mark low confidence.
"""

CREDIT_CARD_PROMPT = """
Analyze this credit card statement PDF.
Return JSON with:
- doc_type: "credit_card"
- institution: string
- account_name: string
- statement_date: YYYY-MM-DD
- statement_balance: number
- transactions: array of {date, merchant, category, amount}
- extraction_confidence: 0-1

Infer category from merchant name when not explicit.
"""
```

**Frontend Work:**
- [ ] Drag-drop upload zone
- [ ] Progress tracking (per file)
- [ ] Extraction review screen (side-by-side PDF + JSON)
- [ ] Confirm/Correct buttons

**Deliverables:**
- [ ] Upload PDF → see extraction results
- [ ] Review screen with raw PDF and extracted JSON
- [ ] Confirm saves to DB
- [ ] Handle extraction failures gracefully

---

## Week 5: Data Normalization

### M3: Holdings & Transactions
**Goal:** Clean, normalized data ready for analytics

**Backend:**
- [ ] Ticker normalization (VTI → Vanguard Total Stock Market)
- [ ] Asset class resolution (ETF → Equity → US Large Cap)
- [ ] Merchant normalization (AMZN → Amazon)
- [ ] Category standardization
- [ ] Data validation rules:
  - Sum of holdings ≈ total account value
  - No negative quantities
  - Dates within statement period
  - Duplicate transaction detection

**Manual Correction UI:**
- [ ] Edit extracted JSON inline
- [ ] Save corrections to `manual_corrections` table
- [ ] Mark holdings as manually corrected

**Deliverables:**
- [ ] Upload brokerage statement → normalized holdings
- [ ] Upload credit card statement → normalized transactions
- [ ] Can manually fix extraction errors
- [ ] Data validation catches obvious errors

---

## Week 6: Dashboard v1

### M4: Basic Analytics
**Goal:** See your portfolio and spending

**Portfolio View:**
- [ ] Total AUM (across all accounts)
- [ ] Holdings table (symbol, quantity, value, weight %)
- [ ] Simple pie chart: allocation by asset class
- [ ] Cash vs invested breakdown

**Spending View:**
- [ ] Monthly spend by category
- [ ] Top merchants
- [ ] Recent transactions table
- [ ] Flag expensive items (>$200 default)

**Charts:**
- [ ] Recharts for portfolio pie chart
- [ ] Recharts for spending bar chart
- [ ] (Skip Tremor for now — add in Phase 1.5)

**Deliverables:**
- [ ] Dashboard shows current portfolio
- [ ] Dashboard shows spending breakdown
- [ ] Charts render correctly

---

## Week 7-8: Historical Data

### M5: Time Series & Backfill
**Goal:** Upload multiple months → see trends

**Backend:**
- [ ] Batch upload API (multiple PDFs)
- [ ] Chronological processing (oldest first)
- [ ] Detect holding changes between statements
- [ ] Calculate MoM changes
- [ ] Store historical snapshots

**Frontend:**
- [ ] Batch upload UI (drag 12 PDFs at once)
- [ ] Processing queue display
- [ ] Historical charts:
  - Net worth over time
  - Allocation drift
  - Top gainers/losers

**Deliverables:**
- [ ] Upload 12 months of statements
- [ ] See net worth chart over time
- [ ] See how allocation changed

---

## Week 9: AI Suggestions (Core)

### M6: Basic Recommendations
**Goal:** AI suggests portfolio changes with reasoning

**Backend:**
- [ ] Kimi prompt for suggestions:
```python
SUGGESTION_PROMPT = """
Given this portfolio and life stage profile, suggest improvements.

Portfolio: {holdings_json}
Profile: {life_stage_json}

Return array of suggestions:
{
  "suggestions": [
    {
      "type": "rebalance" | "buy" | "sell" | "diversify",
      "action": "Sell $5000 of VTI",
      "reasoning": "Your US equity allocation is 75%, target is 60%...",
      "confidence": 0.85,
      "priority": "high"
    }
  ]
}
"""
```
- [ ] Store suggestions in `ai_suggestions` table
- [ ] Link to `life_stage_profile` for context

**Frontend:**
- [ ] Suggestions inbox (list view)
- [ ] Suggestion detail card (what, why, trade-offs)
- [ ] Accept/Reject/Snooze buttons
- [ ] Decision trail view

**Deliverables:**
- [ ] Dashboard shows 3-5 active suggestions
- [ ] Can accept/reject suggestions
- [ ] Decision history view

---

## Week 10: Life Stage & Monthly Report

### M7: Profile Wizard
**Goal:** Capture user profile for contextual suggestions

**Frontend:**
- [ ] Onboarding wizard (4 steps):
  1. Basic info (age, income)
  2. Risk tolerance (slider 1-10)
  3. Goals (retirement date, major purchases)
  4. Target allocation (auto-suggest from age)
- [ ] Profile edit page
- [ ] Version history (see past profiles)

**Backend:**
- [ ] Auto-generate target allocation from age (120-age rule)
- [ ] Store profile versions
- [ ] Suggestions reference active profile

**Deliverables:**
- [ ] Complete onboarding wizard
- [ ] Profile affects suggestions
- [ ] Can edit profile and see history

---

## Week 11-12: Monthly Report & Polish

### M8: Monthly Report Generation
**Goal:** Auto-generated monthly summary

**Backend:**
- [ ] GitHub Actions cron (1st of month at 6am)
- [ ] Aggregate snapshots from last 30 days
- [ ] Calculate MoM metrics
- [ ] Generate Kimi summary
- [ ] Store in `monthly_reports`

**Frontend:**
- [ ] Monthly report page:
  - Executive summary
  - Net worth change
  - Allocation drift
  - Top gainers/losers
  - Active suggestions
  - Spending summary
- [ ] Report archive (date picker)
- [ ] Email/Telegram notification on completion

**Polish:**
- [ ] Dark mode
- [ ] Mobile responsive (works on phone)
- [ ] Loading states
- [ ] Error handling
- [ ] JSON export button

**Deliverables:**
- [ ] Monthly report auto-generates
- [ ] Viewable in dashboard
- [ ] Responsive on mobile
- [ ] Can export all data as JSON

---

## Phase 1.5 (Post-MVP Enhancements)

After core is working:

| Feature | Effort | Value |
|---------|--------|-------|
| Tremor charts | 2 days | Better visuals |
| Recurring detection | 3 days | Better spending insights |
| PDF print-to-PDF export | 2 days | Share with advisors |
| PWA | 1 day | Home screen icon |
| Kimi narrative reports | 3 days | AI-written summaries |
| Personal manifesto | 2 days | Custom investing rules |

---

## Tech Decisions

### Why FastAPI + Railway (not serverless)?
- Kimi API calls take 10-30 seconds
- Need background job processing
- Python ecosystem for data processing

### Why Supabase?
- Single vendor: DB + Storage + Auth
- Generous free tier
- PostgreSQL (real database)
- Good local dev experience

### Why not Phase 1?
- PWA: Add later, responsive web works
- Diversity scoring: Complex algo, show % first
- AI narrative: Template summaries work
- PDF export: Print to PDF works
- Spending AI insights: Manual categorization first

---

## Success Metrics

**Week 6:** Can upload 1 brokerage statement, see holdings
**Week 8:** Can upload 12 months, see net worth chart
**Week 10:** Getting contextual suggestions
**Week 12:** Monthly report auto-generates, using weekly

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Kimi extraction inaccurate | Manual correction UI, track corrections |
| 12 weeks too long | MVP checkpoints at week 4, 8 |
| Supabase downtime | JSON export from day 1 |
| Complex scope | Cut features to Phase 1.5 |
