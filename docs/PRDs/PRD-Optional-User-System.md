# PRD: Optional User System & UI-Configured AI

**Version:** 1.0  
**Date:** 2026-04-19  
**Status:** Draft  
**Author:** Michael Wu

---

## 1. Executive Summary

### Current State
- **Authentication:** Required — users must log in to use the app
- **User Model:** Single user per installation (but login still required)
- **Kimi API Key:** Environment variable (`KIMI_API_KEY` in `.env`)
- **Data Isolation:** User-based (though single-user)

### Proposed State
- **Authentication:** Optional — controlled by feature flag
- **Default Mode:** No login required, immediate app access
- **Kimi API Key:** UI-configurable, stored in browser/database
- **Data Isolation:** Device-based (files on disk are the security boundary)

### Why This Change?
1. **Faster Onboarding** — Open app → start using (no registration friction)
2. **True Local-First** — Data stays on device, no auth server needed
3. **Easier Distribution** — No user management for self-hosted deployments
4. **Privacy by Default** — No email required, completely anonymous
5. **Simple Setup** — Configure API key in UI, not in config files

---

## 2. User Modes

### Mode A: Anonymous (Default)
```
User opens app ──► Immediate access ──► Start tracking portfolio
       │                                   │
       ▼                                   ▼
  No password                        API key entered
  No email                           in Settings page
  Data stored locally
```

**Characteristics:**
- No authentication required
- Data directory: `./data/` (relative to app)
- Single implicit user (ID = 1 or NULL)
- Kimi API key stored in browser localStorage + database
- All features work (uploads, analysis, suggestions)

### Mode B: Authenticated (Optional)
```
User opens app ──► Settings ──► Enable "Password Protection"
       │                            │
       ▼                            ▼
  Immediate access            Create account
                              (email + password)
```

**Characteristics:**
- Toggle in Settings → Security
- Once enabled, login required for access
- Supports multiple users (future: family sharing)
- Same data storage, just with access control

---

## 3. Configuration Storage

### Current: Environment Variables
```bash
# api/.env
KIMI_API_KEY=sk-your-key-here
SECRET_KEY=change-this
```

**Problems:**
- Requires editing files
- Not user-friendly
- Same key for all users (if multi-user)
- Hard to rotate/change

### Proposed: UI + Database + localStorage

#### Storage Hierarchy
```
┌─────────────────────────────────────────────────────────────┐
│  Tier 1: localStorage (Browser)                             │
│  ├── kimi_api_key        → For immediate API calls          │
│  ├── auth_mode           → "anonymous" | "authenticated"    │
│  ├── session_token       → JWT (if authenticated)           │
│  └── encryption_key      → For encrypting sensitive data    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Tier 2: SQLite Database                                    │
│  ├── app_settings                                          │
│  │   ├── kimi_api_key        → Encrypted                    │
│  │   ├── auth_enabled        → boolean                      │
│  │   └── encryption_salt     → for key derivation           │
│  └── users (if auth enabled)                                │
│      ├── id, email, password_hash                           │
│      └── kimi_api_key        → User-specific key (future)   │
└─────────────────────────────────────────────────────────────┘
```

#### API Key Security
```typescript
// lib/settings.ts
import { AES } from 'crypto-js';

// Encryption key derived from device fingerprint + user password (if set)
function getEncryptionKey(): string {
  const deviceId = getDeviceFingerprint(); // Hardware-based
  const userPassword = localStorage.getItem('user_password_hint'); // Optional
  return deriveKey(deviceId, userPassword);
}

export function storeAPIKey(key: string): void {
  const encrypted = AES.encrypt(key, getEncryptionKey()).toString();
  
  // Store encrypted in DB
  db.prepare(`
    INSERT INTO app_settings (key, value) VALUES ('kimi_api_key', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(encrypted);
  
  // Also store plaintext in localStorage for convenience
  localStorage.setItem('kimi_api_key', key);
}

