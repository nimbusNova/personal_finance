#!/bin/bash
# Run all tests

cd "$(dirname "$0")/api"
echo "🧪 Running tests..."
echo ""

# Activate virtual environment
source venv/bin/activate 2>/dev/null || {
    echo "⚠️  Virtual environment not found. Run: cd api && python3 -m venv venv && pip install -r requirements.txt"
    exit 1
}

# Run tests with coverage
echo "Running unit tests..."
pytest -v -m unit --tb=short

echo ""
echo "Running integration tests..."
pytest -v -m integration --tb=short

echo ""
echo "Running all tests with coverage..."
pytest --cov=app --cov-report=term-missing --cov-report=html:htmlcov

echo ""
echo "✅ Tests complete!"
echo "   HTML coverage report: api/htmlcov/index.html"