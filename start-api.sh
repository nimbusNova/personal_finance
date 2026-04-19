#!/bin/bash
# Start the FastAPI development server

cd "$(dirname "$0")/api"
echo "Starting Personal Finance API..."
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -q -r requirements.txt

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Copy from .env.example:"
    echo "   cp .env.example .env"
    echo "   # Then edit .env with your Supabase and Kimi credentials"
    exit 1
fi

# Run the server
echo "🚀 Starting FastAPI server on http://localhost:8000"
echo "📚 API docs at http://localhost:8000/docs"
echo ""
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000