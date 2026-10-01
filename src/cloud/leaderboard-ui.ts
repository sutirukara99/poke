import { cloudConfigured, supabase } from "./supabase";

type LeaderboardCategory =
  | "seen"
  | "caught"
  | "shiny"
  | "achievements"
  | "endless"
  | "endless_bosses"
  | "wins"
  | "runs"
  | "trainer_level";

type LeaderboardRow = {
  rank: number;
  trainer_name: string;
  score: number;
  updated_at: string;
  is_me: boolean;
  player_count: number;
};

type CategoryDefinition = {
  key: LeaderboardCategory;
  label: string;
  shortLabel: string;
  icon: string;
  unit: string;
};

const categories: CategoryDefinition[] = [
  { key: "endless", label: "Endless · höchste Stufe", shortLabel: "Endless", icon: "♾", unit: "Stufe" },
  { key: "endless_bosses", label: "Endless · Bosse", shortLabel: "Bosse", icon: "♛", unit: "Bosse" },
  { key: "seen", label: "Pokémon gesehen", shortLabel: "Gesehen", icon: "◉", unit: "Arten" },
  { key: "caught", label: "Pokémon gefangen", shortLabel: "Gefangen", icon: "●", unit: "Arten" },
  { key: "shiny", label: "Shinys gefangen", shortLabel: "Shinys", icon: "✦", unit: "Shinys" },
  { key: "wins", label: "Story-Siege", shortLabel: "Siege", icon: "★", unit: "Siege" },
  { key: "runs", label: "Abgeschlossene Runs", shortLabel: "Runs", icon: "↻", unit: "Runs" },
  { key: "trainer_level", label: "Trainer-Level", shortLabel: "Level", icon: "▲", unit: "Level" },
  { key: "achievements", label: "Erfolge", shortLabel: "Erfolge", icon: "☆", unit: "Erfolge" },
];

const ensureHost = () => {
  let host = document.getElementById("pokeregions-leaderboard-root");
  if (!host) {
    host = document.createElement("div");
    host.id = "pokeregions-leaderboard-root";
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

const button = (label: string, className = "") => {
  const node = el("button", className, label);
  node.type = "button";
  return node;
};

const currentCategory = (key: LeaderboardCategory) =>
  categories.find((category) => category.key === key) ?? categories[0];

const fetchLeaderboard = async (
  category: LeaderboardCategory,
  limit = 25,
): Promise<LeaderboardRow[]> => {
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("get_leaderboard", {
    p_category: category,
    p_limit: limit,
  });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    rank: Number(row.rank ?? 0),
    trainer_name: String(row.trainer_name ?? "Trainer"),
    score: Number(row.score ?? 0),
    updated_at: String(row.updated_at ?? ""),
    is_me: Boolean(row.is_me),
    player_count: Number(row.player_count ?? 0),
  }));
};

class LeaderboardUi {
  private readonly host = ensureHost();
  private open = false;
  private loading = false;
  private category: LeaderboardCategory = "endless";
  private rows: LeaderboardRow[] = [];
  private error = "";
  private lastRefresh: Date | null = null;
  private refreshTimer: number | undefined;
  private enabled = false;

  async start() {
    if (!cloudConfigured || !supabase) return;

    try {
      const { data } = await supabase
        .from("feature_flags")
        .select("enabled")
        .eq("flag_key", "live_leaderboard")
        .maybeSingle();

      this.enabled = Boolean(data?.enabled);
    } catch {
      this.enabled = false;
    }

    if (!this.enabled) return;
    this.render();
  }

  private startRefreshTimer() {
    this.stopRefreshTimer();
    this.refreshTimer = window.setInterval(() => {
      if (this.open && !document.hidden) void this.load(false);
    }, 10_000);
  }

  private stopRefreshTimer() {
    if (this.refreshTimer !== undefined) {
      window.clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  private async load(showSpinner = true) {
    if (this.loading) return;
    this.loading = true;
    if (showSpinner) this.render();

    try {
      this.rows = await fetchLeaderboard(this.category, 25);
      this.error = "";
      this.lastRefresh = new Date();
    } catch (error) {
      this.error =
        error instanceof Error
          ? error.message
          : "Leaderboard konnte nicht geladen werden.";
    } finally {
      this.loading = false;
      this.render();
    }
  }

  private async openPanel() {
    this.open = true;
    this.error = "";
    this.render();
    this.startRefreshTimer();
    await this.load(true);
  }

  private closePanel() {
    this.open = false;
    this.stopRefreshTimer();
    this.render();
  }

  private async switchCategory(category: LeaderboardCategory) {
    if (category === this.category) return;
    this.category = category;
    this.rows = [];
    this.error = "";
    this.render();
    await this.load(true);
  }

  private medal(rank: number) {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return String(rank);
  }

  private scoreText(score: number) {
    const definition = currentCategory(this.category);
    return `${score.toLocaleString("de-DE")} ${definition.unit}`;
  }

  private render() {
    this.host.replaceChildren();

    if (!this.enabled) return;

    const trigger = button("🏆 LIVE RANKING", "pr-leaderboard-trigger");
    trigger.setAttribute("aria-label", "PokéRegions Live-Rangliste öffnen");
    trigger.addEventListener("click", () => void this.openPanel());
    this.host.append(trigger);

    if (!this.open) return;

    const backdrop = el("div", "pr-leaderboard-backdrop");
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) this.closePanel();
    });

