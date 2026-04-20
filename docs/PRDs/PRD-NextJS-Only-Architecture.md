# PRD: Next.js Only Architecture — Removing Python Backend

**Version:** 1.0  
**Date:** 2026-04-19  
**Status:** Draft  
**Author:** Michael Wu

---

## 1. Executive Summary

### Current State
- **Frontend:** Next.js 14 (React + TypeScript) — `/web`
- **Backend:** FastAPI (Python) — `/api`
- **Database:** SQLite via SQLAlchemy ORM
- **AI Service:** Kimi (Moonshot) API integration

### Proposed State
- **Full-Stack:** Next.js 14 with API Routes (no separate Python backend)
- **Database:** SQLite via `better-sqlite3` or `libsql` (Turso's local SQLite)
- **AI Service:** Direct Kimi API calls from Next.js API routes
- **File Storage:** Local filesystem via Node.js streams

### Why This Change?
1. **Simplified Deployment** — Single process to run, single package to install
2. **Unified Development** — One language (TypeScript), one framework
3. **Better Self-Hosting** — No Python environment management
4. **Reduced Complexity** — Eliminate CORS, dual-server coordination
5. **Cross-Platform** — Better Windows/macOS/Linux support

---

## 2. Architecture Comparison

### Current (FastAPI + Next.js)
```
┌─────────────┐      HTTP/REST      ┌─────────────┐      SQL      ┌──────────┐
│  Next.js    │◄──────────────────►│   FastAPI   │◄────────────►│  SQLite  │
│  (Port 3000)│   (CORS Required)   │  (Port 8000)│               │  (data/) │
└─────────────┘                     └─────────────┘               └──────────┘
                                          │
                                          ▼
                                   ┌─────────────┐
                                   │ Kimi API    │
                                   └─────────────┘
```

### Proposed (Next.js Only)
```
┌─────────────────────────────────────────────────────────────────┐
│                          Next.js 14                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │  React UI   │  │ API Routes  │  │  Database   │  │  Kimi   │ │
│  │   (SSR)     │  │  (/api/*)   │  │  (SQLite)   │  │   API   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │
│                                                                 │
│  Single Port (3000) — No CORS, No separate backend server      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Technical Migration Plan

### 3.1 Database Layer

#### Option A: `better-sqlite3` (Recommended)
- **Pros:** Synchronous API, excellent performance, battle-tested
- **Cons:** Native module (requires `node-gyp` compilation)
- **Best for:** Local-first, single-user desktop apps

```typescript
// lib/db.ts
import Database from 'better-sqlite3';

const db = new Database('./data/personal_finance.db');
db.pragma('journal_mode = WAL'); // Better concurrency

// Example query
const stmt = db.prepare('SELECT * FROM holdings WHERE account_id = ?');
const holdings = stmt.all(accountId);
```

#### Option B: `libsql` (Turso)
- **Pros:** Drop-in SQLite replacement, supports remote sync later
- **Cons:** Newer ecosystem, may be overkill for local-only
- **Best for:** Future cloud sync capability

#### Schema Migration Strategy
1. Export current SQLAlchemy models to SQL DDL
2. Create TypeScript schema definitions using `zod` or `drizzle-orm`
3. Build migration runner in Node.js

```typescript
// db/schema.ts - using Drizzle ORM
import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const accounts = sqliteTable('accounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  // ... etc
});
```

### 3.2 API Routes Migration

#### Current FastAPI Routes → Next.js API Routes

| Current Endpoint | New Location | Priority |
|-----------------|--------------|----------|
| `POST /api/v1/auth/login` | `app/api/auth/login/route.ts` | High |
| `POST /api/v1/auth/register` | `app/api/auth/register/route.ts` | High |
| `GET /api/v1/auth/me` | `app/api/auth/me/route.ts` | High |
| `POST /api/v1/upload` | `app/api/upload/route.ts` | High |
| `GET /api/v1/uploads` | `app/api/uploads/route.ts` | High |
| `GET /api/v1/holdings` | `app/api/holdings/route.ts` | High |
| `GET /api/v1/transactions` | `app/api/transactions/route.ts` | High |
| `GET /api/v1/accounts` | `app/api/accounts/route.ts` | High |
| `GET /api/v1/suggestions` | `app/api/suggestions/route.ts` | Medium |
| `POST /api/v1/suggestions/:id/feedback` | `app/api/suggestions/[id]/feedback/route.ts` | Medium |

#### Example Migration: File Upload

**Current (FastAPI):**
```python
@router.post("/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    account_id: int = None,
    background_tasks: BackgroundTasks = None,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # ... Python implementation
```

**New (Next.js API Route):**
```typescript
// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { queueExtraction } from '@/lib/extraction';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const accountId = formData.get('account_id') as string;
    
    if (!file || file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files allowed' }, { status: 400 });
    }
    
    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileId = uuidv4();
    const filePath = path.join(process.cwd(), 'data', 'pdfs', `${fileId}.pdf`);
    await writeFile(filePath, buffer);
    
    // Save to database
    const pdf = db.prepare(`
      INSERT INTO pdfs (account_id, original_filename, file_path, file_size, extraction_status)
      VALUES (?, ?, ?, ?, ?)
    `).run(accountId, file.name, filePath, buffer.length, 'pending');
    
    // Queue extraction (background job)
    await queueExtraction(pdf.lastInsertRowid, filePath);
    
    return NextResponse.json({
      message: 'Upload successful',
      pdf_id: pdf.lastInsertRowid,
      status: 'pending_extraction'
    });
    
  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
```

### 3.3 Background Jobs

#### Problem
Python FastAPI uses `BackgroundTasks` for async PDF processing. Next.js API routes are serverless by default.

#### Solutions

**Option A: In-Process with `next/after` (Next.js 14+)**
```typescript
import { unstable_after as after } from 'next/server';

export async function POST(request: NextRequest) {
  // ... save upload
  
  // Run extraction after response is sent
  after(async () => {
    await processPdfExtraction(pdfId, filePath);
  });
  
  return NextResponse.json({ status: 'pending' });
}
```

**Option B: BullMQ with Redis (Recommended for production)**
```typescript
// lib/queue.ts
import { Queue } from 'bullmq';

export const extractionQueue = new Queue('pdf-extraction', {
  connection: { host: 'localhost', port: 6379 } // or use SQLite-backed queue
});

// In route
await extractionQueue.add('extract', { pdfId, filePath });
```

**Option C: `better-queue` with SQLite**
```typescript
// lib/queue.ts
import Queue from 'better-queue';

const extractionQueue = new Queue(async (input, cb) => {
  try {
    await processPdfExtraction(input.pdfId, input.filePath);
    cb(null);
  } catch (err) {
    cb(err);
  }
}, { store: { type: 'sql', dialect: 'sqlite', path: './data/queue.db' } });
```

### 3.4 AI Service Migration

**Current (Python):**
```python
class KimiService:
    def __init__(self):
        self.client = httpx.Client(...)
    
    def extract_from_pdf(self, file_path: str) -> Dict[str, Any]:
        # ... 3-stage pipeline
```

**New (TypeScript):**
```typescript
// lib/kimi.ts
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

const kimi = openai({
  baseURL: 'https://api.moonshot.cn/v1',
  apiKey: process.env.KIMI_API_KEY,
});

export async function extractFromPDF(filePath: string) {
  // Stage 1: Classification
  const classification = await classifyDocument(filePath);
  
  // Stage 2: Structured extraction
  const extraction = await extractStructuredData(filePath, classification.docType);
  
  return extraction;
}

async function classifyDocument(filePath: string) {
  const result = await streamText({
    model: kimi('moonshot-v1-128k'),
    messages: [
      { role: 'system', content: CLASSIFICATION_PROMPT },
      { role: 'user', content: await extractPDFText(filePath) }
    ]
  });
  
  return JSON.parse(result.text);
}
```

**PDF Text Extraction (Node.js):**
```typescript
// lib/pdf.ts
import * as pdfjs from 'pdfjs-dist';

export async function extractPDFText(filePath: string): Promise<string> {
  const data = await fs.promises.readFile(filePath);
  const pdf = await pdfjs.getDocument({ data }).promise;
  
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item: any) => item.str).join(' ') + '\n';
  }
  
  return text;
}
```

### 3.5 Authentication Migration

**Current (Python/JWT):**
```python
from jose import jwt
def create_access_token(data: dict): ...
```

**New (NextAuth.js or Iron Session):**
```typescript
// lib/auth.ts
import { getIronSession } from 'iron-session';

