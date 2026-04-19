# Personal Finance - Portfolio Intelligence (SQLite Edition)

**100% Self-Hosted** | **Zero Accounts Required** | **Local-First**

PDF-first portfolio tracking with AI-powered suggestions. Runs entirely on your machine with Bun + SQLite.

## Requirements

- **Bun** (Node.js alternative) - [Install](https://bun.sh/)
- **Python 3.10+** - For FastAPI backend

## Quick Start

### 1. Install Bun
```bash
curl -fsSL https://bun.sh/install | bash
# Restart your terminal after installation
```

### 2. Clone & Setup
```bash
git clone github-nimbusnova:nimbusNova/personal_finance.git
cd personal_finance
```

### 3. Backend Setup
```bash
cd api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env with your KIMI_API_KEY

# Initialize SQLite database
python -c "from app.database import init_db; init_db()"
cd ..
```

### 4. Frontend Setup (Bun)
```bash
cd web
bun install
cd ..
```

### 5. Start the App
```bash
./start.sh
# → Backend: http://localhost:8000
# → Frontend: http://localhost:3000
```

## Why Bun?

| Feature | Bun vs npm |
|---------|-----------|
| Install speed | **10x faster** (~3s vs ~30s) |
| Dev server | **Faster HMR** |
| Runtime | **Native TypeScript support** |
| All-in-one | Bundler, test runner, package manager |

## What's Different?

| Feature | Original (Cloud) | This Edition (Local) |
|---------|------------------|---------------------|
| Database | Supabase PostgreSQL | **SQLite** (local file) |
| Storage | Supabase Storage | **Local filesystem** |
| Frontend | npm | **Bun** |
| Deployment | Vercel + Railway | **Local only** |
| Accounts | Required | **None needed** |
| Privacy | Data in cloud | **Data stays on your machine** |

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
├── web/                    # Next.js frontend (Bun)
│   ├── app/               # App router
│   ├── bun.lockb          # Bun lockfile
│   └── package.json
├── docs/                   # PRD, ERD, Implementation Plan
└── start.sh               # Start script (uses Bun)
```

## Testing

### Run all tests with coverage
```bash
./test.sh
```

### Run quick unit tests only
```bash
./test-quick.sh
```

### Run specific test categories
```bash
cd api
source venv/bin/activate

# Unit tests only (fast)
pytest -m unit

# Integration tests
pytest -m integration

# With coverage report
pytest --cov=app --cov-report=html
# Open api/htmlcov/index.html in browser
```

### Test structure
```
api/tests/
├── conftest.py           # Fixtures and config
├── test_models.py        # Database model tests
├── test_pdf_service.py   # PDF service tests
├── test_kimi_service.py  # Kimi API tests
└── test_api.py           # API endpoint tests
```

---

## Development Workflow

### 1. Start the app
```bash
./start.sh
```

### 2. Run tests while developing
```bash
# Terminal 1: Keep app running
./start.sh

# Terminal 2: Run tests on changes
./test-quick.sh
```

### 3. Check coverage before committing
```bash
./test.sh
```

## Documentation

- `docs/PRD.md` - Product requirements
- `docs/ERD.md` - SQLite database schema
- `docs/IMPLEMENTATION_PLAN.md` - 10-week implementation plan

## Phase 1: MVP (10 weeks)

| Week | Milestone |
|------|-----------|
| 1-2 | SQLite + local file storage + Bun setup |
| 3-4 | PDF upload + Kimi extraction |
| 5-6 | Dashboard + holdings view |
| 7-8 | Historical data + time series |
| 9-10 | AI suggestions + monthly reports |

## Phase 2 (Future): Optional Cloud

When ready for public/cloud deployment:
- PostgreSQL migration
- S3 storage
- Vercel + Railway deploy
- Multi-user support

## License

MIT - Use freely, modify as needed.
