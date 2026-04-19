# Personal Finance — Portfolio Intelligence

<div align="center">

[![CI/CD](https://github.com/nimbusNova/personal_finance/actions/workflows/ci.yml/badge.svg)](https://github.com/nimbusNova/personal_finance/actions/workflows/ci.yml)
[![Tests](https://github.com/nimbusNova/personal_finance/actions/workflows/test.yml/badge.svg)](https://github.com/nimbusNova/personal_finance/actions/workflows/test.yml)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js_14-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org/)
[![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=fbf0df)](https://bun.sh/)
[![Kimi](https://img.shields.io/badge/Kimi_AI-8B5CF6?style=for-the-badge&logo=openai&logoColor=white)](https://www.moonshot.cn/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

</div>

PDF-first portfolio tracking with AI-powered suggestions. Runs locally on your machine with a FastAPI backend and Next.js frontend.

## Quick Start

**Requirements:** Bun, Python 3.11+

```bash
# 1. Setup backend
cd api
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your KIMI_API_KEY
python -c "from app.database import init_db; init_db()"
cd ..

# 2. Setup frontend
cd web
bun install
cd ..

# 3. Start
./start.sh
# → Backend: http://localhost:8000
# → Frontend: http://localhost:3000
```

## Testing

```bash
./test-quick.sh        # Unit tests
./test-integration.sh  # Integration tests
./test-e2e.sh          # End-to-end tests
./test.sh              # All tests + coverage
```

## Documentation

- [PRD — Phase I: Personal Usage](docs/PRDs/PRD-Personal-Finance-Portfolio-Intelligence-v1.md#part-i-phase-i--personal-usage)
- [PRD — Phase II: Publishable Product](docs/PRDs/PRD-Personal-Finance-Portfolio-Intelligence-v1.md#part-ii-phase-ii--publishable-product--automated-import)
- [PRD — Phase III: Advanced / Enterprise](docs/PRDs/PRD-Personal-Finance-Portfolio-Intelligence-v1.md#part-iii-phase-iii--advanced--enterprise)
- [ERD](docs/ERD.md)
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md)

## License

MIT
