#!/bin/bash
# Run quick unit tests only (fast, no external deps)

cd "$(dirname "$0")/api"
echo "🧪 Running unit tests (fast mode)..."
echo ""

source venv/bin/activate 2>/dev/null || {
    echo "⚠️  Virtual environment not found"
    exit 1
}

# Run only unit tests, skip integration and e2e
pytest -v -m "unit and not slow" --tb=line -q

echo ""
echo "✅ Unit tests complete!"
echo ""
echo "For more complete testing:"
echo "  ./test.sh              # All tests with coverage"
echo "  ./test-integration.sh  # Integration tests only"
echo "  ./test-e2e.sh          # E2E tests only"