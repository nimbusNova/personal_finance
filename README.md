# Personal Finance — Portfolio Intelligence

<div align="center">

[![CI/CD](https://github.com/nimbusNova/personal_finance/actions/workflows/ci.yml/badge.svg)](https://github.com/nimbusNova/personal_finance/actions/workflows/ci.yml)
[![Tests](https://github.com/nimbusNova/personal_finance/actions/workflows/test.yml/badge.svg)](https://github.com/nimbusNova/personal_finance/actions/workflows/test.yml)
[![Next.js](https://img.shields.io/badge/Next.js_14-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org/)
[![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=fbf0df)](https://bun.sh/)
[![Kimi](https://img.shields.io/badge/Kimi_AI-8B5CF6?style=for-the-badge&logo=openai&logoColor=white)](https://www.moonshot.cn/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

**PDF-first portfolio tracking with AI-powered suggestions.**  
*Runs locally on your machine with Next.js full-stack (API Routes + SQLite).*

> **Migration complete:** The Python FastAPI backend has been replaced with Next.js 14 API Routes. Single `bun run dev` runs everything.

[Quick Start](#quick-start) • [Features](#features) • [Architecture](#architecture) • [Documentation](#documentation) • [Contributing](#contributing)

</div>

---

## 🌟 Features

### 📊 Portfolio Intelligence
- **Unified Net Worth View** — Aggregate holdings across all brokers, banks, and credit cards in one dashboard
- **PDF-First Data Ingestion** — Upload brokerage, bank, and credit card statements; Kimi AI parses them into structured data
- **Diversity & Risk Analysis** — Understand concentration risk by asset class, sector, geography, and individual position
- **Portfolio Snapshots** — Track your portfolio's evolution over time with point-in-time records

### 🤖 AI-Powered Suggestions
- **Explainable Recommendations** — Every suggestion includes detailed reasoning (market context, life-stage fit, tax implications)
- **Life-Stage Adaptive** — The AI adjusts recommendations based on your age, income, risk tolerance, and goals
- **Decision Trail** — Persistent record of AI suggestions, your feedback, and outcomes

### 💰 Spending Analysis
- **Transaction Categorization** — Automatic categorization from credit card and bank statements
- **Recurring Charge Detection** — Identify subscriptions and recurring payments
- **Expense Analysis** — Track spending patterns and expensive transactions

### 📈 Monthly Reports
- **Beautiful Dashboard** — Interactive monthly report summarizing portfolio changes, spending, and AI insights
- **Export Capabilities** — JSON/CSV exports for further analysis

---

## 🚀 Quick Start

**Requirements:** [Bun](https://bun.sh/), Python 3.11+

```bash
# 1. Clone the repository
git clone https://github.com/nimbusNova/personal_finance.git
cd personal_finance

# 2. Setup backend
cd api
python3.11 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your KIMI_API_KEY from https://platform.moonshot.cn/
python -c "from app.database import init_db; init_db()"
cd ..

# 3. Setup frontend
cd web
bun install
cd ..

# 4. Start the application
./start.sh
# → Backend: http://localhost:8000
# → Frontend: http://localhost:3000
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│           Next.js 14 Full-Stack         │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │  React UI   │  │  API Routes      │  │
│  │  (Frontend) │  │  (/api/v1/*)     │  │
│  └─────────────┘  └──────────────────┘  │
│                          │              │
│              ┌───────────┴───────────┐  │
│              ▼                       ▼  │
│        ┌──────────┐           ┌────────┐│
│        │  SQLite  │           │  Kimi  ││
│        │  (local) │           │   AI   ││
│        └──────────┘           └────────┘│
└─────────────────────────────────────────┘
```

### Tech Stack
- **Full-Stack**: Next.js 14 with API Routes, React, TypeScript, Bun
- **Database**: SQLite via `better-sqlite3` with Drizzle ORM
- **AI**: Kimi (Moonshot AI) for PDF extraction and suggestions
- **Testing**: Jest (frontend + API client)

### Data Flow
1. Upload PDF statements (brokerage, bank, credit card)
2. Kimi AI extracts structured data (holdings, transactions, balances)
3. Data stored locally in SQLite
4. AI generates personalized suggestions based on life-stage profile
5. Interactive dashboard visualizes portfolio and spending

---

## 🧪 Testing

```bash
# Quick unit tests
./test-quick.sh

# Integration tests (database + API)
./test-integration.sh

# End-to-end tests
./test-e2e.sh

# All tests with coverage
./test.sh
```

**Current Test Status:**
- Backend: 172 passing ✅
- Frontend: 60 passing ✅

---

## 📚 Documentation

- **[Product Requirements (PRD)](docs/PRDs/PRD-Personal-Finance-Portfolio-Intelligence-v1.md)** — Full product specification with phased roadmap
  - Phase I: Personal Usage (current)
  - Phase II: Publishable Product
  - Phase III: Advanced / Enterprise
- **[Entity Relationship Diagram](docs/ERD.md)** — Database schema and relationships
- **[Implementation Plan](docs/IMPLEMENTATION_PLAN.md)** — Technical implementation details

---

## 🛡️ Security & Privacy

- **Local-First**: All data stored locally in SQLite; no cloud database required
- **API Key Security**: Kimi API keys stored in `web/data/settings.json` (gitignored)
- **No Telemetry**: No analytics, tracking, or data collection
- **PDF Storage**: PDFs stored locally in `web/data/pdfs/` (gitignored)
- **No Authentication**: Single-user local app; no login required

**Before going to production:**
1. Build with `bun run build` and deploy with `bun run start`
2. Enable HTTPS
3. Consider migrating from SQLite to PostgreSQL for multi-user scenarios

---

## 🗺️ Roadmap

### Current (Phase I) ✅
- [x] PDF-based data ingestion
- [x] Local SQLite storage
- [x] AI-powered suggestions
- [x] Monthly reports
- [x] Portfolio tracking
- [x] Spending analysis

### Phase II (Planned)
- [ ] Direct API connections (Plaid, Alpaca, etc.)
- [ ] Automated data sync
- [ ] Mobile app (React Native)
- [ ] Multi-user support
- [ ] PostgreSQL support

### Phase III (Future)
- [ ] Tax optimization suggestions
- [ ] Monte Carlo retirement simulations
- [ ] Rebalancing automation
- [ ] Advanced portfolio optimization

---

## 🤝 Contributing

Contributions are welcome! This is a personal finance tool that can benefit from community input.

### Development Setup

```bash
# Fork and clone
git clone https://github.com/your-username/personal_finance.git

# Setup pre-commit hooks (optional)
cd api
pip install pre-commit
pre-commit install
```

### Pull Request Process
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`./test.sh`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Areas for Contribution
- **New Broker Support**: PDF parsers for additional brokerage statements
- **AI Prompts**: Improved suggestion prompts and reasoning
- **UI/UX**: Dashboard enhancements and visualizations
- **Testing**: Additional test coverage
- **Documentation**: Tutorials, guides, and examples

---

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/nimbusNova/personal_finance/issues)
- **Discussions**: [GitHub Discussions](https://github.com/nimbusNova/personal_finance/discussions)

---

## 🙏 Acknowledgments

- **[Kimi AI](https://www.moonshot.cn/)** by Moonshot — PDF extraction and AI suggestions
- **[Drizzle ORM](https://orm.drizzle.team/)** — Type-safe SQLite queries
- **[Next.js](https://nextjs.org/)** — Frontend framework
- **[Bun](https://bun.sh/)** — JavaScript runtime and package manager

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ for personal finance enthusiasts**

[⬆ Back to Top](#personal-finance--portfolio-intelligence)

</div>
