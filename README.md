# Personal Finance - Portfolio Intelligence (SQLite Edition)

**100% Self-Hosted** | **Zero Accounts Required** | **Local-First"

PDF-first portfolio tracking with AI-powered suggestions. Runs entirely on your machine.

## Quick Start

```bash
# 1. Clone
git clone github-nimbusnova:nimbusNova/personal_finance.git
cd personal_finance

# 2. Backend setup
cd api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your KIMI_API_KEY
python database/init_db.py  # Creates SQLite database

# 3. Run backend
uvicorn app.main:app --reload --port 8000

# 4. Frontend (new terminal)
cd web
npm install
npm run dev

# 5. Open http://localhost:3000
```

## What's Different?

| Feature | Original (Cloud) | This Edition (Local) |
|---------|------------------|---------------------|
| Database | Supabase PostgreSQL | SQLite (local file) |
| Storage | Supabase Storage | Local filesystem |
| Deployment | Vercel + Railway | Local only |
| Accounts | Required | None needed |
| Privacy | Data in cloud | Data stays on your machine |
| Setup | 3 cloud accounts | Just run locally |

## Data Storage

All data stored locally in `api/data/`:

```
api/data/
├── personal_finance.db    # SQLite database
├── pdfs/
│   └── 2024/
│       └── 01/
│           └── {uuid}.pdf
└── exports/
    └── 2024-04-18_export.json
```

## Usage

### Start the app

```bash
./start.sh  # Starts both backend (8000) and frontend (3000)
```

### Export your data

```bash
cd api
python scripts/export_data.py --format json
# → data/exports/2024-04-18_personal_finance.json
```

### Backup database

```bash
cp api/data/personal_finance.db backups/personal_finance_$(date +%Y%m%d).db
```

## Project Structure

```
personal_finance/
├── api/                    # FastAPI backend
│   ├── app/
│   │   ├── database/       # SQLite models
│   │   ├── services/       # PDF + Kimi services
│   │   └── routers/        # API endpoints
│   ├── data/              # Local storage (gitignored)
│   └── requirements.txt
├── web/                    # Next.js frontend
│   └── app/
└── docs/                   # PRD, ERD, Implementation Plan
```

## Documentation

- `docs/PRD.md` - Product requirements
- `docs/ERD.md` - SQLite database schema
- `docs/IMPLEMENTATION_PLAN.md` - 10-week plan

## Roadmap

**Phase 1 (10 weeks):** Local MVP
- PDF upload & Kimi extraction
- Portfolio dashboard
- Spending analysis
- AI suggestions
- Monthly reports (local cron)

**Phase 2 (Future):** Optional cloud
- PostgreSQL migration
- S3 storage
- Vercel + Railway deploy
- Multi-user support

## License

MIT - Use freely, modify as needed.
