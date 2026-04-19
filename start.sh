#!/bin/bash
# Start Personal Finance App with Bun

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "🚀 Starting Personal Finance App with Bun..."

# Check for Bun
if ! command -v bun &> /dev/null; then
    echo "⚠️  Bun not found. Install it:"
    echo "   curl -fsSL https://bun.sh/install | bash"
    echo "   # Then restart your terminal"
    exit 1
fi

echo "✅ Bun $(bun --version)"

# Check for .env file
if [ ! -f "api/.env" ]; then
    echo "⚠️  api/.env not found. Copy from example:"
    echo "   cp api/.env.example api/.env"
    echo "   # Then edit with your KIMI_API_KEY"
    exit 1
fi

# Initialize database if not exists
if [ ! -f "api/data/personal_finance.db" ]; then
    echo "📊 Initializing SQLite database..."
    cd api
    source venv/bin/activate 2>/dev/null || {
        echo "Creating Python virtual environment..."
        python3 -m venv venv
        source venv/bin/activate
        pip install -r requirements.txt
    }
    python -c "from app.database import init_db; init_db()"
    cd ..
fi

# Start backend
echo "🔧 Starting FastAPI backend on http://localhost:8000"
cd api
source venv/bin/activate 2>/dev/null || source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

sleep 2

# Start frontend with Bun
echo "🎨 Starting Next.js frontend (Bun) on http://localhost:3000"
cd web

# Install dependencies with Bun if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies with Bun..."
    bun install
fi

bun run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ App started!"
echo "   Backend:  http://localhost:8000"
echo "   Frontend: http://localhost:3000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait