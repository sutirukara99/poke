import type {
  AccountInventoryRow,
  AchievementProgressRow,
  AchievementRow,
  AnnouncementRow,
  AppRole,
  BackendAccountSnapshot,
  CatalogItemRow,
  EventClaimResult,
  EventRow,
  FeatureFlagRow,
  PlayerNotificationRow,
  ProfileLoadoutRow,
  ProfileRow,
  PromoCodeRow,
  PromoRedemptionResult,
  RewardBundleEntryRow,
  RewardBundleRow,
  UserAchievementRow,
} from "../types/backend";
import { getSession, supabase } from "./supabase";

const requireClient = () => {
  if (!supabase) throw new Error("PokéRegions Backend ist nicht konfiguriert.");
  return supabase;
};

const requireUserId = async () => {
  const session = await getSession();
  if (!session) throw new Error("Bitte zuerst anmelden.");
  return session.user.id;
};

const assertNoError = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

export const fetchMyProfile = async (): Promise<ProfileRow | null> => {
  const client = requireClient();
  const userId = await requireUserId();
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  assertNoError(error);
  return data as ProfileRow | null;
};

export const fetchMyRoles = async (): Promise<AppRole[]> => {
  const client = requireClient();
  const userId = await requireUserId();
  const { data, error } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .order("role");

  assertNoError(error);
  return (data ?? []).map((row) => row.role as AppRole);
};

export const isCurrentUserAdmin = async () =>
  (await fetchMyRoles()).includes("admin");

export const fetchMyInventory = async (): Promise<AccountInventoryRow[]> => {
  const client = requireClient();
  const userId = await requireUserId();
  const { data, error } = await client
    .from("account_inventory")
    .select("*")
    .eq("user_id", userId)
    .gt("quantity", 0)
    .order("updated_at", { ascending: false });

  assertNoError(error);
  return (data ?? []) as AccountInventoryRow[];
};

export const fetchMyAchievementProgress = async (): Promise<AchievementProgressRow[]> => {
  const client = requireClient();
  const userId = await requireUserId();
  const { data, error } = await client
    .from("achievement_progress")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  assertNoError(error);
  return (data ?? []) as AchievementProgressRow[];
};

export const fetchMyAchievements = async (): Promise<UserAchievementRow[]> => {
  const client = requireClient();
  const userId = await requireUserId();
  const { data, error } = await client
    .from("user_achievements")
    .select("*")
    .eq("user_id", userId)
    .order("unlocked_at", { ascending: false });

  assertNoError(error);
  return (data ?? []) as UserAchievementRow[];
};

export const fetchMyLoadout = async (): Promise<ProfileLoadoutRow | null> => {
  const client = requireClient();
  const userId = await requireUserId();
  const { data, error } = await client
    .from("profile_loadouts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  assertNoError(error);
  return data as ProfileLoadoutRow | null;
};

export const fetchMyNotifications = async (
  limit = 50,
): Promise<PlayerNotificationRow[]> => {
  const client = requireClient();
  const userId = await requireUserId();
  const { data, error } = await client
    .from("player_notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  assertNoError(error);
  return (data ?? []) as PlayerNotificationRow[];
};

export const loadBackendAccountSnapshot = async (): Promise<BackendAccountSnapshot> => {
  const [
    profile,
    roles,
    inventory,
    achievements,
    achievementProgress,
    loadout,
    notifications,
  ] = await Promise.all([
    fetchMyProfile(),
    fetchMyRoles(),
    fetchMyInventory(),
    fetchMyAchievements(),
    fetchMyAchievementProgress(),
    fetchMyLoadout(),
    fetchMyNotifications(),
  ]);

  return {
    profile,
    roles,
    inventory,
    achievements,
    achievementProgress,
    loadout,
    notifications,
  };
};

export const setTrainerName = async (trainerName: string) => {
  const client = requireClient();
  const { data, error } = await client.rpc("set_my_trainer_name", {
    p_trainer_name: trainerName,
  });

  assertNoError(error);
  return String(data ?? trainerName);
};

export const touchLastSeen = async () => {
  const client = requireClient();
  const { data, error } = await client.rpc("touch_my_last_seen");
  assertNoError(error);
  return String(data);
};

export const equipProfileItem = async (
  slot: "avatar" | "frame" | "background" | "title",
  itemKey: string | null,
) => {
  const client = requireClient();
  const { error } = await client.rpc("equip_profile_item", {
    p_slot: slot,
    p_item_key: itemKey,
  });
  assertNoError(error);
};

export const redeemPromoCode = async (
  code: string,
): Promise<PromoRedemptionResult> => {
  const client = requireClient();
  const { data, error } = await client.rpc("redeem_promo_code", {
    p_code: code.trim().toUpperCase(),
  });

  assertNoError(error);
  return data as PromoRedemptionResult;
};

export const claimEventReward = async (
  eventKey: string,
): Promise<EventClaimResult> => {
  const client = requireClient();
  const { data, error } = await client.rpc("claim_event_reward", {
    p_event_key: eventKey,
  });

  assertNoError(error);
  return data as EventClaimResult;
};

export const markNotificationRead = async (notificationId: string) => {
  const client = requireClient();
  const { data, error } = await client.rpc("mark_notification_read", {
    p_notification_id: notificationId,
  });

  assertNoError(error);
  return Boolean(data);
};

export const fetchCatalog = async (): Promise<CatalogItemRow[]> => {
  const client = requireClient();
  const { data, error } = await client
    .from("catalog_items")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");

  assertNoError(error);
  return (data ?? []) as CatalogItemRow[];
};

export const fetchAchievementsCatalog = async (): Promise<AchievementRow[]> => {
  const client = requireClient();
  const { data, error } = await client
    .from("achievements")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");

  assertNoError(error);
  return (data ?? []) as AchievementRow[];
};

export const fetchLiveEvents = async (): Promise<EventRow[]> => {
  const client = requireClient();
  const { data, error } = await client
    .from("events")
    .select("*")
    .order("sort_order")
    .order("starts_at", { ascending: false });

  assertNoError(error);
  return (data ?? []) as EventRow[];
};

export const fetchFeatureFlags = async (): Promise<FeatureFlagRow[]> => {
  const client = requireClient();
  const { data, error } = await client
    .from("feature_flags")
    .select("*")
    .order("flag_key");

  assertNoError(error);
  return (data ?? []) as FeatureFlagRow[];
};

export const fetchAnnouncements = async (): Promise<AnnouncementRow[]> => {
  const client = requireClient();
  const { data, error } = await client
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });

  assertNoError(error);
  return (data ?? []) as AnnouncementRow[];
};

