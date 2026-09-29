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

## 4. What happens to existing players?

Nothing automatically.

- Guest/local saves keep working exactly as before.
- After login, players can upload their current local save.
- Loading a cloud save first backs up the current local save.
- There is intentionally no automatic conflict merge yet.

This is the safe Alpha behavior. Automatic synchronization can be added after we have real-world conflict data.

## 5. Next backend phase

Recommended next steps:

1. server-side gift-code redemption / entitlements
2. automatic save sync with revision/conflict handling
3. Daily leaderboard submission through a trusted endpoint
4. account profile / Discord role integration
