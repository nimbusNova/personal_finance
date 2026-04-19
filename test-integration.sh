#!/bin/bash
# Run integration tests (API + database)

cd "$(dirname "$0")/api"
echo "🔗 Running integration tests..."
echo ""

source venv/bin/activate 2>/dev/null || {
    echo "⚠️  Virtual environment not found. Run: cd api && pip install -r requirements.txt"
    exit 1
}

# Run integration tests (excluding e2e and slow)
pytest -v -m "integration and not e2e and not slow" --tb=short

echo ""
echo "✅ Integration tests complete!"