# Personal Finance - Portfolio Intelligence

PDF-first portfolio tracking with AI-powered suggestions.

## Project Structure

```
├── api/                    # FastAPI backend
│   ├── app/
│   │   ├── database/       # Supabase models & connection
│   │   ├── routers/        # API endpoints
│   │   ├── config.py       # Configuration
│   │   └── main.py         # FastAPI app
│   ├── requirements.txt
│   └── .env.example
├── web/                    # Next.js frontend
│   ├── app/                # Next.js 14 App Router
│   ├── package.json
│   └── tailwind.config.ts
└── docs/
    ├── PRDs/               # Product requirements
    ├── ERD.md              # Database schema
    └── IMPLEMENTATION_PLAN.md

## Quick Start

### 1. Backend (API)

```bash
# Setup
cd api
cp .env.example .env
# Edit .env with your Supabase and Kimi credentials

# Create virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend (Web)

```bash
cd web
nvm use  # Uses Node 18
npm install
npm run dev
```

### 3. Supabase Setup

1. Create project at https://supabase.com
2. Run SQL from `docs/ERD.md` to create tables
3. Create storage bucket named `pdfs`
4. Add credentials to `api/.env`

## Phase 1 Status

- [x] Project structure
- [x] FastAPI backend scaffold
- [x] Next.js frontend scaffold
- [x] Database models (ERD)
- [ ] Supabase setup
- [ ] API endpoints implementation
- [ ] Frontend pages
- [ ] Kimi integration

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register user |
| POST | `/api/v1/auth/login` | Login |
| GET | `/api/v1/auth/me` | Current user |
| POST | `/api/v1/upload` | Upload PDF |
| POST | `/api/v1/upload/batch` | Upload multiple PDFs |
| GET | `/api/v1/holdings` | Get holdings |
| GET | `/api/v1/transactions` | Get transactions |
| GET | `/api/v1/suggestions` | Get AI suggestions |
| POST | `/api/v1/suggestions/{id}/feedback` | Update suggestion |

## Environment Variables

See `api/.env.example` for required variables.
