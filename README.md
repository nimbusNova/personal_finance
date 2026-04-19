# Personal Finance - Portfolio Intelligence (SQLite Edition)

**100% Self-Hosted** | **Zero Accounts Required** | **Local-First**

PDF-first portfolio tracking with AI-powered suggestions. Runs entirely on your machine.

## Quick Start

### 1. Clone
```bash
git clone github-nimbusnova:nimbusNova/personal_finance.git
cd personal_finance
```

### 2. Backend Setup
```bash
cd api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env with your KIMI_API_KEY

# Initialize SQLite database
python -c "from app.database import init_db; init_db()"
```

### 3. Frontend Setup (Choose npm or Bun)

**Option A: npm (Node 18+)**
```bash
cd web
npm install
```

**Option B: Bun (Faster)** ⚡
```bash
# Install Bun if you don't have it:
curl -fsSL https://bun.sh/install | bash

# Then:
cd web
bun install
```

### 4. Start the App

**With npm:**
```bash
./start.sh
```

**With Bun (faster installs and dev server):** ⚡
```bash
./start-bun.sh
```

### 5. Open http://localhost:3000

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

## npm vs Bun

| Feature | npm | Bun |
|---------|-----|-----|
| Install speed | ~30s | ~3s |
| Dev server | Fast | Faster |
| Lockfile | package-lock.json | bun.lockb |
| Compatibility | Standard | 99% compatible |

Both work identically. Bun is significantly faster but optional.

## Usage

### Start the app
```bash
./start.sh      # Uses npm
./start-bun.sh  # Uses Bun (faster)
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
├── docs/                   # PRD, ERD, Implementation Plan
├── start.sh               # Start with npm
└── start-bun.sh           # Start with Bun (faster)
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