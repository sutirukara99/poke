import type { Session } from "@supabase/supabase-js";
import type {
  AchievementRow,
  AnnouncementRow,
  AppRole,
  CatalogItemKind,
  CatalogItemRow,
  CatalogRarity,
  EventRow,
  FeatureFlagRow,
  ProfileRow,
  PromoCodeRow,
  RewardBundleEntryRow,
  RewardBundleRow,
  UserAchievementRow,
  AccountInventoryRow,
} from "../types/backend";
import {
  adminDeleteAchievement,
  adminDeleteAnnouncement,
  adminDeleteCatalogItem,
  adminDeleteEvent,
  adminDeletePromoCode,
  adminDeleteRewardBundleEntry,
  adminFetchAchievementsAll,
  adminFetchAnnouncementsAll,
  adminFetchAuditLog,
  adminFetchCatalogAll,
  adminFetchEventsAll,
  adminFetchFeatureFlagsAll,
  adminFetchPromoCodes,
  adminFetchRewardBundleEntries,
  adminFetchRewardBundles,
  adminFetchUserAchievements,
  adminFetchUserInventory,
  adminFetchUserRoles,
  adminGrantCatalogItem,
  adminGrantRewardBundle,
  adminGrantRole,
  adminNotifyUser,
  adminRemoveRole,
  adminSaveAchievement,
  adminSaveAnnouncement,
  adminSaveCatalogItem,
  adminSaveEvent,
  adminSaveFeatureFlag,
  adminSavePromoCode,
  adminSaveRewardBundle,
  adminSaveRewardBundleEntry,
  adminSearchProfiles,
  adminSetAccountState,
  adminUnlockAchievement,
  fetchMyRoles,
  type AdminAuditRow,
} from "./backend";
import { cloudConfigured, getSession, subscribeToAuth } from "./supabase";

type AdminTab =
  | "overview"
  | "players"
  | "catalog"
  | "rewards"
  | "codes"
  | "achievements"
  | "events"
  | "live"
  | "logs";

const ensureHost = () => {
  let host = document.getElementById("pokeregions-admin-root");
  if (!host) {
    host = document.createElement("div");
    host.id = "pokeregions-admin-root";
    document.body.appendChild(host);
  }
  return host;
};

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text = "",
) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

const btn = (label: string, className = "") => {
  const node = el("button", className, label);
  node.type = "button";
  return node;
};

const field = (label: string, control: HTMLElement, hint = "") => {
  const wrap = el("label", "pr-admin-field");
  const title = el("span", "pr-admin-field-label", label);
  wrap.append(title, control);
  if (hint) wrap.append(el("small", "pr-admin-field-hint", hint));
  return wrap;
};

const textInput = (
  placeholder: string,
  value = "",
  type: HTMLInputElement["type"] = "text",
) => {
  const node = el("input", "pr-admin-input");
  node.type = type;
  node.placeholder = placeholder;
  node.value = value;
  return node;
};

const numberInput = (value = "", min = "0") => {
  const node = textInput("", value, "number");
  node.min = min;
  return node;
};

const checkInput = (checked = false) => {
  const node = el("input");
  node.type = "checkbox";
  node.checked = checked;
  return node;
};

const area = (placeholder: string, value = "") => {
  const node = el("textarea", "pr-admin-textarea");
  node.placeholder = placeholder;
  node.value = value;
  node.rows = 3;
  return node;
};

const selectInput = (
  options: Array<{ value: string; label: string }>,
  value = "",
) => {
  const node = el("select", "pr-admin-select");
  for (const option of options) {
    const item = el("option");
    item.value = option.value;
    item.textContent = option.label;
    item.selected = option.value === value;
    node.append(item);
  }
  return node;
};

const formSection = (title: string, copy = "") => {
  const section = el("section", "pr-admin-section");
  const heading = el("div", "pr-admin-section-heading");
  heading.append(el("h3", "", title));
  if (copy) heading.append(el("p", "", copy));
  section.append(heading);
  return section;
};

const parseJson = (raw: string, fallback: Record<string, unknown> = {}) => {
  const value = raw.trim();
  if (!value) return fallback;
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Metadata muss ein JSON-Objekt sein.");
  }
  return parsed as Record<string, unknown>;
};

const toIso = (value: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Ungültiges Datum.");
  return date.toISOString();
};

const toLocalInput = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const formatTime = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("de-DE");
};

const catalogKinds: CatalogItemKind[] = [
  "currency",
  "item",
  "relic",
  "pokemon",
  "avatar",
  "frame",
  "background",
  "title",
  "token",
];

const rarities: CatalogRarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "exclusive",
];

class AdminUi {
  private readonly host = ensureHost();
  private session: Session | null = null;
  private isAdmin = false;
  private modalOpen = false;
  private activeTab: AdminTab = "overview";
  private loading = false;
  private status = "";
  private statusKind: "ok" | "error" | "info" = "info";
  private searchTerm = "";
  private selectedUserId = "";

  private profiles: ProfileRow[] = [];
  private catalog: CatalogItemRow[] = [];
  private bundles: RewardBundleRow[] = [];
  private codes: PromoCodeRow[] = [];
  private achievements: AchievementRow[] = [];
  private events: EventRow[] = [];
  private flags: FeatureFlagRow[] = [];
  private announcements: AnnouncementRow[] = [];
  private audit: AdminAuditRow[] = [];

  private selectedInventory: AccountInventoryRow[] = [];
  private selectedAchievements: UserAchievementRow[] = [];
  private selectedRoles: AppRole[] = [];

  private selectedBundleId = "";
  private bundleEntries: RewardBundleEntryRow[] = [];

  private editingCatalogKey = "";
  private editingAchievementKey = "";
  private editingCodeId = "";
  private editingEventKey = "";
  private editingAnnouncementKey = "";

  async start() {
    if (!cloudConfigured) return;

    await this.refreshAccess();

    subscribeToAuth((_event, session) => {
      window.setTimeout(async () => {
        this.session = session;
        await this.refreshAccess();
      }, 0);
    });
  }

  private async refreshAccess() {
    this.session = await getSession();
    if (!this.session) {
      this.isAdmin = false;
      this.modalOpen = false;
      this.render();
      return;
    }

    try {
      const roles = await fetchMyRoles();
      this.isAdmin = roles.includes("admin");
      if (this.isAdmin && !this.selectedUserId) {
        this.selectedUserId = this.session.user.id;
      }
    } catch {
      this.isAdmin = false;
    }

    this.render();
  }

