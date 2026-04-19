#!/bin/bash
# Start Personal Finance App (SQLite Edition)

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "🚀 Starting Personal Finance App..."

# Check for .env file
if [ ! -f "api/.env" ]; then
    echo "⚠️  api/.env not found. Copy from example:"
    echo "   cp api/.env.example api/.env"
    exit 1
fi

# Initialize database if not exists
if [ ! -f "api/data/personal_finance.db" ]; then
    echo "📊 Initializing SQLite database..."
    cd api
    python3 -c "from app.database import init_db; init_db()" || {
        echo "Need to install dependencies: cd api && pip install -r requirements.txt"
        exit 1
    }
    cd ..
fi

# Start backend
echo "🔧 Starting FastAPI backend on http://localhost:8000"
cd api
source venv/bin/activate 2>/dev/null || {
    echo "Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
}
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

sleep 2

# Start frontend
echo "🎨 Starting Next.js frontend on http://localhost:3000"
cd web
npm install 2>/dev/null || true
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ App started!"
echo "   Backend: http://localhost:8000"
echo "   Frontend: http://localhost:3000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait