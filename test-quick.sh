#!/bin/bash
# Run quick unit tests only (fast)

cd "$(dirname "$0")/api"
echo "🧪 Running unit tests (fast mode)..."
echo ""

source venv/bin/activate 2>/dev/null || {
    echo "⚠️  Virtual environment not found"
    exit 1
}

# Run only unit tests, skip slow ones
pytest -v -m "unit and not slow" --tb=line -q

echo ""
echo "✅ Unit tests complete!"