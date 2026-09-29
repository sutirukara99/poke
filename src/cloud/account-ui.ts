import type { Session } from "@supabase/supabase-js";
import {
  cloudConfigured,
  fetchCloudSave,
  getLocalSaveSummary,
  getSession,
  restoreCloudSave,
  signInWithDiscord,
  signInWithEmail,
  signOut,
  subscribeToAuth,
  uploadLocalSave,
} from "./supabase";

const ensureHost = () => {
  let host = document.getElementById("pokeregions-cloud-root");
  if (!host) {
    host = document.createElement("div");
    host.id = "pokeregions-cloud-root";
    document.body.appendChild(host);
  }
  return host;
};

const escapeText = (value: unknown) => String(value ?? "");

const render = async (host: HTMLElement, session: Session | null, status = "") => {
  if (!cloudConfigured) {
    host.replaceChildren();
    return;
  }

  const local = getLocalSaveSummary();
  let cloudUpdated = "Noch kein Cloud-Save";

  if (session) {
    try {
      const cloud = await fetchCloudSave();
      cloudUpdated = cloud
        ? "Cloud: " + new Date(cloud.updated_at).toLocaleString("de-DE")
        : "Noch kein Cloud-Save";
    } catch {
      cloudUpdated = "Cloud-Status konnte nicht geladen werden";
    }
  }

  host.innerHTML = "";

  const pill = document.createElement("button");
  pill.className = "cloud-account-pill";
  pill.type = "button";
  pill.textContent = session ? "☁ Cloud verbunden" : "☁ Cloud-Save";

  const modal = document.createElement("div");
  modal.className = "cloud-account-backdrop";
  modal.hidden = true;

  const panel = document.createElement("section");
  panel.className = "cloud-account-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", "PokéRegions Cloud Account");

  const close = document.createElement("button");
  close.className = "cloud-account-close";
  close.type = "button";
  close.textContent = "×";

  const kicker = document.createElement("p");
  kicker.className = "eyebrow";
  kicker.textContent = "POKÉREGIONS CLOUD";

  const title = document.createElement("h2");
  title.textContent = session ? "Account verbunden" : "Fortschritt sichern";

  const intro = document.createElement("p");
  intro.textContent = session
    ? `${escapeText(session.user.email ?? session.user.user_metadata?.full_name ?? "Account")} · ${cloudUpdated}`
    : "Optional anmelden, um deinen lokalen Spielstand später geräteübergreifend zu sichern.";

  const localCard = document.createElement("div");
  localCard.className = "cloud-save-summary";
  localCard.innerHTML = `<strong>Lokal</strong><span>${escapeText(local.trainerName)}</span><small>${local.totalRuns} Runs · ${local.wins} Siege · ${local.caught} Arten</small>`;

  const actions = document.createElement("div");
  actions.className = "cloud-account-actions";

  const message = document.createElement("small");
  message.className = "cloud-account-status";
  message.textContent = status;

  if (!session) {
    const discord = document.createElement("button");
    discord.type = "button";
    discord.className = "cloud-discord-login";
    discord.textContent = "Mit Discord anmelden";
    discord.addEventListener("click", async () => {
      discord.disabled = true;
      try {
        await signInWithDiscord();
      } catch (error) {
        await render(host, null, error instanceof Error ? error.message : "Discord-Login fehlgeschlagen.");
      }
    });

    const email = document.createElement("input");
    email.type = "email";
    email.placeholder = "E-Mail für Magic Link";
    email.autocomplete = "email";

    const emailButton = document.createElement("button");
    emailButton.type = "button";
    emailButton.textContent = "Magic Link senden";
    emailButton.addEventListener("click", async () => {
      const value = email.value.trim();
      if (!value) return;
      emailButton.disabled = true;
      try {
        await signInWithEmail(value);
        await render(host, null, "Magic Link wurde verschickt.");
      } catch (error) {
        await render(host, null, error instanceof Error ? error.message : "E-Mail-Login fehlgeschlagen.");
      }
    });

    actions.append(discord, email, emailButton);
  } else {
    const upload = document.createElement("button");
    upload.type = "button";
    upload.className = "primary";
    upload.textContent = "Lokalen Spielstand hochladen";
    upload.disabled = !local.exists;
    upload.addEventListener("click", async () => {
      upload.disabled = true;
      try {
        await uploadLocalSave();
        await render(host, session, "Cloud-Save aktualisiert.");
      } catch (error) {
        await render(host, session, error instanceof Error ? error.message : "Upload fehlgeschlagen.");
      }
    });

    const restore = document.createElement("button");
    restore.type = "button";
    restore.textContent = "Cloud-Spielstand laden";
    restore.addEventListener("click", async () => {
      if (!window.confirm("Cloud-Spielstand laden? Der aktuelle lokale Save wird vorher als Backup gesichert.")) return;
      try {
        await restoreCloudSave();
      } catch (error) {
        await render(host, session, error instanceof Error ? error.message : "Cloud-Save konnte nicht geladen werden.");
      }
    });

    const logout = document.createElement("button");
    logout.type = "button";
    logout.textContent = "Abmelden";
    logout.addEventListener("click", async () => {
      await signOut();
    });

    actions.append(upload, restore, logout);
  }

  panel.append(close, kicker, title, intro, localCard, actions, message);
  modal.append(panel);
  host.append(pill, modal);

  const open = () => {
    modal.hidden = false;
    close.focus();
  };
  const hide = () => {
    modal.hidden = true;
    pill.focus();
  };

  pill.addEventListener("click", open);
  close.addEventListener("click", hide);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) hide();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) hide();
  }, { once: true });
};

export const mountCloudAccountUi = async () => {
  if (!cloudConfigured) return;
  const host = ensureHost();
  await render(host, await getSession());
  subscribeToAuth((session) => void render(host, session));
};
