import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import {
  cloudConfigured,
  getLocalSaveSummary,
  getSession,
  sendPasswordReset,
  signInWithDiscord,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  subscribeToAuth,
  updatePassword,
} from "./supabase";
import { CloudSyncController, type CloudSyncState } from "./sync";

type Screen = "login" | "register" | "forgot" | "recovery" | "account";

const ensureHost = () => {
  let host = document.getElementById("pokeregions-cloud-root");
  if (!host) {
    host = document.createElement("div");
    host.id = "pokeregions-cloud-root";
    document.body.appendChild(host);
  }
  return host;
};

const button = (label: string, className = "") => {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  if (className) element.className = className;
  return element;
};

const input = (
  type: string,
  placeholder: string,
  autocomplete: string,
) => {
  const element = document.createElement("input");
  element.type = type;
  element.placeholder = placeholder;
  element.autocomplete = autocomplete;
  return element;
};

class AccountUi {
  private readonly host = ensureHost();
  private session: Session | null = null;
  private screen: Screen = "login";
  private status = "";
  private syncState: CloudSyncState = { kind: "idle", text: "Nicht synchronisiert" };
  private syncController: CloudSyncController | null = null;
  private modalOpen = false;
  private escapeHandler: ((event: KeyboardEvent) => void) | null = null;

  async start() {
    this.session = await getSession();
    this.screen = this.session ? "account" : "login";
    this.render();
    if (this.session) await this.startSync(this.session);

    subscribeToAuth((event, session) => {
      window.setTimeout(() => void this.handleAuthChange(event, session), 0);
    });
  }

  private async handleAuthChange(event: AuthChangeEvent, session: Session | null) {
    this.session = session;

    if (event === "PASSWORD_RECOVERY") {
      this.screen = "recovery";
      this.modalOpen = true;
      this.render();
      return;
    }

    if (!session) {
      this.syncController?.stop();
      this.syncController = null;
      this.syncState = { kind: "idle", text: "Nicht synchronisiert" };
      this.screen = "login";
      this.render();
      return;
    }

    this.screen = "account";
    this.status = event === "SIGNED_IN" ? "Erfolgreich angemeldet." : this.status;
    this.render();
    await this.startSync(session);
  }

  private async startSync(session: Session) {
    this.syncController?.stop();
    this.syncController = new CloudSyncController(session, (state) => {
      this.syncState = state;
      this.render();
    });
    await this.syncController.start();
  }

  private accountName() {
    if (!this.session) return "Account";
    const metadata = this.session.user.user_metadata ?? {};
    return String(
      metadata.trainer_name
      ?? metadata.full_name
      ?? metadata.global_name
      ?? this.session.user.email
      ?? "Trainer",
    );
  }

  private setStatus(message: string) {
    this.status = message;
    this.render();
  }

  private open(screen: Screen = this.session ? "account" : "login") {
    this.screen = screen;
    this.modalOpen = true;
    this.status = "";
    this.render();
  }

  private close() {
    this.modalOpen = false;
    this.status = "";
    if (this.escapeHandler) {
      window.removeEventListener("keydown", this.escapeHandler);
      this.escapeHandler = null;
    }
    this.render();
  }

  private renderAuthHeader(panel: HTMLElement, titleText: string, copyText: string) {
    const kicker = document.createElement("p");
    kicker.className = "eyebrow";
    kicker.textContent = "POKÉREGIONS ACCOUNT";

    const title = document.createElement("h2");
    title.textContent = titleText;

    const copy = document.createElement("p");
    copy.className = "cloud-account-intro";
    copy.textContent = copyText;

    panel.append(kicker, title, copy);
  }

