#!/bin/bash
# Run all tests with coverage

cd "$(dirname "$0")/api"
echo "🧪 Running all tests..."
echo ""

# Activate virtual environment
source venv/bin/activate 2>/dev/null || {
    echo "⚠️  Virtual environment not found. Run: cd api && python3 -m venv venv && pip install -r requirements.txt"
    exit 1
}

echo "1️⃣  Unit tests..."
pytest -v -m unit --tb=short -q

echo ""
echo "2️⃣  Integration tests..."
pytest -v -m integration --tb=short -q

echo ""
echo "3️⃣  E2E tests..."
pytest -v -m "e2e and not slow" --tb=short -q

echo ""
echo "4️⃣  Running all tests with coverage..."
pytest --cov=app --cov-report=term-missing --cov-report=html:htmlcov

echo ""
echo "✅ All tests complete!"
echo ""
echo "📊 Coverage report: api/htmlcov/index.html"
echo ""
echo "Test categories:"
echo "  - Unit:       Fast, isolated tests"
echo "  - Integration: API + database tests"
echo "  - E2E:        Full user workflows"
echo ""
echo "Run specific categories:"
echo "  ./test-quick.sh       # Unit only"
echo "  ./test-integration.sh # Integration only"
echo "  ./test-e2e.sh         # E2E only"