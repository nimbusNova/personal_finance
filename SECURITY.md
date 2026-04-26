# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

**Please do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email security concerns to: **security@nimbusnova.com** (or create a private GitHub Security Advisory if enabled)

### What to Include

- Description of the vulnerability
- Steps to reproduce (if applicable)
- Potential impact
- Suggested fix (if you have one)
- Your contact information for follow-up

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 1 week
- **Fix timeline**: Depends on severity
  - Critical: 1-2 weeks
  - High: 2-4 weeks
  - Medium: 1-2 months
  - Low: Next release

### Security Best Practices for Users

1. **Keep your `.env` file secret** — Never commit it or share it
2. **Use a strong SECRET_KEY** — Change from the default in production
3. **Enable HTTPS** — For any production deployment
4. **Regular backups** — Your SQLite database and PDFs are local files
5. **Update dependencies** — Run `pip install -r requirements.txt --upgrade` periodically

## Security Features

- Passwords hashed with bcrypt
- JWT tokens for authentication
- SQL injection protection via SQLAlchemy ORM
- XSS protection in frontend
- CSRF protection enabled

## Known Limitations

- **Local storage**: Data is stored locally; physical access to machine = access to data
- **No encryption at rest**: SQLite database is not encrypted by default
- **Development mode**: Default config has DEBUG=true; change for production

## Security-Related Configuration

```env
# .env — Security settings
SECRET_KEY=your-random-secret-key-here  # Change this!
DEBUG=false                              # Set to false in production
```

---

Thank you for helping keep this project secure!
