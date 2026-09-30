# PokéRegions Backend Foundation

This directory now contains the database foundation for account-bound progression, promo codes, achievements, events, cosmetics and an in-game admin panel.

The existing login/cloud-save system stays compatible. Nothing in these migrations replaces Supabase Auth, Discord OAuth or `cloud_saves`.

## Apply order

Run the SQL in this order in the Supabase SQL Editor:

1. `supabase/migrations/20260930_cloud_accounts.sql` — already used by the current account/cloud-save system.
2. `supabase/migrations/202609300200_backend_core.sql`
3. `supabase/migrations/202609300210_backend_security_rpc.sql`
4. Optional but recommended: `supabase/seed.sql`

The seed is re-runnable. The seeded `ALPHA2026` promo code is intentionally **disabled**.

Do not put the Supabase service-role key in GitHub or in the browser app.

## First admin

After the migrations have been applied:

1. Open **Supabase → Authentication → Users**.
2. Copy the UUID of the account that should be admin.
3. Run:

```sql
insert into public.user_roles (user_id, role)
values ('YOUR-USER-UUID', 'admin')
on conflict (user_id, role) do nothing;
```

A normal account cannot promote itself. Client-side writes to roles are blocked by RLS unless the current account is already an admin.

Available roles:

- `player`
- `tester`
- `moderator`
- `admin`

Every new Supabase Auth user automatically receives a `profiles` row, `player` role and empty profile loadout.

## Database map

### Account

**profiles**

Account-facing profile data. Keeps the trainer name, locale and account state separate from Supabase Auth.

**user_roles**

Authorization roles used by the game and admin tools. The admin role is checked in the database, not merely by hiding/showing UI buttons.

**profile_loadouts**

Equipped account cosmetics:

- avatar
- frame
- background
- title

Players can only equip an item they actually own by calling `equip_profile_item(...)`.

### Cloud safety

**cloud_saves**

Existing current cloud save.

**cloud_save_revisions**

Automatically keeps the latest 10 previous cloud-save versions per account whenever the save JSON changes. Players can read their own history; admins can inspect all histories.

### Permanent progression

**catalog_items**

Data-driven catalog for permanent account content. Supported kinds:

- currency
- item
- relic
- pokemon
- avatar
- frame
- background
- title
- token

Adding a new permanent item normally becomes a database operation instead of a new deployment.

**account_inventory**

What each account owns and in what quantity. Normal players have no direct write access. Rewards are granted by trusted RPCs or admin actions.

**entitlements**

Existing server-owned permanent flags/rewards. The backend migration extends it with source/audit metadata without deleting existing data.

### Reusable rewards

**reward_bundles**

Named reusable reward packages.

Example:

`bundle.alpha_tester`

**reward_bundle_entries**

Contents of a reward bundle. Entry types:

- `item`
- `entitlement`
- `achievement`

The same bundle can be reused by promo codes, events, achievements or manual admin grants.

**reward_grants**

Immutable-ish history of reward-bundle deliveries: who received what, why, and optionally which admin granted it.

### Promo / gift codes

**promo_codes**

Stores codes, availability windows, global limits, per-account limits and a reward bundle.

Normal players cannot list this table, so future/secret codes are not enumerable from the frontend.

**promo_redemptions**

Stores every successful redemption.

Players redeem through:

```ts
redeemPromoCode("ALPHA2026")
```

which calls the trusted `redeem_promo_code` database RPC. The RPC checks:

- signed in
- account is active
- code exists
- enabled
- start/end date
- global redemption limit
- per-account limit

Only then are rewards granted.

### Achievements

**achievements**

Data-driven achievement definitions including name, description, icon, category, rarity, hidden state, trigger key, target value and optional reward bundle.

**user_achievements**

Unlocked achievements per user.

Achievement insertion is intentionally not writable by ordinary clients. A future trusted gameplay endpoint can call the internal unlock path. Admins can already grant achievements using the provided RPC.

### Events

**events**

Time-windowed game/community events with metadata and an optional reward bundle.

**event_claims**

Prevents a user from claiming the same event reward twice.

