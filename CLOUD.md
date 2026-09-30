# PokéRegions Cloud Accounts

The Alpha keeps local play as the default. Cloud accounts are optional. Production is configured with the project's public Supabase URL and publishable browser key; Vite environment variables can override those values for staging or local development.

## 1. Create a Supabase project

Create a project and run:

```sql
supabase/migrations/20260930_cloud_accounts.sql
```

The migration creates:

- `cloud_saves`: one JSON save per authenticated user
- `entitlements`: server-owned rewards such as First Wave in a later phase
- Row Level Security so users can only read/write their own cloud save

## 2. Configure the web app

Copy `.env.example` to `.env.local` for local development:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

For staging or another Supabase project, add the same public values to the deployment environment to override the production defaults.

The publishable/anon key is designed for browser use and is intentionally public. Never put the Supabase service-role key or Discord client secret in this repository.

## 3. Discord login

In the Discord Developer Portal:

1. Create an application for PokéRegions.
2. Add the OAuth redirect URL shown by Supabase for the Discord provider.
3. Put the Discord Client ID and Client Secret only in Supabase Auth -> Providers -> Discord.
4. In Supabase Auth URL Configuration, add:
   - `https://pokeregions.de/`
   - local dev URL such as `http://localhost:5173/`

The browser never receives the Discord secret.

## 4. Account behavior

PokéRegions now supports:

- classic e-mail + password login
- account registration with trainer name
- Discord OAuth
- password reset
- persistent sessions
- guest play without an account

## 5. Automatic cross-device saves

After login, the browser starts a safe automatic sync loop.

- If the account has a Cloud Save and the new device has no meaningful local profile, the Cloud Save is restored automatically.
- If the account has no Cloud Save but the device already has a real local profile, the local save becomes the first Cloud Save.
- While playing, local save changes are uploaded automatically.
- If another device has a newer Cloud Save and the current device has not changed locally, the newer cloud version is restored automatically.
- If both devices changed since the last successful sync, PokéRegions stops and asks which save should win instead of silently overwriting progress.
- Before a Cloud Save replaces a local save, the previous local JSON is stored in the existing backup key.

The sync metadata is tied to the authenticated user so switching accounts on the same browser cannot silently merge two different saves.

## 6. Backend foundation

The next account/backend layer is prepared in [BACKEND.md](BACKEND.md).

It adds migrations and client helpers for:

1. roles and admin authorization
2. permanent account inventory and reusable reward bundles
3. secure gift-code redemption
4. data-driven achievements and events
5. feature flags and announcements
6. player notifications and moderation
7. automatic cloud-save revision history

The SQL is intentionally separate from the currently live cloud-save migration. Apply the backend migrations in the order documented in `BACKEND.md` before wiring the new UI.