export function getAPIKey(): string | null {
  // Try localStorage first (faster)
  const cached = localStorage.getItem('kimi_api_key');
  if (cached) return cached;
  
  // Fallback to encrypted DB
  const row = db.prepare("SELECT value FROM app_settings WHERE key = 'kimi_api_key'").get();
  if (row) {
    return AES.decrypt(row.value, getEncryptionKey()).toString(CryptoJS.enc.Utf8);
  }
  
  return null;
}
```

---

## 4. Database Schema Changes

### New Table: `app_settings`
```sql
-- Application-level settings (not user-specific)
CREATE TABLE app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    encrypted BOOLEAN DEFAULT 0,  -- Is value encrypted?
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Initial settings
INSERT INTO app_settings (key, value) VALUES
    ('auth_enabled', 'false'),
    ('app_version', '1.0.0'),
    ('kimi_api_key', NULL);  -- Encrypted when set
```

### Modified Table: `users` (Optional)
```sql
-- Make users table optional
-- When auth_enabled = false, no rows needed
-- When auth_enabled = true, at least one user required

-- Add column for per-user API key (optional override)
ALTER TABLE users ADD COLUMN kimi_api_key TEXT;  -- Encrypted

-- Soft-delete support (don't lose data when disabling auth)
ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1;
```

### Modified Foreign Keys
```sql
-- All foreign keys to users.id should be nullable
-- When anonymous: user_id = NULL
-- When authenticated: user_id = actual user ID

ALTER TABLE accounts ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE life_stage_profiles ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE pdfs ALTER COLUMN user_id DROP NOT NULL;
```

---

## 5. Authentication Flow Changes

### Current Flow (Always Required)
```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Start   │───►│  Login   │───►│ Dashboard│───►│   Use    │
│   App    │    │  Page    │    │          │    │   App    │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                      │
                      ▼
                ┌──────────┐
                │ Register │
                │ (first   │
                │  time)   │
                └──────────┘
```

### New Flow (Anonymous by Default)
```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Start   │───►│ Dashboard│───►│  Check   │───►│   Use    │
│   App    │    │          │    │ API Key? │    │   App    │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                       │
                    ┌──────────────────┘
                    ▼
            ┌──────────┐
            │ Settings │
            │  Modal   │
            └──────────┘
                    │
                    ▼
            ┌──────────┐
            │ Enter    │
            │ Kimi Key │
            └──────────┘
```

### New Flow (When Auth Enabled)
```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Start   │───►│  Check   │───►│  Login   │───►│ Dashboard│
│   App    │    │  Token?  │    │  Page    │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                      │
                      ▼ (no token)
                ┌──────────┐
                │ Anonymous│
                │  Mode?   │
                └──────────┘
                      │
           ┌──────────┴──────────┐
           ▼                     ▼
    ┌──────────┐          ┌──────────┐
    │ Dashboard│          │  Login   │
    │ (limited)│          │  Page    │
    └──────────┘          └──────────┘
```

---

## 6. UI Changes

### New Component: `APIKeySettings`
```tsx
// app/components/APIKeySettings.tsx
'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { testKimiAPIKey } from '@/lib/kimi';

export function APIKeySettings() {
  const [apiKey, setApiKey] = useState('');
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    // Load from localStorage on mount
    const saved = localStorage.getItem('kimi_api_key');
    if (saved) {
      setApiKey(saved);
      setIsValid(true);
    }
  }, []);

  const handleSave = async () => {
    setIsChecking(true);
    const valid = await testKimiAPIKey(apiKey);
    setIsValid(valid);
    
    if (valid) {
      localStorage.setItem('kimi_api_key', apiKey);
      // Also save to server (encrypted)
      await fetch('/api/settings/api-key', {
        method: 'POST',
        body: JSON.stringify({ key: apiKey })
      });
    }
    setIsChecking(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Kimi API Key</label>
        <div className="flex gap-2">
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
          />
          <Button onClick={handleSave} disabled={isChecking}>
            {isChecking ? 'Testing...' : 'Save'}
          </Button>
        </div>
        {isValid === false && (
          <p className="text-sm text-red-500 mt-1">Invalid API key</p>
        )}
        {isValid === true && (
          <p className="text-sm text-green-500 mt-1">✓ API key valid</p>
        )}
      </div>
      
      <p className="text-xs text-gray-500">
        Get your API key from{' '}
        <a href="https://platform.moonshot.cn/" target="_blank" className="underline">
          Moonshot Console
        </a>
      </p>
    </div>
  );
}
```

### New Component: `SecuritySettings`
```tsx
// app/components/SecuritySettings.tsx
'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