    const panel = el("section", "pr-leaderboard-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "PokéRegions Live Leaderboard");

    const header = el("header", "pr-leaderboard-header");
    const heading = el("div", "pr-leaderboard-heading");
    heading.append(
      el("small", "pr-leaderboard-live", "● LIVE"),
      el("h2", "", "Trainer-Rangliste"),
      el(
        "p",
        "",
        "Wird automatisch aus synchronisierten Cloud-Spielständen aktualisiert.",
      ),
    );

    const headerActions = el("div", "pr-leaderboard-header-actions");
    const refresh = button("↻", "pr-leaderboard-refresh");
    refresh.setAttribute("aria-label", "Leaderboard aktualisieren");
    refresh.disabled = this.loading;
    refresh.addEventListener("click", () => void this.load(false));

    const close = button("×", "pr-leaderboard-close");
    close.setAttribute("aria-label", "Leaderboard schließen");
    close.addEventListener("click", () => this.closePanel());
    headerActions.append(refresh, close);
    header.append(heading, headerActions);

    const tabs = el("nav", "pr-leaderboard-tabs");
    tabs.setAttribute("aria-label", "Leaderboard Kategorien");
    for (const definition of categories) {
      const tab = button(
        `${definition.icon} ${definition.shortLabel}`,
        "pr-leaderboard-tab",
      );
      if (definition.key === this.category) {
        tab.classList.add("is-active");
        tab.setAttribute("aria-current", "true");
      }
      tab.addEventListener("click", () => void this.switchCategory(definition.key));
      tabs.append(tab);
    }

    const active = currentCategory(this.category);
    const meta = el("div", "pr-leaderboard-meta");
    const metaCopy = el("div");
    metaCopy.append(
      el("strong", "", active.label),
      el(
        "small",
        "",
        this.rows.length
          ? `${this.rows[0].player_count.toLocaleString("de-DE")} Spieler im Ranking`
          : "Top 25",
      ),
    );

    const updated = el(
      "small",
      "pr-leaderboard-updated",
      this.lastRefresh
        ? `Aktualisiert ${this.lastRefresh.toLocaleTimeString("de-DE", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}`
        : "Live-Update alle 10 Sekunden",
    );
    meta.append(metaCopy, updated);

    const content = el("div", "pr-leaderboard-content");

    if (this.loading && !this.rows.length) {
      content.append(el("div", "pr-leaderboard-loading", "Rangliste wird geladen …"));
    } else if (this.error) {
      const error = el("div", "pr-leaderboard-error");
      error.append(
        el("strong", "", "Leaderboard nicht verfügbar"),
        el("small", "", this.error),
      );
      content.append(error);
    } else if (!this.rows.length) {
      content.append(
        el(
          "div",
          "pr-leaderboard-empty",
          "Noch keine synchronisierten Spielstände in dieser Rangliste.",
        ),
      );
    } else {
      const list = el("div", "pr-leaderboard-list");

      for (const row of this.rows) {
        const entry = el("article", "pr-leaderboard-row");
        if (row.rank <= 3) entry.classList.add(`rank-${row.rank}`);
        if (row.is_me) entry.classList.add("is-me");

        const rank = el("span", "pr-leaderboard-rank", this.medal(row.rank));
        const trainer = el("div", "pr-leaderboard-trainer");
        trainer.append(
          el("strong", "", row.trainer_name),
          el(
            "small",
            "",
            row.is_me
              ? "DU · synchronisiert"
              : `Sync ${new Date(row.updated_at).toLocaleDateString("de-DE")}`,
          ),
        );
        const score = el("strong", "pr-leaderboard-score", this.scoreText(row.score));
        entry.append(rank, trainer, score);
        list.append(entry);
      }

      content.append(list);
    }

    const footer = el("footer", "pr-leaderboard-footer");
    footer.append(
      el(
        "small",
        "",
        "Ranking basiert auf Cloud-Saves. Neue Fortschritte erscheinen nach der nächsten Synchronisierung.",
      ),
    );

    panel.append(header, tabs, meta, content, footer);
    backdrop.append(panel);
    this.host.append(backdrop);
  }
}

export const mountLeaderboardUi = async () => {
  if (!cloudConfigured) return;
  const ui = new LeaderboardUi();
  await ui.start();
};