export async function getSession() {
  const session = await getIronSession(cookies(), {
    password: process.env.SESSION_SECRET,
    cookieName: 'pf-session',
    cookieOptions: { secure: process.env.NODE_ENV === 'production' }
  });
  return session;
}

// Password hashing: bcryptjs
import bcrypt from 'bcryptjs';

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}
```

---

## 4. File Structure

### Current
```
personal_finance/
├── api/                    # Python FastAPI
│   ├── app/
│   │   ├── routers/        # All API endpoints
│   │   ├── database/
│   │   └── services/
│   └── requirements.txt
└── web/                    # Next.js
    ├── app/
    └── lib/
```

### Proposed
```
personal_finance/
└── web/                    # Next.js (full-stack)
    ├── app/
    │   ├── api/            # API Routes (was FastAPI)
    │   │   ├── auth/
    │   │   ├── upload/
    │   │   ├── holdings/
    │   │   └── ...
    │   ├── (routes)/       # UI routes
    │   └── layout.tsx
    ├── lib/
    │   ├── db/             # Database layer
    │   │   ├── index.ts
    │   │   ├── schema.ts   # Drizzle/Zod schemas
    │   │   └── migrations/
    │   ├── services/       # Business logic (was Python services)
    │   │   ├── kimi.ts     # AI extraction
    │   │   ├── pdf.ts      # PDF processing
    │   │   └── extraction.ts
    │   └── auth.ts         # Authentication
    └── data/               # Local SQLite + PDFs
