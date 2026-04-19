# Implementation Plan - Personal Finance Portfolio Intelligence (SQLite Edition)

## Philosophy
- **Phase 1: Local-first by default**: SQLite database + local file storage
- **Zero Accounts Required**: Run locally without cloud services
- **Simple Deployment**: Just run the app, no external setup
- **Kimi-native**: PDF extraction via Kimi API
- **Single-user**: Simple password auth
- **Phase 2 (Future)**: Optional cloud deployment (PostgreSQL, S3, etc.)

## Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Database | SQLite (local file) | `data/personal_finance.db` |
| File Storage | Local filesystem | `data/pdfs/{year}/{month}/` |
| Backend | FastAPI | Python, runs locally |
| Frontend | Next.js 14 | TypeScript, Tailwind |
| AI | Kimi API (Moonshot) | PDF extraction |
| Charts | Recharts | React charting |
| Auth | Simple password | Local JWT |

## Directory Structure

```
personal_finance/
├── api/                          # FastAPI backend
│   ├── app/
│   │   ├── main.py              # FastAPI app
│   │   ├── config.py            # SQLite path, Kimi key
│   │   ├── database/
│   │   │   ├── connection.py    # SQLite engine
│   │   │   ├── models.py        # SQLAlchemy models
│   │   │   └── init_db.py       # Create tables
│   │   ├── services/
│   │   │   ├── pdf_service.py   # Local file storage
│   │   │   └── kimi_service.py  # Kimi API wrapper
│   │   └── routers/
│   │       ├── auth.py          # Simple password auth
│   │       ├── upload.py        # PDF upload to local storage
│   │       ├── holdings.py      # Portfolio data
│   │       ├── transactions.py  # Spending data
│   │       └── suggestions.py   # AI suggestions
│   ├── data/                     # Local data (gitignored)
│   │   ├── personal_finance.db # SQLite database
│   │   ├── pdfs/                # PDF storage
│   │   │   └── {year}/
│   │   │       └── {month}/
│   │   │           └── {uuid}.pdf
│   │   └── exports/             # JSON/CSV exports
│   ├── requirements.txt
│   └── .env                     # Kimi API key
├── web/                          # Next.js frontend
│   ├── app/                     # App router
│   ├── lib/api.ts               # API client
│   └── package.json
├── docs/                         # Documentation
│   ├── ERD.md                   # SQLite schema
│   ├── PRD.md                   # Original PRD
│   └── IMPLEMENTATION_PLAN.md   # This file
└── start.sh                      # Start both services
```

---

## Phase 1: MVP (10 weeks)

### Week 1: Foundation

**Goal:** SQLite database + local file storage working

**Backend:**
- [ ] Create `api/database/init_db.py` to initialize SQLite
- [ ] Update `api/database/connection.py` for SQLite
- [ ] Create `api/data/` directory structure
- [ ] Update `api/config.py` for local paths
- [ ] Update requirements (remove supabase, add sqlalchemy)

**Key Changes:**
```python
# database/connection.py
from sqlalchemy import create_engine
from app.config import get_settings

engine = create_engine('sqlite:///data/personal_finance.db')
```

**Deliverables:**
- [ ] Run `python api/database/init_db.py` → creates SQLite database
- [ ] FastAPI starts with SQLite connection
- [ ] Health check endpoint works

---

### Week 2: Local File Storage + Kimi

**Goal:** Upload PDF → Save locally → Kimi extracts

**Backend:**
- [ ] Create `api/services/pdf_service.py`
  - Save uploaded PDF to `data/pdfs/{year}/{month}/{uuid}.pdf`
  - Generate file path, create directories
- [ ] Create `api/services/kimi_service.py`
  - Call Kimi API with PDF path
  - Handle retries, errors
  - Return structured JSON
- [ ] Update `api/routers/upload.py`
  - Save file locally instead of Supabase
  - Trigger Kimi extraction
  - Save metadata to SQLite