Players use `claim_event_reward(event_key)`.

### Live content without deploys

**feature_flags**

Turn prepared features on/off or attach small JSON config without changing the game bundle. Never store secrets here.

**announcements**

Time-windowed in-game announcements with severity, body and optional link.

This makes maintenance notices, Alpha messages and event announcements data-driven.

### Player inbox

**player_notifications**

Account-specific inbox messages. Good for:

- reward delivery
- compensation
- admin messages
- event rewards
- migration notices

Players can only mark their own notifications as read.

### Administration / moderation

**admin_audit_log**

Tracks important admin actions.

**moderation_actions**

Stores warnings, restrictions, bans, unbans and internal notes.

**profiles.account_state**

Fast current state:

- `active`
- `restricted`
- `banned`

## Trusted RPCs

### Player

- `set_my_trainer_name(name)`
- `touch_my_last_seen()`
- `equip_profile_item(slot, item_key)`
- `redeem_promo_code(code)`
- `claim_event_reward(event_key)`
- `mark_notification_read(id)`

### Admin

All admin RPCs verify the caller's database role again server-side.

- `admin_grant_catalog_item(user_id, item_key, quantity, reason)`
- `admin_grant_reward_bundle(user_id, bundle_key, reason)`
- `admin_unlock_achievement(user_id, achievement_key, reason)`
- `admin_notify_user(user_id, title, body, kind, payload)`
- `admin_set_account_state(user_id, state, reason)`

The frontend helper wrappers are prepared in:

`src/cloud/backend.ts`

Shared TypeScript models are in:

`src/types/backend.ts`

These files are not wired into the live UI yet, so adding the GitHub foundation alone does not make database calls to tables that have not been migrated.

## Alpha seed

`supabase/seed.sql` prepares:

- Rogue Points catalog entry
- Gold Bottle Cap
- permanent Alpha Shiny Riolu
- Alpha Trainer title
- Alpha frame
- exclusive Alpha Tester achievement
- reusable Alpha Tester reward bundle
- disabled `ALPHA2026` promo code
- feature flags for the backend UI rollout

The reward bundle currently contains:

- 1× Alpha Shiny Riolu
- Alpha Trainer title
- Alpha frame
- 2× Gold Bottle Caps
- Alpha Tester achievement

Enable the code only when it is ready to be distributed:

```sql
update public.promo_codes
set is_active = true
where code = 'ALPHA2026';
```

Or later do the same from the in-game Admin Panel.

## Creating content without touching game code

Once the Admin Panel is wired, most live content can be managed from the database.

Typical workflow for a new gift code:

1. Add or reuse catalog items.
2. Create a reward bundle.
3. Add entries to the bundle.
4. Create a promo code pointing to the bundle.
5. Choose start/end times and limits.
6. Activate it.

Typical workflow for a new achievement:

1. Insert an `achievements` row.
2. Optionally assign a reward bundle.
3. Give it a stable `trigger_key`.
4. The trusted gameplay logic decides when the trigger has been satisfied.

Names, descriptions, rewards, visibility, icons and activation can then be changed in the DB without rebuilding PokéRegions.

## Security model

The important rule is:

**UI visibility is convenience; RLS/RPC authorization is security.**

A player can edit JavaScript in their browser, so the backend never trusts an `isAdmin` boolean sent by the client.

The database checks the authenticated Supabase user for every protected operation.

Ordinary players cannot directly:

- assign themselves roles
- add inventory
- unlock achievements
- create promo codes
- view secret promo codes
- grant reward bundles
- read other users' saves
- write admin logs

Admin functionality is unlocked by the role stored in `user_roles`, and sensitive helper functions verify that role again inside PostgreSQL.

## Next UI phase

After the migrations are live, the game can safely add:

1. **Trainer Account** page: roles, inventory, equipped cosmetics, achievements, notifications.
2. **Redeem Code** dialog.
3. **Admin** button visible only when `fetchMyRoles()` includes `admin`.
4. Admin tabs for Players, Rewards, Codes, Achievements, Events, Announcements and Moderation.
5. Feature flags to roll each tab out independently.