export function SecuritySettings() {
  const [authEnabled, setAuthEnabled] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  const handleToggle = async (enabled: boolean) => {
    if (enabled) {
      setShowSetup(true);  // Show account creation modal
    } else {
      // Confirm before disabling
      if (confirm('Disable password protection? Anyone with access to this device can view your financial data.')) {
        await fetch('/api/settings/auth', {
          method: 'POST',
          body: JSON.stringify({ enabled: false })
        });
        setAuthEnabled(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Password Protection</h3>
          <p className="text-sm text-gray-500">
            Require login to access your financial data
          </p>
        </div>
        <Switch 
          checked={authEnabled} 
          onCheckedChange={handleToggle}
        />
      </div>
      
      {showSetup && (
        <AuthSetupModal 
          onComplete={() => setAuthEnabled(true)}
          onCancel={() => setShowSetup(false)}
        />
      )}
    </div>
  );
}
```

### Modified: First-Time User Experience
```tsx
// app/components/OnboardingModal.tsx
export function OnboardingModal() {
  const [step, setStep] = useState<'welcome' | 'api-key' | 'done'>('welcome');
  
  return (
    <Dialog open={true}>
      <DialogContent>
        {step === 'welcome' && (
          <>
            <DialogTitle>Welcome to Portfolio Intelligence</DialogTitle>
            <DialogDescription>
              Your personal finance data stays on your device.
              No account required — just add your API key to get started.
            </DialogDescription>
            <Button onClick={() => setStep('api-key')}>Get Started</Button>
          </>
        )}
        
        {step === 'api-key' && (
          <>
            <DialogTitle>Connect Kimi AI</DialogTitle>
            <APIKeySettings />
            <Button onClick={() => setStep('done')}>Continue</Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

---

## 7. API Changes

### New Endpoints

```typescript
// GET /api/settings
// Returns current app settings (excluding sensitive values)
{
  "auth_enabled": false,
  "api_key_configured": true,
  "app_version": "1.0.0"
}

// POST /api/settings/api-key
// Stores encrypted API key
{
  "key": "sk-xxx"
}

// POST /api/settings/auth
// Enable/disable authentication
{
  "enabled": true,
  "email": "user@example.com",
  "password": "..."
}

// GET /api/auth/status
// Check current authentication status
{
  "required": false,
  "authenticated": false,
  "mode": "anonymous"
}
```

### Modified Endpoints

All existing endpoints that require authentication should be updated:

```typescript
// Middleware: lib/auth-middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export async function authMiddleware(request: NextRequest) {
  // Check if auth is enabled
  const settings = getAppSettings();
  
  if (!settings.auth_enabled) {
    // Anonymous mode: inject default user context
    request.user = { id: null, anonymous: true };
    return null; // Continue
  }
  
  // Auth enabled: check token
  const token = request.headers.get('authorization')?.split(' ')[1];
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Validate JWT...
  request.user = await validateToken(token);
  return null;
}
```

---

## 8. Implementation Phases

### Phase 1: Settings Infrastructure (Week 1)
- [ ] Create `app_settings` table
- [ ] Build settings API endpoints
- [ ] Implement encryption utilities
- [ ] Create `APIKeySettings` component

### Phase 2: Anonymous Mode (Week 2)
- [ ] Make user_id nullable in all tables
- [ ] Update all queries to handle NULL user_id
- [ ] Modify auth middleware to support anonymous
- [ ] Update frontend auth context
- [ ] Create onboarding flow

### Phase 3: Optional Auth Toggle (Week 3)
- [ ] Build `SecuritySettings` component
- [ ] Implement auth enable/disable flow
- [ ] Create account setup modal
- [ ] Add migration for existing users

### Phase 4: Migration & Testing (Week 4)
- [ ] Migrate existing users to new schema
- [ ] Update all tests
- [ ] Document the two modes
- [ ] Create setup wizard

---

## 9. Backwards Compatibility

### Existing Users
Users with existing accounts should seamlessly transition:

```typescript
// Migration script
async function migrateExistingUsers() {
  const users = await db.query('SELECT * FROM users');
  
  if (users.length > 0) {
    // Keep auth enabled
    await db.run("UPDATE app_settings SET value = 'true' WHERE key = 'auth_enabled'");
    
    // Ensure all existing data has user_id set
    await db.run(`
      UPDATE accounts SET user_id = (SELECT id FROM users LIMIT 1) 
      WHERE user_id IS NULL
    `);
  }
}
```

### Environment Variable Fallback
```typescript
// lib/settings.ts
export async function getAPIKey(): Promise<string | null> {
  // Priority:
  // 1. localStorage (fastest)
  // 2. Database (encrypted)
  // 3. Environment variable (fallback for backwards compat)
  
  const fromEnv = process.env.KIMI_API_KEY;
  if (fromEnv) return fromEnv;
  
  // ... check localStorage and DB
}
```

---

## 10. Security Considerations

### Anonymous Mode Security Model
```
Security = Physical Access Control

- Data stored on local filesystem
- No network authentication required
- Encryption at rest: optional (user can enable)
- API key: encrypted in database, cached in localStorage

Threats:
✓ Someone with device access can read data
✓ Malware can steal localStorage
✗ Network attacks (no auth endpoint to attack)
✗ Database breaches (local only)
```

### Recommendations for Sensitive Data
1. **Device Encryption:** Recommend users enable FileVault (macOS) / BitLocker (Windows)
2. **API Key Rotation:** UI warning if key is > 90 days old
3. **Auto-Lock:** Optional timeout that clears localStorage
4. **Export/Backup:** Encrypted backups with password

---

## 11. Configuration Reference

### File: `app_settings` Table
| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `auth_enabled` | boolean | `false` | Whether login is required |
| `kimi_api_key` | encrypted | `null` | API key for AI features |
| `app_version` | string | `1.0.0` | For migrations |
| `encryption_enabled` | boolean | `false` | Encrypt sensitive data at rest |
| `auto_lock_timeout` | number | `0` | Minutes until auto-lock (0 = off) |

### Environment Variables (Still Supported)
| Variable | Purpose | Priority |
|----------|---------|----------|
| `KIMI_API_KEY` | Default API key | 3 (lowest) |
| `FORCE_AUTH` | Override auth_enabled | Override |
| `DATA_DIR` | Custom data directory | - |

---

## 12. Success Criteria

- [ ] New users can use app without creating account
- [ ] API key can be configured in Settings UI
- [ ] Existing users migrated without data loss
- [ ] Auth can be enabled/disabled at any time
- [ ] All features work in anonymous mode
- [ ] No `.env` editing required for basic setup
- [ ] Onboarding completes in < 2 minutes

---

## 13. Related Documents

- [Next.js Only Architecture](./PRD-NextJS-Only-Architecture.md)
- [Original Product Requirements](./PRD-Personal-Finance-Portfolio-Intelligence-v1.md)
- [Entity Relationship Diagram](../ERD.md)