**File Storage:**
```python
# Save PDF
file_id = str(uuid.uuid4())
file_path = f"data/pdfs/{year}/{month}/{file_id}.pdf"
os.makedirs(os.path.dirname(file_path), exist_ok=True)
with open(file_path, 'wb') as f:
    f.write(file_content)
```

**Deliverables:**
- [ ] Upload PDF → saved to `data/pdfs/`
- [ ] Kimi extracts data from PDF
- [ ] Extraction metadata saved to SQLite

---

### Week 3: Extraction Review UI

**Goal:** User can review and correct Kimi extractions

**Frontend:**
- [ ] Create `web/app/upload/page.tsx`
  - Drag-drop upload zone
  - Progress tracking
- [ ] Create review screen
  - Show PDF side-by-side with extracted JSON
  - Edit JSON inline
  - Confirm/Correct buttons
- [ ] Update `web/lib/api.ts` for local API calls

**Backend:**
- [ ] Endpoint to get PDF + extraction data
- [ ] Endpoint to save corrections

**Deliverables:**
- [ ] Upload PDF → see review screen
- [ ] Can edit extraction results
- [ ] Confirm saves to database

---

### Week 4: Data Normalization

**Goal:** Clean, normalized holdings and transactions

**Backend:**
- [ ] Ticker normalization (VTI → name, asset class)
- [ ] Asset class resolution
- [ ] Category standardization
- [ ] Data validation:
  - Sum of holdings ≈ total value
  - No negative quantities
  - Duplicate detection
- [ ] `manual_corrections` table

**Deliverables:**
- [ ] Brokerage statement → normalized holdings
- [ ] Credit card statement → normalized transactions
- [ ] Data validation catches errors

---

### Week 5: Dashboard v1

**Goal:** See portfolio and spending

**Frontend:**
- [ ] Dashboard layout
  - Total net worth card
  - Holdings table
  - Simple pie chart (allocation)
- [ ] Spending view
  - Monthly by category
  - Recent transactions
  - Expensive items (>$200)

**Backend:**
- [ ] `/api/v1/portfolio/summary` endpoint
- [ ] `/api/v1/transactions/summary` endpoint

**Deliverables:**
- [ ] Dashboard shows portfolio
- [ ] Dashboard shows spending
- [ ] Charts render with Recharts

---

### Week 6: Historical Data

**Goal:** Multiple statements → time series

**Backend:**
- [ ] Batch upload (multiple PDFs)
- [ ] Chronological processing
- [ ] Historical snapshots
- [ ] Net worth over time calculation

**Frontend:**
- [ ] Batch upload UI
- [ ] Net worth chart (time series)
- [ ] Allocation drift chart

**Deliverables:**
- [ ] Upload 12 months of statements
- [ ] See net worth over time
- [ ] See allocation changes

---

### Week 7: AI Suggestions

**Goal:** Kimi suggests portfolio improvements

**Backend:**
- [ ] Suggestion prompt for Kimi
- [ ] Store suggestions in SQLite
- [ ] Link to life stage profile

**Frontend:**
- [ ] Suggestions inbox
- [ ] Suggestion detail (what, why, trade-offs)
- [ ] Accept/Reject/Snooze buttons

**Deliverables:**
- [ ] Dashboard shows active suggestions
- [ ] Can accept/reject suggestions

---

### Week 8: Life Stage Profile

**Goal:** Capture user profile for contextual suggestions

**Frontend:**
- [ ] Onboarding wizard:
  1. Age, income
  2. Risk tolerance (1-10)
  3. Goals (retirement, house, etc)
  4. Target allocation
- [ ] Profile edit page

**Backend:**
- [ ] Auto-generate target allocation (120-age rule)
- [ ] Store profile versions

**Deliverables:**
- [ ] Complete onboarding
- [ ] Profile affects suggestions

---

### Week 9: Monthly Report (Local)

**Goal:** Generate monthly report locally