  private renderLogin(panel: HTMLElement) {
    this.renderAuthHeader(
      panel,
      "Willkommen zurück",
      "Melde dich an und dein PokéRegions-Fortschritt wird auf diesem Gerät automatisch geladen.",
    );

    const form = document.createElement("form");
    form.className = "cloud-auth-form";

    const email = input("email", "E-Mail", "email");
    email.required = true;
    const password = input("password", "Passwort", "current-password");
    password.required = true;

    const login = button("Einloggen", "primary");
    login.type = "submit";

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      login.disabled = true;
      try {
        await signInWithPassword(email.value.trim(), password.value);
      } catch (error) {
        login.disabled = false;
        this.setStatus(error instanceof Error ? error.message : "Login fehlgeschlagen.");
      }
    });

    form.append(email, password, login);

    const discord = button("Mit Discord fortfahren", "cloud-discord-login");
    discord.addEventListener("click", async () => {
      discord.disabled = true;
      try {
        await signInWithDiscord();
      } catch (error) {
        discord.disabled = false;
        this.setStatus(error instanceof Error ? error.message : "Discord-Login fehlgeschlagen.");
      }
    });

    const links = document.createElement("div");
    links.className = "cloud-auth-links";

    const register = button("Noch keinen Account? Registrieren");
    register.addEventListener("click", () => this.open("register"));

    const forgot = button("Passwort vergessen?");
    forgot.addEventListener("click", () => this.open("forgot"));

    links.append(register, forgot);
    panel.append(form, this.divider(), discord, links);
  }

  private renderRegister(panel: HTMLElement) {
    this.renderAuthHeader(
      panel,
      "Account erstellen",
      "Dein Account verbindet Fortschritt, Cloud-Save und später Ranglisten auf allen Geräten.",
    );

    const form = document.createElement("form");
    form.className = "cloud-auth-form";

    const trainer = input("text", "Trainername", "nickname");
    trainer.maxLength = 32;
    trainer.required = true;

    const email = input("email", "E-Mail", "email");
    email.required = true;

    const password = input("password", "Passwort · mindestens 8 Zeichen", "new-password");
    password.minLength = 8;
    password.required = true;

    const confirm = input("password", "Passwort wiederholen", "new-password");
    confirm.minLength = 8;
    confirm.required = true;

    const submit = button("Account erstellen", "primary");
    submit.type = "submit";

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (password.value !== confirm.value) {
        this.setStatus("Die Passwörter stimmen nicht überein.");
        return;
      }
      submit.disabled = true;
      try {
        const result = await signUpWithPassword(
          trainer.value.trim(),
          email.value.trim(),
          password.value,
        );
        if (!result.session) {
          this.screen = "login";
          this.status = "Account erstellt. Bitte bestätige jetzt deine E-Mail und logge dich danach ein.";
          this.render();
        }
      } catch (error) {
        submit.disabled = false;
        this.setStatus(error instanceof Error ? error.message : "Registrierung fehlgeschlagen.");
      }
    });

    form.append(trainer, email, password, confirm, submit);

    const back = button("← Zurück zum Login");
    back.addEventListener("click", () => this.open("login"));

    panel.append(form, back);
  }

  private renderForgot(panel: HTMLElement) {
    this.renderAuthHeader(
      panel,
      "Passwort zurücksetzen",
      "Wir schicken dir einen sicheren Link. Danach kannst du direkt ein neues Passwort setzen.",
    );

    const form = document.createElement("form");
    form.className = "cloud-auth-form";

    const email = input("email", "E-Mail", "email");
    email.required = true;

    const submit = button("Reset-Link senden", "primary");
    submit.type = "submit";

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      submit.disabled = true;
      try {
        await sendPasswordReset(email.value.trim());
        this.screen = "login";
        this.status = "Reset-Link wurde verschickt. Schau in dein E-Mail-Postfach.";
        this.render();
      } catch (error) {
        submit.disabled = false;
        this.setStatus(error instanceof Error ? error.message : "Reset-Link konnte nicht gesendet werden.");
      }
    });

    form.append(email, submit);

    const back = button("← Zurück zum Login");
    back.addEventListener("click", () => this.open("login"));

    panel.append(form, back);
  }

  private renderRecovery(panel: HTMLElement) {
    this.renderAuthHeader(
      panel,
      "Neues Passwort",
      "Lege jetzt ein neues Passwort für deinen PokéRegions-Account fest.",
    );

    const form = document.createElement("form");
    form.className = "cloud-auth-form";

    const password = input("password", "Neues Passwort", "new-password");
    password.minLength = 8;
    password.required = true;

    const confirm = input("password", "Passwort wiederholen", "new-password");
    confirm.minLength = 8;
    confirm.required = true;

    const submit = button("Passwort speichern", "primary");
    submit.type = "submit";

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (password.value !== confirm.value) {
        this.setStatus("Die Passwörter stimmen nicht überein.");
        return;
      }
      submit.disabled = true;
      try {
        await updatePassword(password.value);
        this.screen = "account";
        this.status = "Passwort wurde aktualisiert.";
        this.render();
      } catch (error) {
        submit.disabled = false;
        this.setStatus(error instanceof Error ? error.message : "Passwort konnte nicht geändert werden.");
      }
    });

    form.append(password, confirm, submit);
    panel.append(form);
  }

  private renderAccount(panel: HTMLElement) {
    const local = getLocalSaveSummary();

    this.renderAuthHeader(
      panel,
      this.accountName(),
      "Dein Account ist angemeldet. Änderungen am Spielstand werden automatisch mit der Cloud synchronisiert.",
    );

    const badges = document.createElement("div");
    badges.className = "cloud-account-badges";

    const accountBadge = document.createElement("span");
    accountBadge.textContent = "● ACCOUNT VERBUNDEN";

    const syncBadge = document.createElement("span");
    syncBadge.className = "sync-" + this.syncState.kind;
    syncBadge.textContent = this.syncState.kind === "synced" ? "☁ SYNCHRONISIERT" : "☁ " + this.syncState.kind.toUpperCase();

    badges.append(accountBadge, syncBadge);

    const localCard = document.createElement("div");
    localCard.className = "cloud-save-summary";

    const label = document.createElement("strong");
    label.textContent = "SPIELSTAND";
    const trainer = document.createElement("span");
    trainer.textContent = local.meaningful ? local.trainerName : "Noch kein lokales Profil";
    const meta = document.createElement("small");
    meta.textContent = local.meaningful
      ? `${local.totalRuns} Runs · ${local.wins} Siege · ${local.caught} Arten`
      : "Beim Spielen wird dein Fortschritt automatisch gespeichert.";

    localCard.append(label, trainer, meta);

    const syncCopy = document.createElement("p");
    syncCopy.className = "cloud-sync-copy";
    syncCopy.textContent = this.syncState.text;

    panel.append(badges, localCard, syncCopy);

    if (this.syncState.kind === "conflict") {
      const warning = document.createElement("div");
      warning.className = "cloud-conflict";
      const title = document.createElement("strong");
      title.textContent = "Zwei unterschiedliche Spielstände gefunden";
      const copy = document.createElement("small");
      copy.textContent = "Wähle, welcher Spielstand behalten werden soll. Nichts wird still überschrieben.";

      const choices = document.createElement("div");
      choices.className = "cloud-conflict-actions";

      const keepLocal = button("Diesen Geräte-Save behalten", "primary");
      keepLocal.addEventListener("click", async () => {
        keepLocal.disabled = true;
        try {
          await this.syncController?.resolveConflict("local");
        } catch (error) {
          this.setStatus(error instanceof Error ? error.message : "Konflikt konnte nicht gelöst werden.");
        }
      });

      const useCloud = button("Cloud-Save verwenden");
      useCloud.addEventListener("click", async () => {
        useCloud.disabled = true;
        try {
          await this.syncController?.resolveConflict("cloud");
        } catch (error) {
          this.setStatus(error instanceof Error ? error.message : "Cloud-Save konnte nicht geladen werden.");
        }
      });

      choices.append(keepLocal, useCloud);
      warning.append(title, copy, choices);
      panel.append(warning);
    } else {
      const syncNow = button("Jetzt synchronisieren");
      syncNow.addEventListener("click", async () => {
        syncNow.disabled = true;
        await this.syncController?.syncOnce(false);
        syncNow.disabled = false;
      });
      panel.append(syncNow);
    }

    const logout = button("Abmelden");
    logout.className = "cloud-logout";
    logout.addEventListener("click", async () => {
      this.syncController?.stop();
      await signOut();
    });
    panel.append(logout);
  }

  private divider() {
    const divider = document.createElement("div");
    divider.className = "cloud-auth-divider";
    divider.innerHTML = "<span>oder</span>";
    return divider;
  }

  private render() {
    if (this.escapeHandler) {
      window.removeEventListener("keydown", this.escapeHandler);
      this.escapeHandler = null;
    }

    if (!cloudConfigured) {
      this.host.replaceChildren();
      return;
    }

    this.host.replaceChildren();

    const pill = button(
      this.session ? "☁ " + this.accountName() : "👤 Login",
      "cloud-account-pill",
    );
    pill.setAttribute("aria-label", this.session ? "PokéRegions Account öffnen" : "Bei PokéRegions anmelden");
    pill.addEventListener("click", () => this.open());

    if (this.session && this.syncState.kind === "synced") {
      pill.classList.add("is-synced");
    }
    if (this.syncState.kind === "conflict" || this.syncState.kind === "error") {
      pill.classList.add("needs-attention");
    }

    this.host.append(pill);

    if (!this.modalOpen) return;

    const backdrop = document.createElement("div");
    backdrop.className = "cloud-account-backdrop";

    const panel = document.createElement("section");
    panel.className = "cloud-account-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "PokéRegions Account");

    const close = button("×", "cloud-account-close");
    close.setAttribute("aria-label", "Account-Fenster schließen");
    close.addEventListener("click", () => this.close());

    panel.append(close);

    if (this.screen === "login") this.renderLogin(panel);
    if (this.screen === "register") this.renderRegister(panel);
    if (this.screen === "forgot") this.renderForgot(panel);
    if (this.screen === "recovery") this.renderRecovery(panel);
    if (this.screen === "account") this.renderAccount(panel);

    if (this.status) {
      const status = document.createElement("small");
      status.className = "cloud-account-status";
      status.setAttribute("role", "status");
      status.textContent = this.status;
      panel.append(status);
    }

    const guest = document.createElement("small");
    guest.className = "cloud-guest-note";
    guest.textContent = this.session
      ? "Cloud-Sync läuft automatisch, solange du angemeldet bist."
      : "Kein Account-Zwang: Du kannst PokéRegions weiterhin als Gast spielen.";
    panel.append(guest);

    backdrop.append(panel);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) this.close();
    });

    this.escapeHandler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      this.close();
    };
    window.addEventListener("keydown", this.escapeHandler);

    this.host.append(backdrop);
    window.setTimeout(() => {
      (panel.querySelector("input, button:not(.cloud-account-close)") as HTMLElement | null)?.focus();
    }, 0);
  }
}

export const mountCloudAccountUi = async () => {
  if (!cloudConfigured) return;
  const ui = new AccountUi();
  await ui.start();
};