// Admin helpers --------------------------------------------------------------
// Every mutation below is still protected by RLS or a server-side admin RPC.
// Hiding an Admin button in the UI is never treated as authorization.

export const adminSearchProfiles = async (
  query: string,
  limit = 25,
): Promise<ProfileRow[]> => {
  const client = requireClient();
  const safeQuery = query.trim().replaceAll("%", "\\%");
  let request = client
    .from("profiles")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (safeQuery) {
    request = request.ilike("trainer_name", `%${safeQuery}%`);
  }

  const { data, error } = await request;
  assertNoError(error);
  return (data ?? []) as ProfileRow[];
};

export const adminFetchPromoCodes = async (): Promise<PromoCodeRow[]> => {
  const client = requireClient();
  const { data, error } = await client
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false });

  assertNoError(error);
  return (data ?? []) as PromoCodeRow[];
};

export const adminFetchRewardBundles = async (): Promise<RewardBundleRow[]> => {
  const client = requireClient();
  const { data, error } = await client
    .from("reward_bundles")
    .select("*")
    .order("name");

  assertNoError(error);
  return (data ?? []) as RewardBundleRow[];
};

export const adminFetchRewardBundleEntries = async (
  bundleId: string,
): Promise<RewardBundleEntryRow[]> => {
  const client = requireClient();
  const { data, error } = await client
    .from("reward_bundle_entries")
    .select("*")
    .eq("bundle_id", bundleId)
    .order("sort_order");

  assertNoError(error);
  return (data ?? []) as RewardBundleEntryRow[];
};

export const adminSavePromoCode = async (
  promo: Omit<PromoCodeRow, "id" | "created_at" | "updated_at"> & {
    id?: string;
  },
) => {
  const client = requireClient();
  const payload = {
    ...promo,
    code: promo.code.trim().toUpperCase(),
  };
  const { data, error } = await client
    .from("promo_codes")
    .upsert(payload, { onConflict: "code" })
    .select("*")
    .single();

  assertNoError(error);
  return data as PromoCodeRow;
};

export const adminSaveCatalogItem = async (
  item: Omit<CatalogItemRow, "created_at" | "updated_at">,
) => {
  const client = requireClient();
  const { data, error } = await client
    .from("catalog_items")
    .upsert(item, { onConflict: "item_key" })
    .select("*")
    .single();

  assertNoError(error);
  return data as CatalogItemRow;
};

export const adminSaveAchievement = async (
  achievement: Omit<AchievementRow, "created_at" | "updated_at">,
) => {
  const client = requireClient();
  const { data, error } = await client
    .from("achievements")
    .upsert(achievement, { onConflict: "achievement_key" })
    .select("*")
    .single();

  assertNoError(error);
  return data as AchievementRow;
};

export const adminGrantCatalogItem = async (
  targetUserId: string,
  itemKey: string,
  quantity = 1,
  reason = "",
) => {
  const client = requireClient();
  const { error } = await client.rpc("admin_grant_catalog_item", {
    p_target_user_id: targetUserId,
    p_item_key: itemKey,
    p_quantity: quantity,
    p_reason: reason,
  });
  assertNoError(error);
};

export const adminGrantRewardBundle = async (
  targetUserId: string,
  bundleKey: string,
  reason = "",
) => {
  const client = requireClient();
  const { data, error } = await client.rpc("admin_grant_reward_bundle", {
    p_target_user_id: targetUserId,
    p_bundle_key: bundleKey,
    p_reason: reason,
  });

  assertNoError(error);
  return String(data);
};

export const adminUnlockAchievement = async (
  targetUserId: string,
  achievementKey: string,
  reason = "",
) => {
  const client = requireClient();
  const { data, error } = await client.rpc("admin_unlock_achievement", {
    p_target_user_id: targetUserId,
    p_achievement_key: achievementKey,
    p_reason: reason,
  });

  assertNoError(error);
  return Boolean(data);
};

export const adminNotifyUser = async (
  targetUserId: string,
  title: string,
  body: string,
  kind = "info",
  payload: Record<string, unknown> = {},
) => {
  const client = requireClient();
  const { data, error } = await client.rpc("admin_notify_user", {
    p_target_user_id: targetUserId,
    p_title: title,
    p_body: body,
    p_kind: kind,
    p_payload: payload,
  });

  assertNoError(error);
  return String(data);
};

export const adminSetAccountState = async (
  targetUserId: string,
  state: "active" | "restricted" | "banned",
  reason = "",
) => {
  const client = requireClient();
  const { error } = await client.rpc("admin_set_account_state", {
    p_target_user_id: targetUserId,
    p_state: state,
    p_reason: reason,
  });
  assertNoError(error);
};