**Backend:**
- [ ] Create `api/scripts/generate_monthly_report.py`
- [ ] Aggregate last 30 days
- [ ] Calculate MoM metrics
- [ ] Generate Kimi summary
- [ ] Save report to `data/reports/{year}-{month}.json`

**Frontend:**
- [ ] Monthly report page
- [ ] Report archive

**CLI Usage:**
```bash
python api/scripts/generate_monthly_report.py
# or add to crontab:
# 0 9 1 * * cd ~/Desktop/nimbusnova/personal_finance && python api/scripts/generate_monthly_report.py
```

**Deliverables:**
- [ ] Generate monthly report via CLI
- [ ] View report in dashboard

---

### Week 10: Export & Polish

**Goal:** Data ownership + polish

**Backend:**
- [ ] Create `api/scripts/export_data.py`
  - JSON export: `python export_data.py --format json`
  - CSV export: `python export_data.py --format csv`
- [ ] Database backup helper

**Frontend:**
- [ ] Export button in UI
- [ ] Dark mode polish
- [ ] Mobile responsive

**Deliverables:**
- [ ] Export all data as JSON/CSV
- [ ] SQLite backup works
- [ ] Polished UI

---

## Usage

### Start the app

```bash
# 1. Setup (one-time)
cd ~/Desktop/nimbusnova/personal_finance

# Backend
cd api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your KIMI_API_KEY
python database/init_db.py

# Frontend (new terminal)
cd web
npm install

# 2. Run (every time)
./start.sh
# → Backend: http://localhost:8000
# → Frontend: http://localhost:3000
```

### Generate monthly report

```bash
cd ~/Desktop/nimbusnova/personal_finance/api
source venv/bin/activate
python scripts/generate_monthly_report.py
```

### Export your data

```bash
cd ~/Desktop/nimbusnova/personal_finance/api
python scripts/export_data.py --format json
# → data/exports/2024-04-18_personal_finance.json
```

### Backup database

```bash
cp data/personal_finance.db backups/personal_finance_$(date +%Y%m%d).db
```

---

## Phase 2 (Future): Optional Cloud

Planned for public/cloud deployment:

1. **PostgreSQL migration**
   ```bash
   sqlite3 data/personal_finance.db .dump > backup.sql
   # Import to PostgreSQL
   ```

2. **Cloud storage**: Move `data/pdfs/` to S3-compatible storage

3. **Deploy FastAPI**: Railway/Render

4. **Deploy Next.js**: Vercel

5. **Add multi-tenant auth**: Clerk or Supabase Auth

---

## Benefits of SQLite Edition

| Benefit | Description |
|---------|-------------|
| **No accounts** | Just run, no signup |
| **Privacy** | Data stays on your machine |
| **Offline** | Works without internet (except Kimi API) |
| **Simple** | One command to start |
| **Portable** | Copy folder to any machine |
| **Durable** | SQLite is battle-tested |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Data loss | JSON export, SQLite backups |
| Single-machine | Can sync `data/` folder via Dropbox/iCloud |
| Concurrency | Not an issue for single-user |
| Kimi API downtime | Queue jobs, retry later |

---

## Files to Update

1. `api/requirements.txt` - Remove supabase, add sqlalchemy
2. `api/config.py` - Change to SQLite paths
3. `api/database/connection.py` - SQLite engine
4. `api/database/models.py` - Already compatible
5. `api/routers/upload.py` - Local file storage
6. `api/routers/auth.py` - Remove Supabase, use SQLite
7. `api/routers/*.py` - Update queries to use SQLAlchemy
8. `web/lib/api.ts` - Remove Supabase client, use fetch
9. Add `api/services/pdf_service.py`
10. Add `api/services/kimi_service.py`
11. Add `api/database/init_db.py`
12. Add `api/scripts/generate_monthly_report.py`
13. Add `api/scripts/export_data.py`
14. Add `start.sh`
15. Update `README.md`
