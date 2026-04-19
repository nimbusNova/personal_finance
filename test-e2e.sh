#!/bin/bash
# Run end-to-end tests (full user workflows)

cd "$(dirname "$0")/api"
echo "🎭 Running E2E tests (user workflows)..."
echo ""

source venv/bin/activate 2>/dev/null || {
    echo "⚠️  Virtual environment not found. Run: cd api && pip install -r requirements.txt"
    exit 1
}

# Run E2E tests
pytest -v -m e2e --tb=short

echo ""
echo "✅ E2E tests complete!"