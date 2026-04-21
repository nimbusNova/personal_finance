# PRD: No-Auth Local-First Setup

**Version:** 3.0  
**Date:** 2026-04-19  
**Status:** Draft  
**Author:** Michael Wu

---

## 1. Goal

Remove all authentication and user concepts from the app. It is a single-user local tool. The only "identity" is a display name. The only secret is the Kimi API key.

---

## 2. What We Store

A single local JSON file: `api/data/settings.json`

```json
{
  "user_name": "Michael",
  "kimi_api_key": "sk-xxxxx"
}
```

That's it. No other settings keys.

---

## 3. Database Changes

### Delete
- `users` table

### Remove columns
- `accounts.user_id`
- `life_stage_profiles.user_id`

### Remove constraints
- `uix_account_user_institution_name` (it included `user_id`)

No `app_settings` table in SQLite. Settings live in the JSON file only.

---

## 4. API Key Resolution

Priority:
1. `settings.json` `kimi_api_key` (set via UI)
2. `.env` / `process.env` `KIMI_API_KEY` (dev fallback)
3. `None` → show "Add API key" banner

---

## 5. Welcome Screen

On first run (when `settings.json` is missing or `user_name` is empty):

```
┌─────────────────────────────────────┐
│  Welcome to Portfolio Intelligence  │
│                                     │
│  What's your name?                  │
│  [________________]                 │
│                                     │
│  Kimi API Key                       │
│  [________________]                 │
│  Get one at platform.moonshot.ai    │
│                                     │
│         [  Get Started  ]           │
└─────────────────────────────────────┘
```

- Saves `user_name` and `kimi_api_key` to `settings.json`
- Redirects to `/dashboard`
- Skipped on subsequent visits

---

## 6. Settings Page

Route: `/settings`

Fields:
- **Your Name** — text input
- **Kimi API Key** — password input with show/hide toggle
- **Save** button

Both values read from and written to `settings.json`.

---

## 7. Navbar

- Remove Login/Logout
- Add **Settings** link (gear icon)
- Display: "Welcome, {user_name}" (if set)

---

## 8. Backend

### New
- `api/app/services/settings_service.py` — read/write `settings.json`
- `api/app/routers/settings.py` — `GET /settings`, `POST /settings`, `POST /settings/test-key`

### Delete
- `api/app/routers/auth.py`

### Modify
- All routers: remove `get_current_user` imports/dependencies
- `api/app/database/models.py`: delete `User` model, remove `user_id` columns
- `api/app/services/kimi_service.py`: read key from settings service
- `api/app/main.py`: remove auth router, register settings router

---

## 9. Frontend

### Delete
- `web/app/login/page.tsx`
- `web/app/context/AuthContext.tsx`

### New
- `web/app/welcome/page.tsx` — welcome screen
- `web/app/settings/page.tsx` — settings form
- `web/app/components/APIKeyInput.tsx` — reusable key input with validation

### Modify
- `web/app/layout.tsx` — remove `AuthProvider`
- `web/lib/api.ts` — remove token/401 logic
- `web/app/components/Navbar.tsx` — add Settings link, show user name
- `web/app/dashboard/page.tsx` — add "no API key" banner if missing

---

## 10. Checklist

- [ ] Delete auth router, login page, auth context
- [ ] Drop `users` table and `user_id` columns
- [ ] Create `settings.json` read/write service
- [ ] Create settings API endpoints
- [ ] Create welcome screen
- [ ] Create settings page
- [ ] Update navbar
- [ ] Update KimiService to use settings file
- [ ] Remove all auth tests
- [ ] `npm run build` passes
- [ ] `pytest` passes
