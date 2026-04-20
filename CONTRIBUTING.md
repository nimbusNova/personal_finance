# Contributing to Personal Finance — Portfolio Intelligence

First off, thank you for considering contributing! It's people like you that make this tool better for everyone.

## Code of Conduct

This project and everyone participating in it is governed by our commitment to:
- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Prioritize user privacy and security

## How Can I Contribute?

### Reporting Bugs

Before creating a bug report, please:
1. Check if the issue already exists
2. Try to reproduce the issue with the latest version

When filing a bug report, please include:
- **Clear title** and description
- **Steps to reproduce**
- **Expected behavior** vs actual behavior
- **Screenshots** (if UI-related)
- **Environment details** (OS, Python version, Browser)
- **Logs** (from `api/logs/` or browser console)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:
- Use a **clear, descriptive title**
- **Describe the use case** — what problem does this solve?
- **Explain the feature** as specifically as possible
- If applicable, **include mockups or examples**

### Pull Requests

1. Fork the repository
2. Create a new branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes
4. Run tests:
   ```bash
   # Backend tests
   cd api && pytest
   
   # Frontend tests  
   cd web && npm test
   
   # All tests
   ./test.sh
   ```
5. Commit your changes with a clear message:
   ```bash
   git commit -m "feat: add support for Fidelity statements"
   ```
6. Push to your fork and submit a pull request

## Development Setup

See [README.md](../README.md#quick-start) for the full setup instructions.

### Additional Developer Tools

```bash
# Install backend dev dependencies
cd api
pip install -r requirements-dev.txt  # if available

# Install frontend dev dependencies
cd web
bun install
```

## Project Structure

```
personal_finance/
├── api/                    # FastAPI backend
│   ├── app/
│   │   ├── routers/        # API endpoints
│   │   ├── database/       # SQLAlchemy models
│   │   ├── services/       # Business logic
│   │   └── ...
│   ├── tests/              # Pytest tests
│   └── data/               # SQLite DB (gitignored)
├── web/                    # Next.js frontend
│   ├── app/                # Next.js app router
│   ├── components/         # React components
│   ├── __tests__/          # Jest tests
│   └── ...
└── docs/                   # Documentation
```

## Style Guides

### Python (Backend)
- Follow [PEP 8](https://pep8.org/)
- Use type hints where possible
- Docstrings in [Google style](https://google.github.io/styleguide/pyguide.html#38-comments-and-docstrings)
- Format with Black (optional):
  ```bash
  cd api && black app/ tests/
  ```

### TypeScript/JavaScript (Frontend)
- Follow [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- Use TypeScript for new code
- Format with Prettier (configured in project)

### Git Commit Messages
We follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation changes
- `style:` — Code style changes (formatting, semicolons, etc.)
- `refactor:` — Code refactoring
- `test:` — Adding or updating tests
- `chore:` — Build process or auxiliary tool changes

Examples:
```
feat: add support for Chase credit card statements
fix: correct portfolio value calculation for short positions
docs: update README with macOS installation notes
test: add integration tests for upload router
```

## Testing Guidelines

### Backend Tests
- Place tests in `api/tests/`
- Use markers: `@pytest.mark.unit`, `@pytest.mark.integration`
- Mock external APIs (Kimi) in unit tests
- Use temp databases for tests that write data

### Frontend Tests
- Place tests in `web/__tests__/`
- Use React Testing Library patterns
- Mock API calls with MSW (Mock Service Worker) if needed

## Documentation

- Update the README.md if you change user-facing functionality
- Add/update docstrings for new functions/classes
- Update relevant docs in the `docs/` folder

## Recognition

Contributors will be recognized in our README.md (with permission).

## Questions?

Feel free to:
- Open an issue for discussion
- Start a thread in GitHub Discussions
- Email: [your-email@example.com] (optional)

Thank you for contributing! 🎉
