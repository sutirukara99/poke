import type { Session } from "@supabase/supabase-js";
import {
  getSession,
  readLocalSaveObject,
  SAVE_KEY,
  subscribeToAuth,
  supabase,
  uploadSaveObject,
} from "./supabase";

type PendingGameGrant = {
  id: string;
  grant_type:
    | "meta_points"
    | "bottle_caps"
    | "gold_bottle_caps"
    | "ability_capsules"
    | "ability_patches"
    | "ancient_charms"
    | "starter_unlock"
    | "achievement"
    | "relic";
  grant_key: string | null;
  quantity: number;
  payload: Record<string, unknown>;
  created_at: string;
};

const APPLIED_GRANT_IDS_KEY = "accountGrantIds";

const asNumber = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const asStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];

const applyGrantToSave = (
  save: Record<string, unknown>,
  grant: PendingGameGrant,
) => {
  const quantity = Math.max(1, Number(grant.quantity) || 1);

  if (grant.grant_type === "meta_points") {
    save.metaPoints = asNumber(save.metaPoints) + quantity;
    return;
  }

  if (grant.grant_type === "bottle_caps") {
    save.bottleCaps = asNumber(save.bottleCaps) + quantity;
    return;
  }

  if (grant.grant_type === "gold_bottle_caps") {
    save.goldBottleCaps = asNumber(save.goldBottleCaps) + quantity;
    return;
  }

  if (grant.grant_type === "ability_capsules") {
    save.abilityCapsules = asNumber(save.abilityCapsules) + quantity;
    return;
  }

  if (grant.grant_type === "ability_patches") {
    save.abilityPatches = asNumber(save.abilityPatches) + quantity;
    return;
  }

  if (grant.grant_type === "ancient_charms") {
    save.ancientCharms = asNumber(save.ancientCharms) + quantity;
    return;
  }

  if (grant.grant_type === "starter_unlock") {
    if (!grant.grant_key) return;
    const unlocked = new Set(asStringArray(save.unlockedStarters));
    unlocked.add(grant.grant_key);
    save.unlockedStarters = [...unlocked];

    // Preserve richer reward metadata for future UI/features even though the
    // recovered v0.9.4 client currently reads unlockedStarters only.
    const rewardMap =
      save.accountPokemonRewards &&
      typeof save.accountPokemonRewards === "object" &&
      !Array.isArray(save.accountPokemonRewards)
        ? { ...(save.accountPokemonRewards as Record<string, unknown>) }
        : {};
    rewardMap[grant.grant_key] = {
      ...(typeof rewardMap[grant.grant_key] === "object" &&
      rewardMap[grant.grant_key] !== null &&
      !Array.isArray(rewardMap[grant.grant_key])
        ? (rewardMap[grant.grant_key] as Record<string, unknown>)
        : {}),
      ...grant.payload,
      quantity,
      grantedAt: grant.created_at,
    };
    save.accountPokemonRewards = rewardMap;
    return;
  }

  if (grant.grant_type === "achievement") {
    if (!grant.grant_key) return;
    const achievements = new Set(asStringArray(save.achievements));
    achievements.add(grant.grant_key);
    save.achievements = [...achievements];
    return;
  }

  if (grant.grant_type === "relic") {
    if (!grant.grant_key) return;
    const relics = new Set(asStringArray(save.relicsOwned));
    relics.add(grant.grant_key);
    save.relicsOwned = [...relics];
  }
};

class GameGrantSync {
  private session: Session | null = null;
  private timer: number | undefined;
  private busy = false;

  async start() {
    this.session = await getSession();
    this.restartTimer();
    if (this.session) void this.syncOnce();

    subscribeToAuth((_event, session) => {
      this.session = session;
      this.restartTimer();
      if (session) void this.syncOnce();
    });
  }

  private restartTimer() {
    if (this.timer !== undefined) {
      window.clearInterval(this.timer);
      this.timer = undefined;
    }

    if (!this.session) return;
    this.timer = window.setInterval(() => void this.syncOnce(), 5000);
  }

  private async fetchPending() {
    if (!supabase || !this.session) return [] as PendingGameGrant[];
    const { data, error } = await supabase.rpc("fetch_my_pending_game_grants");
    if (error) throw error;
    return (data ?? []) as PendingGameGrant[];
  }

  private async acknowledge(ids: string[]) {
    if (!supabase || !ids.length) return;
    const { error } = await supabase.rpc("ack_my_game_grants", {
      p_ids: ids,
    });
    if (error) throw error;
  }

  async syncOnce() {
    if (this.busy || !this.session || !supabase) return;
    this.busy = true;

    try {
      const pending = await this.fetchPending();
      if (!pending.length) return;

      const save = readLocalSaveObject();

      // Do not consume grants before the player has an actual profile/save.
      // They remain pending and will be applied after profile creation/login sync.
      if (!save || !save.profile) return;

      const applied = new Set(asStringArray(save[APPLIED_GRANT_IDS_KEY]));
      const toAck: string[] = [];
      let changed = false;

      for (const grant of pending) {
        if (applied.has(grant.id)) {
          toAck.push(grant.id);
          continue;
        }

        applyGrantToSave(save, grant);
        applied.add(grant.id);
        toAck.push(grant.id);
        changed = true;
      }

      save[APPLIED_GRANT_IDS_KEY] = [...applied].slice(-500);

      if (changed) {
        localStorage.setItem(SAVE_KEY, JSON.stringify(save));
        await uploadSaveObject(save);
      }

      await this.acknowledge(toAck);

      if (changed) {
        window.location.reload();
      }
    } catch (error) {
      console.error("[PokéRegions] Game grant sync failed", error);
    } finally {
      this.busy = false;
    }
  }
}

export const mountGameGrantSync = async () => {
  if (!supabase) return;
  const sync = new GameGrantSync();
  await sync.start();
};