  private setStatus(message: string, kind: "ok" | "error" | "info" = "info") {
    this.status = message;
    this.statusKind = kind;
    this.render();
  }

  private async runAction(
    action: () => Promise<void>,
    success: string,
    reload = true,
  ) {
    this.loading = true;
    this.status = "";
    this.render();
    try {
      await action();
      if (reload) await this.reloadAll();
      this.status = success;
      this.statusKind = "ok";
    } catch (error) {
      this.status = error instanceof Error ? error.message : "Aktion fehlgeschlagen.";
      this.statusKind = "error";
    } finally {
      this.loading = false;
      this.render();
    }
  }

  private async open() {
    this.modalOpen = true;
    this.loading = true;
    this.status = "";
    this.render();

    try {
      await this.reloadAll();
    } catch (error) {
      this.status = error instanceof Error ? error.message : "Admin-Daten konnten nicht geladen werden.";
      this.statusKind = "error";
    } finally {
      this.loading = false;
      this.render();
    }
  }

  private close() {
    this.modalOpen = false;
    this.status = "";
    this.render();
  }

  private async reloadAll() {
    const [
      profiles,
      catalog,
      bundles,
      codes,
      achievements,
      events,
      flags,
      announcements,
      audit,
    ] = await Promise.all([
      adminSearchProfiles(this.searchTerm, 60),
      adminFetchCatalogAll(),
      adminFetchRewardBundles(),
      adminFetchPromoCodes(),
      adminFetchAchievementsAll(),
      adminFetchEventsAll(),
      adminFetchFeatureFlagsAll(),
      adminFetchAnnouncementsAll(),
      adminFetchAuditLog(100),
    ]);

    this.profiles = profiles;
    this.catalog = catalog;
    this.bundles = bundles;
    this.codes = codes;
    this.achievements = achievements;
    this.events = events;
    this.flags = flags;
    this.announcements = announcements;
    this.audit = audit;

    if (!this.selectedBundleId && bundles[0]) {
      this.selectedBundleId = bundles[0].id;
    }
    await Promise.all([
      this.loadSelectedUserData(),
      this.loadBundleEntries(),
    ]);
  }

  private async loadSelectedUserData() {
    if (!this.selectedUserId) {
      this.selectedInventory = [];
      this.selectedAchievements = [];
      this.selectedRoles = [];
      return;
    }

    const [inventory, achievements, roles] = await Promise.all([
      adminFetchUserInventory(this.selectedUserId),
      adminFetchUserAchievements(this.selectedUserId),
      adminFetchUserRoles(this.selectedUserId),
    ]);
    this.selectedInventory = inventory;
    this.selectedAchievements = achievements;
    this.selectedRoles = roles;
  }

  private async loadBundleEntries() {
    if (!this.selectedBundleId) {
      this.bundleEntries = [];
      return;
    }
    this.bundleEntries = await adminFetchRewardBundleEntries(this.selectedBundleId);
  }

  private selectedProfile() {
    return this.profiles.find((profile) => profile.user_id === this.selectedUserId) ?? null;
  }

  private navButton(tab: AdminTab, label: string) {
    const node = btn(label, "pr-admin-nav-btn");
    if (this.activeTab === tab) node.classList.add("is-active");
    node.addEventListener("click", () => {
      this.activeTab = tab;
      this.status = "";
      this.render();
    });
    return node;
  }

  private renderOverview(container: HTMLElement) {
    const hero = formSection(
      "Backend Übersicht",
      "Live-Verwaltung für Spieler, permanente Rewards und Content ohne neuen Game-Build.",
    );
    const stats = el("div", "pr-admin-stat-grid");
    const data = [
      ["Spieler", String(this.profiles.length)],
      ["Katalog", String(this.catalog.length)],
      ["Reward Bundles", String(this.bundles.length)],
      ["Gutscheine", String(this.codes.length)],
      ["Achievements", String(this.achievements.length)],
      ["Events", String(this.events.length)],
    ];
    for (const [label, value] of data) {
      const card = el("div", "pr-admin-stat");
      card.append(el("strong", "", value), el("span", "", label));
      stats.append(card);
    }
    hero.append(stats);

    const selected = this.selectedProfile();
    const quick = el("div", "pr-admin-quick");
    const copy = el("div");
    copy.append(
      el("strong", "", selected ? `Ausgewählt: ${selected.trainer_name}` : "Kein Spieler ausgewählt"),
      el(
        "small",
        "",
        selected
          ? selected.user_id
          : "Unter Spieler kannst du einen Account auswählen. Dein eigener Account ist standardmäßig aktiv.",
      ),
    );
    const playerBtn = btn("Spieler verwalten", "primary");
    playerBtn.addEventListener("click", () => {
      this.activeTab = "players";
      this.render();
    });
    quick.append(copy, playerBtn);
    hero.append(quick);
    container.append(hero);

    const safety = formSection("Sicherheitsstatus");
    const rows = [
      ["Admin UI", this.isAdmin ? "Serverrolle bestätigt" : "Kein Admin"],
      ["Reward Vergabe", "über geschützte RPCs"],
      ["Gutscheine", "serverseitige Prüfung + Limits"],
      ["Spielerdaten", "RLS geschützt"],
      ["Audit Log", "aktive Admin-Aktionen werden protokolliert"],
    ];
    const list = el("div", "pr-admin-simple-list");
    for (const [key, value] of rows) {
      const row = el("div", "pr-admin-list-row");
      row.append(el("strong", "", key), el("span", "", value));
      list.append(row);
    }
    safety.append(list);
    container.append(safety);
  }

