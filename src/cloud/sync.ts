import type { Session } from "@supabase/supabase-js";
import {
  fetchCloudSave,
  getLocalSaveSummary,
  installCloudSaveLocally,
  readLocalSaveObject,
  uploadSaveObject,
} from "./supabase";

const SYNC_META_KEY = "pokeregions-cloud-sync-v1";

type SyncMeta = {
  userId: string;
  lastSyncedHash: string;
  cloudUpdatedAt: string;
};

export type CloudSyncState =
  | { kind: "idle"; text: string }
  | { kind: "synced"; text: string; updatedAt?: string }
  | { kind: "working"; text: string }
  | { kind: "conflict"; text: string; cloudUpdatedAt: string }
  | { kind: "error"; text: string };

type StateListener = (state: CloudSyncState) => void;

const readMeta = (): SyncMeta | null => {
  const raw = localStorage.getItem(SYNC_META_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SyncMeta;
    return parsed?.userId ? parsed : null;
  } catch {
    return null;
  }
};

const writeMeta = (meta: SyncMeta) => {
  localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
};

const clearMeta = () => localStorage.removeItem(SYNC_META_KEY);

const hashText = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(object)
        .sort()
        .map((key) => [key, stableValue(object[key])]),
    );
  }
  return value;
};

const hashObject = (value: Record<string, unknown>) =>
  hashText(JSON.stringify(stableValue(value)));

export class CloudSyncController {
  private timer: number | undefined;
  private busy = false;
  private conflict = false;
  private stopped = false;

  constructor(
    private readonly session: Session,
    private readonly onState: StateListener,
  ) {}

  async start() {
    this.stopped = false;
    await this.syncOnce(true);
    if (this.stopped || this.conflict) return;
    this.timer = window.setInterval(() => void this.syncOnce(false), 4000);
  }

  stop() {
    this.stopped = true;
    if (this.timer !== undefined) window.clearInterval(this.timer);
    this.timer = undefined;
  }

  private async markSynced(localHash: string, cloudUpdatedAt: string) {
    writeMeta({
      userId: this.session.user.id,
      lastSyncedHash: localHash,
      cloudUpdatedAt,
    });
    this.onState({
      kind: "synced",
      text: "Cloud-Save synchronisiert",
      updatedAt: cloudUpdatedAt,
    });
  }

  private restoreAndReload(cloud: Awaited<ReturnType<typeof fetchCloudSave>>) {
    if (!cloud) return;
    installCloudSaveLocally(cloud);
    void hashObject(cloud.save_data).then((hash) => {
      writeMeta({
        userId: this.session.user.id,
        lastSyncedHash: hash,
        cloudUpdatedAt: cloud.updated_at,
      });
      window.location.reload();
    });
  }

  async syncOnce(initial: boolean) {
    if (this.busy || this.conflict || this.stopped) return;
    this.busy = true;

    try {
      const local = readLocalSaveObject();
      const localSummary = getLocalSaveSummary();
      const cloud = await fetchCloudSave();
      const meta = readMeta();
      const metaForUser = meta?.userId === this.session.user.id ? meta : null;

      if (!cloud && (!local || !localSummary.meaningful)) {
        this.onState({ kind: "synced", text: "Account verbunden · noch kein Spielstand" });
        return;
      }

      if (!cloud && local && localSummary.meaningful) {
        this.onState({ kind: "working", text: "Ersten Cloud-Save erstellen …" });
        const uploaded = await uploadSaveObject(local);
        const localHash = await hashObject(local);
        await this.markSynced(localHash, uploaded.updated_at);
        return;
      }

      if (cloud && (!local || !localSummary.meaningful)) {
        this.onState({ kind: "working", text: "Cloud-Spielstand wird geladen …" });
        this.restoreAndReload(cloud);
        return;
      }

      if (!cloud || !local) return;

      const [localHash, cloudHash] = await Promise.all([
        hashObject(local),
        hashObject(cloud.save_data),
      ]);

      if (localHash === cloudHash) {
        await this.markSynced(localHash, cloud.updated_at);
        return;
      }

      if (!metaForUser) {
        this.conflict = true;
        this.onState({
          kind: "conflict",
          text: initial
            ? "Auf diesem Gerät existiert bereits ein anderer lokaler Spielstand."
            : "Lokaler und Cloud-Spielstand unterscheiden sich.",
          cloudUpdatedAt: cloud.updated_at,
        });
        return;
      }

      const localChanged = localHash !== metaForUser.lastSyncedHash;
      const cloudChanged = cloud.updated_at !== metaForUser.cloudUpdatedAt;

      if (!localChanged && cloudChanged) {
        this.onState({ kind: "working", text: "Neuerer Cloud-Spielstand gefunden …" });
        this.restoreAndReload(cloud);
        return;
      }

      if (localChanged && !cloudChanged) {
        this.onState({ kind: "working", text: "Fortschritt wird gespeichert …" });
        const uploaded = await uploadSaveObject(local);
        await this.markSynced(localHash, uploaded.updated_at);
        return;
      }

      if (!localChanged && !cloudChanged) {
        await this.markSynced(localHash, cloud.updated_at);
        return;
      }

      this.conflict = true;
      this.onState({
        kind: "conflict",
        text: "Auf zwei Geräten wurde seit der letzten Synchronisierung gespielt.",
        cloudUpdatedAt: cloud.updated_at,
      });
    } catch (error) {
      this.onState({
        kind: "error",
        text: error instanceof Error ? error.message : "Cloud-Synchronisierung fehlgeschlagen.",
      });
    } finally {
      this.busy = false;
    }
  }

  async resolveConflict(choice: "local" | "cloud") {
    this.conflict = false;
    const cloud = await fetchCloudSave();

    if (choice === "cloud") {
      if (!cloud) throw new Error("Cloud-Spielstand nicht gefunden.");
      this.onState({ kind: "working", text: "Cloud-Spielstand wird übernommen …" });
      this.restoreAndReload(cloud);
      return;
    }

    const local = readLocalSaveObject();
    if (!local) throw new Error("Lokaler Spielstand nicht gefunden.");
    this.onState({ kind: "working", text: "Lokaler Spielstand wird in die Cloud übernommen …" });
    const uploaded = await uploadSaveObject(local);
    const hash = await hashObject(local);
    await this.markSynced(hash, uploaded.updated_at);
    if (!this.stopped && this.timer === undefined) {
      this.timer = window.setInterval(() => void this.syncOnce(false), 4000);
    }
  }

  forgetDeviceLink() {
    clearMeta();
  }
}