```

---

## 5. Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Set up `better-sqlite3` and Drizzle ORM
- [ ] Create database schema in TypeScript
- [ ] Build migration script from existing SQLite DB
- [ ] Set up API route structure

### Phase 2: Core CRUD (Week 2-3)
- [ ] Port authentication routes
- [ ] Port accounts API
- [ ] Port holdings API
- [ ] Port transactions API
- [ ] Port upload API (file storage)

### Phase 3: AI Integration (Week 4)
- [ ] Port Kimi service to TypeScript
- [ ] Implement PDF text extraction (pdfjs)
- [ ] Port 3-stage extraction pipeline
- [ ] Build background job queue

### Phase 4: Polish (Week 5)
- [ ] Update frontend API client
- [ ] Remove FastAPI backend
- [ ] Update documentation
- [ ] Testing and bug fixes

---

## 6. Dependencies

### New Dependencies
```json
{
  "dependencies": {
    "better-sqlite3": "^9.4.0",
    "drizzle-orm": "^0.29.0",
    "drizzle-kit": "^0.20.0",
    "bcryptjs": "^2.4.3",
    "pdfjs-dist": "^4.0.0",
    "bullmq": "^5.0.0",           // optional, for queues
    "ioredis": "^5.3.0",          // optional
    "ai": "^3.0.0",                // Vercel AI SDK
    "@ai-sdk/openai": "^0.0.0",   // Compatible with Kimi
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.8",
    "@types/bcryptjs": "^2.4.6",
    "@types/uuid": "^9.0.0"
  }
}
```

### Removed Dependencies
- Python 3.11+
- FastAPI
- SQLAlchemy
- PyPDF2
- python-jose
- passlib
- httpx (Python)
- uvicorn
- All Python requirements

---

## 7. Configuration Changes

### Current (`.env` in `/api`)
```bash
# Backend
API_HOST=0.0.0.0
API_PORT=8000
DB_PATH=./data/personal_finance.db

# AI
KIMI_API_KEY=sk-...

# Auth
SECRET_KEY=change-this
```

### New (`.env.local` in `/web`)
```bash
# Database
DATABASE_URL=./data/personal_finance.db

# AI
KIMI_API_KEY=sk-...

# Auth
SESSION_SECRET=change-this-in-production

# Next.js
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 8. Build & Deployment

### Development
```bash
# Before (two terminals)
cd api && uvicorn app.main:app --reload
cd web && npm run dev

# After (one terminal)
cd web && npm run dev
```

### Production Build
```bash
# Before
cd api && docker build -t pf-api .
cd web && docker build -t pf-web .

# After
cd web && npm run build
# Single Node.js process
```

### Desktop Distribution (Future)
With pure Node.js, we can use:
- **Tauri** — Rust-based, very lightweight
- **Electron** — Battle-tested
- **electron-forge** — Easy packaging

---

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| PDF extraction quality differences | High | Compare Python vs Node.js output on 50+ sample PDFs |
| SQLite concurrency issues | Medium | Use WAL mode, avoid concurrent writes |
| Background job reliability | Medium | Use persistent queue (better-queue with SQLite) |
| Long-running extraction timeouts | Medium | Use streaming responses or poll-based status |
| TypeScript performance vs Python | Low | Node.js is I/O-bound for this workload; use worker threads if needed |

---

## 10. Success Criteria

- [ ] All existing API endpoints work identically
- [ ] PDF extraction produces same output as Python version
- [ ] All 232 existing tests pass (or equivalents)
- [ ] Single `npm run dev` starts the full stack
- [ ] No Python dependencies required
- [ ] Build size < 200MB for desktop distribution

---

## 11. Appendix: Code Examples

### Database Connection Pooling
```typescript
// lib/db.ts
import Database from 'better-sqlite3';

let db: Database.Database | null = null;

export function getDB(): Database.Database {
  if (!db) {
    db = new Database(process.env.DATABASE_URL || './data/personal_finance.db');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function closeDB() {
  if (db) {
    db.close();
    db = null;
  }
}
```

### Streaming Extraction Status
```typescript
// app/api/extraction/[id]/stream/route.ts
import { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const sendStatus = (status: string) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status })}\n\n`));
      };
      
      // Poll or listen for status changes
      const interval = setInterval(() => {
        const status = checkExtractionStatus(params.id);
        sendStatus(status);
        if (status === 'completed' || status === 'failed') {
          clearInterval(interval);
          controller.close();
        }
      }, 1000);
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
```

---

## 12. Related Documents

- [Original Python Architecture](./ERD.md)
- [PRD: Optional User System](./PRD-Optional-User-System.md)