  private renderPlayers(container: HTMLElement) {
    const search = formSection(
      "Spieler",
      "Suche nach Trainername. UUIDs können ebenfalls direkt ausgewählt werden.",
    );
    const searchForm = el("form", "pr-admin-inline-form");
    const query = textInput("Trainer suchen …", this.searchTerm);
    const submit = btn("Suchen", "primary");
    submit.type = "submit";
    const self = btn("Mich auswählen");
    self.addEventListener("click", () => {
      if (!this.session) return;
      this.selectedUserId = this.session.user.id;
      void this.runAction(async () => {
        await this.loadSelectedUserData();
      }, "Eigener Account ausgewählt.", false);
    });
    searchForm.append(query, submit, self);
    searchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      this.searchTerm = query.value.trim();
      void this.runAction(async () => {
        this.profiles = await adminSearchProfiles(this.searchTerm, 60);
      }, "Spielerliste aktualisiert.", false);
    });
    search.append(searchForm);

    const results = el("div", "pr-admin-player-grid");
    for (const profile of this.profiles) {
      const card = el("article", "pr-admin-player-card");
      if (profile.user_id === this.selectedUserId) card.classList.add("is-selected");
      const top = el("div");
      top.append(
        el("strong", "", profile.trainer_name),
        el("small", "", profile.user_id),
      );
      const meta = el("small", "", `${profile.account_state} · zuletzt ${formatTime(profile.last_seen_at)}`);
      const choose = btn(profile.user_id === this.selectedUserId ? "Ausgewählt" : "Auswählen");
      choose.disabled = profile.user_id === this.selectedUserId;
      choose.addEventListener("click", () => {
        this.selectedUserId = profile.user_id;
        void this.runAction(async () => {
          await this.loadSelectedUserData();
        }, `${profile.trainer_name} ausgewählt.`, false);
      });
      card.append(top, meta, choose);
      results.append(card);
    }
    search.append(results);
    container.append(search);

    const profile = this.selectedProfile();
    if (!this.selectedUserId) return;

    const manage = formSection(
      profile ? `Account: ${profile.trainer_name}` : "Ausgewählter Account",
      this.selectedUserId,
    );

    const badges = el("div", "pr-admin-chip-row");
    for (const role of this.selectedRoles) badges.append(el("span", "pr-admin-chip", role));
    badges.append(el("span", "pr-admin-chip", `${this.selectedInventory.length} Inventar-Einträge`));
    badges.append(el("span", "pr-admin-chip", `${this.selectedAchievements.length} Erfolge`));
    manage.append(badges);

    const actions = el("div", "pr-admin-two-col");

    const grantItem = el("form", "pr-admin-card");
    grantItem.append(el("h4", "", "Item / Coins / Pokémon geben"));
    const itemSelect = selectInput(
      this.catalog.map((item) => ({
        value: item.item_key,
        label: `${item.name} · ${item.kind} · ${item.item_key}`,
      })),
    );
    const qty = numberInput("1", "1");
    const itemReason = textInput("Grund (optional)");
    const itemSubmit = btn("Vergeben", "primary");
    itemSubmit.type = "submit";
    grantItem.append(
      field("Katalog-Eintrag", itemSelect),
      field("Menge", qty),
      field("Grund", itemReason),
      itemSubmit,
    );
    grantItem.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.runAction(
        () =>
          adminGrantCatalogItem(
            this.selectedUserId,
            itemSelect.value,
            Math.max(1, Number(qty.value) || 1),
            itemReason.value.trim(),
          ),
        "Reward vergeben.",
      );
    });

    const grantBundle = el("form", "pr-admin-card");
    grantBundle.append(el("h4", "", "Reward Bundle geben"));
    const bundleSelect = selectInput(
      this.bundles.map((bundle) => ({
        value: bundle.bundle_key,
        label: `${bundle.name} · ${bundle.bundle_key}`,
      })),
    );
    const bundleReason = textInput("Grund (optional)");
    const bundleSubmit = btn("Bundle vergeben", "primary");
    bundleSubmit.type = "submit";
    grantBundle.append(
      field("Bundle", bundleSelect),
      field("Grund", bundleReason),
      bundleSubmit,
    );
    grantBundle.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.runAction(
        async () => {
          await adminGrantRewardBundle(
            this.selectedUserId,
            bundleSelect.value,
            bundleReason.value.trim(),
          );
        },
        "Reward Bundle vergeben.",
      );
    });

    const grantAchievement = el("form", "pr-admin-card");
    grantAchievement.append(el("h4", "", "Achievement freischalten"));
    const achievementSelect = selectInput(
      this.achievements.map((achievement) => ({
        value: achievement.achievement_key,
        label: `${achievement.name} · ${achievement.achievement_key}`,
      })),
    );
    const achReason = textInput("Grund (optional)");
    const achSubmit = btn("Freischalten", "primary");
    achSubmit.type = "submit";
    grantAchievement.append(
      field("Achievement", achievementSelect),
      field("Grund", achReason),
      achSubmit,
    );
    grantAchievement.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.runAction(
        async () => {
          await adminUnlockAchievement(
            this.selectedUserId,
            achievementSelect.value,
            achReason.value.trim(),
          );
        },
        "Achievement freigeschaltet.",
      );
    });

    const roles = el("form", "pr-admin-card");
    roles.append(el("h4", "", "Rollen"));
    const roleSelect = selectInput(
      ["player", "tester", "moderator", "admin"].map((role) => ({
        value: role,
        label: role,
      })),
    );
    const roleActions = el("div", "pr-admin-inline-actions");
    const addRole = btn("Rolle geben", "primary");
    const removeRole = btn("Rolle entfernen");
    addRole.addEventListener("click", () => {
      void this.runAction(
        () => adminGrantRole(this.selectedUserId, roleSelect.value as AppRole),
        "Rolle vergeben.",
      );
    });
    removeRole.addEventListener("click", () => {
      void this.runAction(
        () => adminRemoveRole(this.selectedUserId, roleSelect.value as AppRole),
        "Rolle entfernt.",
      );
    });
    roleActions.append(addRole, removeRole);
    roles.append(field("Rolle", roleSelect), roleActions);

    const state = el("form", "pr-admin-card");
    state.append(el("h4", "", "Account-Status"));
    const stateSelect = selectInput(
      [
        { value: "active", label: "active" },
        { value: "restricted", label: "restricted" },
        { value: "banned", label: "banned" },
      ],
      profile?.account_state ?? "active",
    );
    const stateReason = textInput("Grund");
    const stateSubmit = btn("Status setzen", "danger");
    stateSubmit.type = "submit";
    state.append(field("Status", stateSelect), field("Grund", stateReason), stateSubmit);
    state.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.runAction(
        () =>
          adminSetAccountState(
            this.selectedUserId,
            stateSelect.value as "active" | "restricted" | "banned",
            stateReason.value.trim(),
          ),
        "Account-Status aktualisiert.",
      );
    });

    const notify = el("form", "pr-admin-card");
    notify.append(el("h4", "", "Ingame Nachricht senden"));
    const title = textInput("Titel");
    const body = area("Nachricht");
    const kind = selectInput([
      { value: "info", label: "Info" },
      { value: "reward", label: "Reward" },
      { value: "warning", label: "Warnung" },
      { value: "system", label: "System" },
    ]);
    const notifySubmit = btn("Nachricht senden", "primary");
    notifySubmit.type = "submit";
    notify.append(field("Titel", title), field("Text", body), field("Typ", kind), notifySubmit);
    notify.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!title.value.trim()) return;
      void this.runAction(
        async () => {
          await adminNotifyUser(
            this.selectedUserId,
            title.value.trim(),
            body.value.trim(),
            kind.value,
          );
        },
        "Nachricht versendet.",
      );
    });

    actions.append(grantItem, grantBundle, grantAchievement, roles, state, notify);
    manage.append(actions);

    const holdings = el("div", "pr-admin-two-col");
    const inventoryBox = el("div", "pr-admin-card");
    inventoryBox.append(el("h4", "", "Account Inventar"));
    const inventoryList = el("div", "pr-admin-mini-list");
    for (const item of this.selectedInventory) {
      const catalog = this.catalog.find((entry) => entry.item_key === item.item_key);
      const row = el("div", "pr-admin-mini-row");
      row.append(
        el("strong", "", catalog?.name ?? item.item_key),
        el("span", "", `×${item.quantity}`),
      );
      inventoryList.append(row);
    }
    if (!this.selectedInventory.length) {
      inventoryList.append(el("small", "", "Noch keine permanenten Items."));
    }
    inventoryBox.append(inventoryList);

    const achBox = el("div", "pr-admin-card");
    achBox.append(el("h4", "", "Freigeschaltete Erfolge"));
    const achList = el("div", "pr-admin-mini-list");
    for (const owned of this.selectedAchievements) {
      const definition = this.achievements.find(
        (achievement) => achievement.achievement_key === owned.achievement_key,
      );
      const row = el("div", "pr-admin-mini-row");
      row.append(
        el("strong", "", definition?.name ?? owned.achievement_key),
        el("span", "", formatTime(owned.unlocked_at)),
      );
      achList.append(row);
    }
    if (!this.selectedAchievements.length) {
      achList.append(el("small", "", "Noch keine DB-Achievements."));
    }
    achBox.append(achList);
    holdings.append(inventoryBox, achBox);
    manage.append(holdings);
    container.append(manage);
  }

  private renderCatalog(container: HTMLElement) {
    const editing = this.catalog.find((item) => item.item_key === this.editingCatalogKey);
    const section = formSection(
      editing ? `Katalog bearbeiten: ${editing.name}` : "Katalog-Eintrag erstellen",
      "Hier legst du Coins, Items, Relikte, permanente Pokémon, Titel, Rahmen und weitere Account-Rewards an.",
    );

    const form = el("form", "pr-admin-form-grid");
    const key = textInput("z.B. pokemon.event_mew", editing?.item_key ?? "");
    key.disabled = Boolean(editing);
    const kind = selectInput(
      catalogKinds.map((value) => ({ value, label: value })),
      editing?.kind ?? "item",
    );
    const name = textInput("Name", editing?.name ?? "");
    const description = area("Beschreibung", editing?.description ?? "");
    const rarity = selectInput(
      rarities.map((value) => ({ value, label: value })),
      editing?.rarity ?? "common",
    );
    const stackable = checkInput(editing?.stackable ?? true);
    const active = checkInput(editing?.is_active ?? true);
    const iconUrl = textInput("Icon URL (optional)", editing?.icon_url ?? "");
    const metadata = area(
      '{"species":"riolu","shiny":true}',
      JSON.stringify(editing?.metadata ?? {}, null, 2),
    );
    const save = btn(editing ? "Änderungen speichern" : "Katalog-Eintrag erstellen", "primary");
    save.type = "submit";
    const cancel = btn("Zurücksetzen");
    cancel.addEventListener("click", () => {
      this.editingCatalogKey = "";
      this.render();
    });

    form.append(
      field("Key", key, "Stabiler interner Schlüssel"),
      field("Typ", kind),
      field("Name", name),
      field("Rarity", rarity),
      field("Beschreibung", description),
      field("Icon", iconUrl),
      field("Stackbar", stackable),
      field("Aktiv", active),
      field("Metadata JSON", metadata),
    );
    const actions = el("div", "pr-admin-form-actions");
    actions.append(save, cancel);
    form.append(actions);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.runAction(
        async () => {
          await adminSaveCatalogItem({
            item_key: key.value.trim(),
            kind: kind.value as CatalogItemKind,
            name: name.value.trim(),
            description: description.value.trim(),
            icon_url: iconUrl.value.trim() || null,
            rarity: rarity.value as CatalogRarity,
            stackable: stackable.checked,
            is_active: active.checked,
            metadata: parseJson(metadata.value),
            sort_order: editing?.sort_order ?? 0,
          });
          this.editingCatalogKey = "";
        },
        editing ? "Katalog-Eintrag aktualisiert." : "Katalog-Eintrag erstellt.",
      );
    });
    section.append(form);

    const list = el("div", "pr-admin-table-list");
    for (const item of this.catalog) {
      const row = el("div", "pr-admin-table-row");
      const copy = el("div", "pr-admin-table-copy");
      copy.append(
        el("strong", "", item.name),
        el("small", "", `${item.kind} · ${item.rarity} · ${item.item_key}`),
      );
      const tags = el("div", "pr-admin-chip-row");
      if (!item.is_active) tags.append(el("span", "pr-admin-chip is-off", "inaktiv"));
      if (!item.stackable) tags.append(el("span", "pr-admin-chip", "unique"));
      const actions = el("div", "pr-admin-row-actions");
      const edit = btn("Bearbeiten");
      edit.addEventListener("click", () => {
        this.editingCatalogKey = item.item_key;
        this.render();
      });
      const grant = btn("An Spieler geben", "primary");
      grant.disabled = !this.selectedUserId;
      grant.addEventListener("click", () => {
        if (!this.selectedUserId) return;
        void this.runAction(
          () => adminGrantCatalogItem(this.selectedUserId, item.item_key, 1, "Admin Panel"),
          `${item.name} vergeben.`,
        );
      });
      const remove = btn("Löschen", "danger");
      remove.addEventListener("click", () => {
        if (!window.confirm(`${item.name} wirklich löschen? Referenzierte Items können von der DB blockiert werden.`)) return;
        void this.runAction(
          () => adminDeleteCatalogItem(item.item_key),
          "Katalog-Eintrag gelöscht.",
        );
      });
      actions.append(edit, grant, remove);
      row.append(copy, tags, actions);
      list.append(row);
    }
    section.append(list);
    container.append(section);
  }

  private renderRewards(container: HTMLElement) {
    const create = formSection(
      "Reward Bundles",
      "Bundles kombinieren mehrere Rewards und können für Gutscheine, Events, Achievements oder manuelle Vergabe wiederverwendet werden.",
    );
    const form = el("form", "pr-admin-form-grid");
    const key = textInput("bundle.event_name");
    const name = textInput("Bundle Name");
    const description = area("Beschreibung");
    const active = checkInput(true);
    const save = btn("Bundle erstellen", "primary");
    save.type = "submit";
    form.append(
      field("Bundle Key", key),
      field("Name", name),
      field("Beschreibung", description),
      field("Aktiv", active),
      save,
    );
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.runAction(
        async () => {
          const bundle = await adminSaveRewardBundle({
            bundle_key: key.value.trim(),
            name: name.value.trim(),
            description: description.value.trim(),
            is_active: active.checked,
          });
          this.selectedBundleId = bundle.id;
        },
        "Reward Bundle erstellt.",
      );
    });
    create.append(form);

    const bundlePicker = selectInput(
      this.bundles.map((bundle) => ({
        value: bundle.id,
        label: `${bundle.name} · ${bundle.bundle_key}`,
      })),
      this.selectedBundleId,
    );
    bundlePicker.addEventListener("change", () => {
      this.selectedBundleId = bundlePicker.value;
      void this.runAction(
        async () => {
          await this.loadBundleEntries();
        },
        "Bundle geladen.",
        false,
      );
    });
    create.append(field("Bundle bearbeiten", bundlePicker));

    const selected = this.bundles.find((bundle) => bundle.id === this.selectedBundleId);
    if (selected) {
      const editor = el("form", "pr-admin-card");
      editor.append(el("h4", "", `Eintrag zu ${selected.name} hinzufügen`));
      const type = selectInput([
        { value: "item", label: "Item / Coin / Pokémon / Cosmetic" },
        { value: "achievement", label: "Achievement" },
        { value: "entitlement", label: "Entitlement" },
      ]);
      const rewardKey = textInput("reward_key");
      const quantity = numberInput("1", "1");
      const metadata = area("{}", "{}");
      const submit = btn("Reward hinzufügen", "primary");
      submit.type = "submit";
      editor.append(
        field("Reward Typ", type),
        field("Reward Key", rewardKey),
        field("Menge", quantity),
        field("Metadata", metadata),
        submit,
      );
      editor.addEventListener("submit", (event) => {
        event.preventDefault();
        void this.runAction(
          async () => {
            await adminSaveRewardBundleEntry({
              bundle_id: selected.id,
              reward_type: type.value as "item" | "achievement" | "entitlement",
              reward_key: rewardKey.value.trim(),
              quantity: Math.max(1, Number(quantity.value) || 1),
              metadata: parseJson(metadata.value),
            });
          },
          "Reward zum Bundle hinzugefügt.",
        );
      });
      create.append(editor);

      const entries = el("div", "pr-admin-table-list");
      for (const entry of this.bundleEntries) {
        const row = el("div", "pr-admin-table-row");
        const copy = el("div", "pr-admin-table-copy");
        copy.append(
          el("strong", "", entry.reward_key),
          el("small", "", `${entry.reward_type} · ×${entry.quantity}`),
        );
        const remove = btn("Entfernen", "danger");
        remove.addEventListener("click", () => {
          void this.runAction(
            () => adminDeleteRewardBundleEntry(entry.id),
            "Bundle-Eintrag entfernt.",
          );
        });
        row.append(copy, remove);
        entries.append(row);
      }
      create.append(entries);
    }

    const bundleList = el("div", "pr-admin-table-list");
    for (const bundle of this.bundles) {
      const row = el("div", "pr-admin-table-row");
      const copy = el("div", "pr-admin-table-copy");
      copy.append(
        el("strong", "", bundle.name),
        el("small", "", bundle.bundle_key),
      );
      const use = btn("Öffnen");
      use.addEventListener("click", () => {
        this.selectedBundleId = bundle.id;
        void this.runAction(
          async () => {
            await this.loadBundleEntries();
          },
          "Bundle geöffnet.",
          false,
        );
      });
      const grant = btn("An Spieler", "primary");
      grant.disabled = !this.selectedUserId;
      grant.addEventListener("click", () => {
        void this.runAction(
          async () => {
            await adminGrantRewardBundle(this.selectedUserId, bundle.bundle_key, "Admin Panel");
          },
          "Bundle vergeben.",
        );
      });
      const actions = el("div", "pr-admin-row-actions");
      actions.append(use, grant);
      row.append(copy, actions);
      bundleList.append(row);
    }
    create.append(bundleList);
    container.append(create);
  }

  private renderCodes(container: HTMLElement) {
    const editing = this.codes.find((code) => code.id === this.editingCodeId);
    const section = formSection(
      editing ? `Gutschein bearbeiten: ${editing.code}` : "Gutschein erstellen",
      "Codes werden serverseitig geprüft. Spieler können die Code-Tabelle nicht auslesen.",
    );
    const form = el("form", "pr-admin-form-grid");
    const code = textInput("ALPHA2026", editing?.code ?? "");
    const name = textInput("Name", editing?.name ?? "");
    const description = area("Beschreibung", editing?.description ?? "");
    const bundle = selectInput(
      this.bundles.map((entry) => ({
        value: entry.id,
        label: `${entry.name} · ${entry.bundle_key}`,
      })),
      editing?.reward_bundle_id ?? this.bundles[0]?.id ?? "",
    );
    const active = checkInput(editing?.is_active ?? false);
    const starts = textInput("", toLocalInput(editing?.starts_at ?? null), "datetime-local");
    const ends = textInput("", toLocalInput(editing?.ends_at ?? null), "datetime-local");
    const max = numberInput(editing?.max_redemptions?.toString() ?? "", "1");
    const perUser = numberInput((editing?.max_redemptions_per_user ?? 1).toString(), "1");
    const notes = area("Interne Notizen", editing?.notes ?? "");
    const save = btn(editing ? "Gutschein speichern" : "Gutschein erstellen", "primary");
    save.type = "submit";
    const reset = btn("Zurücksetzen");
    reset.addEventListener("click", () => {
      this.editingCodeId = "";
      this.render();
    });
    form.append(
      field("Code", code, "Wird automatisch großgeschrieben"),
      field("Name", name),
      field("Beschreibung", description),
      field("Reward Bundle", bundle),
      field("Aktiv", active),
      field("Start", starts),
      field("Ende", ends),
      field("Max. Einlösungen", max, "Leer = unbegrenzt"),
      field("Pro Account", perUser),
      field("Notizen", notes),
    );
    const actions = el("div", "pr-admin-form-actions");
    actions.append(save, reset);
    form.append(actions);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.runAction(
        async () => {
          await adminSavePromoCode({
            id: editing?.id,
            code: code.value.trim().toUpperCase(),
            name: name.value.trim(),
            description: description.value.trim(),
            reward_bundle_id: bundle.value,
            is_active: active.checked,
            starts_at: toIso(starts.value),
            ends_at: toIso(ends.value),
            max_redemptions: max.value ? Math.max(1, Number(max.value)) : null,
            max_redemptions_per_user: Math.max(1, Number(perUser.value) || 1),
            created_by: editing?.created_by ?? this.session?.user.id ?? null,
            notes: notes.value.trim(),
            metadata: editing?.metadata ?? {},
          });
          this.editingCodeId = "";
        },
        editing ? "Gutschein aktualisiert." : "Gutschein erstellt.",
      );
    });
    section.append(form);

    const list = el("div", "pr-admin-table-list");
    for (const item of this.codes) {
      const row = el("div", "pr-admin-table-row");
      const copy = el("div", "pr-admin-table-copy");
      copy.append(
        el("strong", "", item.code),
        el(
          "small",
          "",
          `${item.name} · ${item.is_active ? "AKTIV" : "inaktiv"} · pro Account ${item.max_redemptions_per_user}`,
        ),
      );
      const actions = el("div", "pr-admin-row-actions");
      const toggle = btn(item.is_active ? "Deaktivieren" : "Aktivieren");
      toggle.addEventListener("click", () => {
        void this.runAction(
          async () => {
            await adminSavePromoCode({ ...item, is_active: !item.is_active });
          },
          item.is_active ? "Gutschein deaktiviert." : "Gutschein aktiviert.",
        );
      });
      const edit = btn("Bearbeiten");
      edit.addEventListener("click", () => {
        this.editingCodeId = item.id;
        this.render();
      });
      const remove = btn("Löschen", "danger");
      remove.addEventListener("click", () => {
        if (!window.confirm(`Gutschein ${item.code} wirklich löschen?`)) return;
        void this.runAction(() => adminDeletePromoCode(item.id), "Gutschein gelöscht.");
      });
      actions.append(toggle, edit, remove);
      row.append(copy, actions);
      list.append(row);
    }
    section.append(list);
    container.append(section);
  }

  private renderAchievements(container: HTMLElement) {
    const editing = this.achievements.find(
      (achievement) => achievement.achievement_key === this.editingAchievementKey,
    );
    const section = formSection(
      editing ? `Achievement bearbeiten: ${editing.name}` : "Achievement erstellen",
      "Definitionen sind DB-basiert. Trigger und Fortschritt können später vom Gameplay an diese Keys gekoppelt werden.",
    );
    const form = el("form", "pr-admin-form-grid");
    const key = textInput("achievement.first_win", editing?.achievement_key ?? "");
    key.disabled = Boolean(editing);
    const name = textInput("Name", editing?.name ?? "");
    const description = area("Beschreibung", editing?.description ?? "");
    const category = textInput("Kategorie", editing?.category ?? "general");
    const rarity = selectInput(
      rarities.map((value) => ({ value, label: value })),
      editing?.rarity ?? "common",
    );
    const hidden = checkInput(editing?.is_hidden ?? false);
    const active = checkInput(editing?.is_active ?? true);
    const points = numberInput((editing?.points ?? 0).toString(), "0");
    const trigger = textInput("trigger_key (optional)", editing?.trigger_key ?? "");
    const target = numberInput(editing?.target_value?.toString() ?? "", "0");
    const bundleOptions = [
      { value: "", label: "Kein Reward Bundle" },
      ...this.bundles.map((bundle) => ({
        value: bundle.id,
        label: `${bundle.name} · ${bundle.bundle_key}`,
      })),
    ];
    const bundle = selectInput(bundleOptions, editing?.reward_bundle_id ?? "");
    const metadata = area("{}", JSON.stringify(editing?.metadata ?? {}, null, 2));
    const save = btn(editing ? "Achievement speichern" : "Achievement erstellen", "primary");
    save.type = "submit";
    const reset = btn("Zurücksetzen");
    reset.addEventListener("click", () => {
      this.editingAchievementKey = "";
      this.render();
    });
    form.append(
      field("Key", key),
      field("Name", name),
      field("Beschreibung", description),
      field("Kategorie", category),
      field("Rarity", rarity),
      field("Hidden", hidden),
      field("Aktiv", active),
      field("Punkte", points),
      field("Trigger Key", trigger),
      field("Zielwert", target),
      field("Reward Bundle", bundle),
      field("Metadata", metadata),
    );
    const actions = el("div", "pr-admin-form-actions");
    actions.append(save, reset);
    form.append(actions);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.runAction(
        async () => {
          await adminSaveAchievement({
            achievement_key: key.value.trim(),
            name: name.value.trim(),
            description: description.value.trim(),
            category: category.value.trim() || "general",
            icon_url: editing?.icon_url ?? null,
            rarity: rarity.value as CatalogRarity,
            is_hidden: hidden.checked,
            is_active: active.checked,
            points: Math.max(0, Number(points.value) || 0),
            trigger_key: trigger.value.trim() || null,
            target_value: target.value ? Number(target.value) : null,
            reward_bundle_id: bundle.value || null,
            metadata: parseJson(metadata.value),
            sort_order: editing?.sort_order ?? 0,
          });
          this.editingAchievementKey = "";
        },
        editing ? "Achievement aktualisiert." : "Achievement erstellt.",
      );
    });
    section.append(form);

    const list = el("div", "pr-admin-table-list");
    for (const achievement of this.achievements) {
      const row = el("div", "pr-admin-table-row");
      const copy = el("div", "pr-admin-table-copy");
      copy.append(
        el("strong", "", achievement.name),
        el(
          "small",
          "",
          `${achievement.achievement_key} · ${achievement.rarity} · ${achievement.is_active ? "aktiv" : "inaktiv"}`,
        ),
      );
      const actions = el("div", "pr-admin-row-actions");
      const grant = btn("An Spieler", "primary");
      grant.disabled = !this.selectedUserId;
      grant.addEventListener("click", () => {
        void this.runAction(
          async () => {
            await adminUnlockAchievement(
              this.selectedUserId,
              achievement.achievement_key,
              "Admin Panel",
            );
          },
          "Achievement vergeben.",
        );
      });
      const edit = btn("Bearbeiten");
      edit.addEventListener("click", () => {
        this.editingAchievementKey = achievement.achievement_key;
        this.render();
      });
      const remove = btn("Löschen", "danger");
      remove.addEventListener("click", () => {
        if (!window.confirm(`${achievement.name} wirklich löschen?`)) return;
        void this.runAction(
          () => adminDeleteAchievement(achievement.achievement_key),
          "Achievement gelöscht.",
        );
      });
      actions.append(grant, edit, remove);
      row.append(copy, actions);
      list.append(row);
    }
    section.append(list);
    container.append(section);
  }

  private renderEvents(container: HTMLElement) {
    const editing = this.events.find((event) => event.event_key === this.editingEventKey);
    const section = formSection(
      editing ? `Event bearbeiten: ${editing.name}` : "Event erstellen",
      "Zeitfenster, Live-Status und einmalige Account-Rewards können komplett aus der DB gesteuert werden.",
    );
    const form = el("form", "pr-admin-form-grid");
    const key = textInput("event.halloween_2026", editing?.event_key ?? "");
    key.disabled = Boolean(editing);
    const name = textInput("Event Name", editing?.name ?? "");
    const description = area("Beschreibung", editing?.description ?? "");
    const active = checkInput(editing?.is_active ?? false);
    const starts = textInput("", toLocalInput(editing?.starts_at ?? null), "datetime-local");
    const ends = textInput("", toLocalInput(editing?.ends_at ?? null), "datetime-local");
    const bundle = selectInput(
      [
        { value: "", label: "Kein Reward Bundle" },
        ...this.bundles.map((entry) => ({
          value: entry.id,
          label: `${entry.name} · ${entry.bundle_key}`,
        })),
      ],
      editing?.reward_bundle_id ?? "",
    );
    const metadata = area("{}", JSON.stringify(editing?.metadata ?? {}, null, 2));
    const save = btn(editing ? "Event speichern" : "Event erstellen", "primary");
    save.type = "submit";
    const reset = btn("Zurücksetzen");
    reset.addEventListener("click", () => {
      this.editingEventKey = "";
      this.render();
    });
    form.append(
      field("Event Key", key),
      field("Name", name),
      field("Beschreibung", description),
      field("Aktiv", active),
      field("Start", starts),
      field("Ende", ends),
      field("Reward Bundle", bundle),
      field("Metadata", metadata),
    );
    const actions = el("div", "pr-admin-form-actions");
    actions.append(save, reset);
    form.append(actions);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.runAction(
        async () => {
          await adminSaveEvent({
            event_key: key.value.trim(),
            name: name.value.trim(),
            description: description.value.trim(),
            is_active: active.checked,
            starts_at: toIso(starts.value),
            ends_at: toIso(ends.value),
            reward_bundle_id: bundle.value || null,
            metadata: parseJson(metadata.value),
            sort_order: editing?.sort_order ?? 0,
          });
          this.editingEventKey = "";
        },
        editing ? "Event aktualisiert." : "Event erstellt.",
      );
    });
    section.append(form);

    const list = el("div", "pr-admin-table-list");
    for (const event of this.events) {
      const row = el("div", "pr-admin-table-row");
      const copy = el("div", "pr-admin-table-copy");
      copy.append(
        el("strong", "", event.name),
        el(
          "small",
          "",
          `${event.event_key} · ${event.is_active ? "aktiv" : "inaktiv"} · ${formatTime(event.starts_at)} → ${formatTime(event.ends_at)}`,
        ),
      );
      const actions = el("div", "pr-admin-row-actions");
      const edit = btn("Bearbeiten");
      edit.addEventListener("click", () => {
        this.editingEventKey = event.event_key;
        this.render();
      });
      const remove = btn("Löschen", "danger");
      remove.addEventListener("click", () => {
        if (!window.confirm(`${event.name} wirklich löschen?`)) return;
        void this.runAction(() => adminDeleteEvent(event.event_key), "Event gelöscht.");
      });
      actions.append(edit, remove);
      row.append(copy, actions);
      list.append(row);
    }
    section.append(list);
    container.append(section);
  }

  private renderLive(container: HTMLElement) {
    const flags = formSection(
      "Feature Flags",
      "Vorbereitete Features können hier ohne neuen Build aktiviert oder deaktiviert werden.",
    );
    const flagList = el("div", "pr-admin-table-list");
    for (const flag of this.flags) {
      const row = el("div", "pr-admin-table-row");
      const copy = el("div", "pr-admin-table-copy");
      copy.append(el("strong", "", flag.flag_key), el("small", "", flag.description));
      const toggle = btn(flag.enabled ? "AN" : "AUS", flag.enabled ? "primary" : "");
      toggle.addEventListener("click", () => {
        void this.runAction(
          async () => {
            await adminSaveFeatureFlag({ ...flag, enabled: !flag.enabled });
          },
          `${flag.flag_key} ${flag.enabled ? "deaktiviert" : "aktiviert"}.`,
        );
      });
      row.append(copy, toggle);
      flagList.append(row);
    }
    flags.append(flagList);
    container.append(flags);

    const editing = this.announcements.find(
      (announcement) => announcement.announcement_key === this.editingAnnouncementKey,
    );
    const announcements = formSection(
      editing ? `Announcement bearbeiten: ${editing.title}` : "Announcement erstellen",
      "Zeitgesteuerte Ingame-Mitteilungen für Updates, Events und Wartungen.",
    );
    const form = el("form", "pr-admin-form-grid");
    const key = textInput("announcement.patch_1", editing?.announcement_key ?? "");
    key.disabled = Boolean(editing);
    const title = textInput("Titel", editing?.title ?? "");
    const body = area("Text", editing?.body ?? "");
    const severity = selectInput(
      [
        { value: "info", label: "info" },
        { value: "success", label: "success" },
        { value: "warning", label: "warning" },
        { value: "critical", label: "critical" },
      ],
      editing?.severity ?? "info",
    );
    const active = checkInput(editing?.is_active ?? false);
    const starts = textInput("", toLocalInput(editing?.starts_at ?? null), "datetime-local");
    const ends = textInput("", toLocalInput(editing?.ends_at ?? null), "datetime-local");
    const link = textInput("Link URL (optional)", editing?.link_url ?? "");
    const save = btn(editing ? "Announcement speichern" : "Announcement erstellen", "primary");
    save.type = "submit";
    const reset = btn("Zurücksetzen");
    reset.addEventListener("click", () => {
      this.editingAnnouncementKey = "";
      this.render();
    });
    form.append(
      field("Key", key),
      field("Titel", title),
      field("Text", body),
      field("Typ", severity),
      field("Aktiv", active),
      field("Start", starts),
      field("Ende", ends),
      field("Link", link),
    );
    const actions = el("div", "pr-admin-form-actions");
    actions.append(save, reset);
    form.append(actions);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.runAction(
        async () => {
          await adminSaveAnnouncement({
            announcement_key: key.value.trim(),
            title: title.value.trim(),
            body: body.value.trim(),
            severity: severity.value as AnnouncementRow["severity"],
            is_active: active.checked,
            starts_at: toIso(starts.value),
            ends_at: toIso(ends.value),
            link_url: link.value.trim() || null,
            metadata: editing?.metadata ?? {},
          });
          this.editingAnnouncementKey = "";
        },
        editing ? "Announcement aktualisiert." : "Announcement erstellt.",
      );
    });
    announcements.append(form);

    const list = el("div", "pr-admin-table-list");
    for (const announcement of this.announcements) {
      const row = el("div", "pr-admin-table-row");
      const copy = el("div", "pr-admin-table-copy");
      copy.append(
        el("strong", "", announcement.title),
        el(
          "small",
          "",
          `${announcement.announcement_key} · ${announcement.severity} · ${announcement.is_active ? "aktiv" : "inaktiv"}`,
        ),
      );
      const actions = el("div", "pr-admin-row-actions");
      const edit = btn("Bearbeiten");
      edit.addEventListener("click", () => {
        this.editingAnnouncementKey = announcement.announcement_key;
        this.render();
      });
      const remove = btn("Löschen", "danger");
      remove.addEventListener("click", () => {
        if (!window.confirm(`${announcement.title} wirklich löschen?`)) return;
        void this.runAction(
          () => adminDeleteAnnouncement(announcement.announcement_key),
          "Announcement gelöscht.",
        );
      });
      actions.append(edit, remove);
      row.append(copy, actions);
      list.append(row);
    }
    announcements.append(list);
    container.append(announcements);
  }

  private renderLogs(container: HTMLElement) {
    const section = formSection(
      "Admin Audit Log",
      "Grant-, Achievement-, Notification- und Moderationsaktionen werden serverseitig protokolliert.",
    );
    const list = el("div", "pr-admin-table-list");
    for (const rowData of this.audit) {
      const row = el("div", "pr-admin-table-row");
      const copy = el("div", "pr-admin-table-copy");
      copy.append(
        el("strong", "", rowData.action),
        el(
          "small",
          "",
          `${formatTime(rowData.created_at)} · Ziel: ${rowData.target_user_id ?? "—"} · ${rowData.entity_key ?? ""}`,
        ),
      );
      const payload = el("code", "pr-admin-log-payload", JSON.stringify(rowData.payload));
      row.append(copy, payload);
      list.append(row);
    }
    if (!this.audit.length) list.append(el("small", "", "Noch keine protokollierten Admin-Aktionen."));
    section.append(list);
    container.append(section);
  }

  private render() {
    this.host.replaceChildren();

    if (!this.isAdmin || !this.session) return;

    const trigger = btn("🛡 ADMIN", "pr-admin-trigger");
    trigger.addEventListener("click", () => void this.open());
    this.host.append(trigger);

    if (!this.modalOpen) return;

    const backdrop = el("div", "pr-admin-backdrop");
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) this.close();
    });

    const shell = el("section", "pr-admin-shell");
    shell.setAttribute("role", "dialog");
    shell.setAttribute("aria-modal", "true");
    shell.setAttribute("aria-label", "PokéRegions Admin Panel");

    const header = el("header", "pr-admin-header");
    const title = el("div");
    title.append(
      el("small", "pr-admin-kicker", "POKÉREGIONS CONTROL"),
      el("h2", "", "Admin Panel"),
      el("p", "", "Spieler, Rewards und Live-Content verwalten"),
    );
    const headerActions = el("div", "pr-admin-header-actions");
    const refresh = btn("↻ Neu laden");
    refresh.addEventListener("click", () => {
      void this.runAction(async () => {}, "Admin-Daten aktualisiert.");
    });
    const close = btn("×", "pr-admin-close");
    close.setAttribute("aria-label", "Admin Panel schließen");
    close.addEventListener("click", () => this.close());
    headerActions.append(refresh, close);
    header.append(title, headerActions);

    const body = el("div", "pr-admin-body");
    const nav = el("nav", "pr-admin-nav");
    nav.append(
      this.navButton("overview", "Übersicht"),
      this.navButton("players", "Spieler"),
      this.navButton("catalog", "Katalog"),
      this.navButton("rewards", "Rewards"),
      this.navButton("codes", "Gutscheine"),
      this.navButton("achievements", "Erfolge"),
      this.navButton("events", "Events"),
      this.navButton("live", "Live Content"),
      this.navButton("logs", "Audit Log"),
    );

    const content = el("main", "pr-admin-content");

    if (this.loading) {
      content.append(el("div", "pr-admin-loading", "Admin-Daten werden geladen …"));
    } else {
      if (this.activeTab === "overview") this.renderOverview(content);
      if (this.activeTab === "players") this.renderPlayers(content);
      if (this.activeTab === "catalog") this.renderCatalog(content);
      if (this.activeTab === "rewards") this.renderRewards(content);
      if (this.activeTab === "codes") this.renderCodes(content);
      if (this.activeTab === "achievements") this.renderAchievements(content);
      if (this.activeTab === "events") this.renderEvents(content);
      if (this.activeTab === "live") this.renderLive(content);
      if (this.activeTab === "logs") this.renderLogs(content);
    }

    body.append(nav, content);
    shell.append(header, body);

    if (this.status) {
      const status = el("div", `pr-admin-status is-${this.statusKind}`, this.status);
      shell.append(status);
    }

    backdrop.append(shell);
    this.host.append(backdrop);
  }
}

export const mountAdminUi = async () => {
  if (!cloudConfigured) return;
  const ui = new AdminUi();
  await ui.start();
};
