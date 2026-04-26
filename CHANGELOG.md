# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Frontend test suite with Jest (60 tests passing)
- Backend test suite with Pytest (172 tests passing)
- CI/CD pipeline with GitHub Actions

### Changed
- Enhanced README for public release
- Added CONTRIBUTING.md and SECURITY.md

## [1.0.0] - 2026-04-19

### Added
- PDF-first portfolio tracking
- Kimi AI-powered PDF extraction for brokerage, bank, and credit card statements
- AI-powered investment and spending suggestions with explainable reasoning
- Life-stage adaptive recommendation engine
- Portfolio diversity and concentration risk analysis
- Monthly report generation with interactive dashboard
- Decision trail for tracking AI suggestions and user feedback
- Local SQLite database for privacy-first data storage
- FastAPI backend with JWT authentication
- Next.js 14 frontend with Tailwind CSS
- Multi-account support (brokerage, bank, credit card)
- Manual correction system for extracted data
- Export capabilities (JSON/CSV)

### Security
- bcrypt password hashing
- JWT token authentication
- Local data storage (no cloud required)

---

## Release Notes Template

When creating a new release, use this format:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes to existing functionality

### Deprecated
- Soon-to-be removed features

### Removed
- Removed features

### Fixed
- Bug fixes

### Security
- Security improvements
```
