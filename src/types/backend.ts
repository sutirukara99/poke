export type AppRole = "player" | "tester" | "moderator" | "admin";

export type AccountState = "active" | "restricted" | "banned";

export type CatalogItemKind =
  | "currency"
  | "item"
  | "relic"
  | "pokemon"
  | "avatar"
  | "frame"
  | "background"
  | "title"
  | "token";

export type CatalogRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "exclusive";

export type JsonObject = Record<string, unknown>;

export type ProfileRow = {
  user_id: string;
  trainer_name: string;
  account_state: AccountState;
  locale: string;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
};

export type UserRoleRow = {
  user_id: string;
  role: AppRole;
  created_at: string;
};

export type CatalogItemRow = {
  item_key: string;
  kind: CatalogItemKind;
  name: string;
  description: string;
  icon_url: string | null;
  rarity: CatalogRarity;
  stackable: boolean;
  is_active: boolean;
  metadata: JsonObject;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type AccountInventoryRow = {
  user_id: string;
  item_key: string;
  quantity: number;
  metadata: JsonObject;
  first_granted_at: string;
  updated_at: string;
};

export type ProfileLoadoutRow = {
  user_id: string;
  avatar_item_key: string | null;
  frame_item_key: string | null;
  background_item_key: string | null;
  title_item_key: string | null;
  updated_at: string;
};

export type RewardBundleRow = {
  id: string;
  bundle_key: string;
  name: string;
  description: string;
  is_active: boolean;
  metadata: JsonObject;
  created_at: string;
  updated_at: string;
};

export type RewardBundleEntryRow = {
  id: string;
  bundle_id: string;
  reward_type: "item" | "entitlement" | "achievement";
  reward_key: string;
  quantity: number;
  metadata: JsonObject;
  sort_order: number;
};

export type PromoCodeRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  reward_bundle_id: string;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  max_redemptions: number | null;
  max_redemptions_per_user: number;
  created_by: string | null;
  notes: string;
  metadata: JsonObject;
  created_at: string;
  updated_at: string;
};

export type AchievementRow = {
  achievement_key: string;
  name: string;
  description: string;
  category: string;
  icon_url: string | null;
  rarity: CatalogRarity;
  is_hidden: boolean;
  is_active: boolean;
  points: number;
  trigger_key: string | null;
  target_value: number | null;
  reward_bundle_id: string | null;
  metadata: JsonObject;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type UserAchievementRow = {
  user_id: string;
  achievement_key: string;
  progress_value: number;
  progress_data: JsonObject;
  unlocked_at: string;
  source: string;
};

export type AchievementProgressRow = {
  user_id: string;
  achievement_key: string;
  progress_value: number;
  progress_data: JsonObject;
  updated_at: string;
};

export type EventRow = {
  event_key: string;
  name: string;
  description: string;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  reward_bundle_id: string | null;
  metadata: JsonObject;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type PlayerNotificationRow = {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  payload: JsonObject;
  read_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export type FeatureFlagRow = {
  flag_key: string;
  enabled: boolean;
  public_visible: boolean;
  description: string;
  config: JsonObject;
  updated_at: string;
};

export type AnnouncementRow = {
  announcement_key: string;
  title: string;
  body: string;
  severity: "info" | "success" | "warning" | "critical";
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  link_url: string | null;
  metadata: JsonObject;
  created_at: string;
  updated_at: string;
};

export type PromoRedemptionResult =
  | {
      ok: true;
      code: string;
      name: string;
      rewards: Array<{
        type: "item" | "entitlement" | "achievement";
        key: string;
        quantity: number;
        metadata: JsonObject;
      }>;
    }
  | {
      ok: false;
      error:
        | "not_authenticated"
        | "account_restricted"
        | "invalid_code"
        | "inactive_code"
        | "not_started"
        | "expired"
        | "limit_reached"
        | "already_redeemed"
        | string;
    };

export type EventClaimResult =
  | { ok: true; event_key: string }
  | {
      ok: false;
      error: "not_authenticated" | "event_unavailable" | "already_claimed" | string;
    };

export type BackendAccountSnapshot = {
  profile: ProfileRow | null;
  roles: AppRole[];
  inventory: AccountInventoryRow[];
  achievements: UserAchievementRow[];
  achievementProgress: AchievementProgressRow[];
  loadout: ProfileLoadoutRow | null;
  notifications: PlayerNotificationRow[];
};
