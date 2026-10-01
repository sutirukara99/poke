export type UiSoundCue = "confirm" | "cancel" | "select" | "open" | "danger";
export type BattleSoundCue =
  | "hit"
  | "critical"
  | "miss"
  | "status"
  | "ko"
  | "switch";
export type RewardSoundCue = "common" | "rare" | "legendary" | "shiny";
export type SystemSoundCue = "achievement" | "error" | "sync";

export type GameSoundDetail =
  | { channel: "ui"; cue: UiSoundCue }
  | { channel: "battle"; cue: BattleSoundCue }
  | { channel: "reward"; cue: RewardSoundCue }
  | { channel: "system"; cue: SystemSoundCue };

const emitGameSound = (detail: GameSoundDetail) => {
  window.dispatchEvent(
    new CustomEvent<GameSoundDetail>("pokeregions:sound", { detail }),
  );
};

export const playUiSound = (cue: UiSoundCue) =>
  emitGameSound({ channel: "ui", cue });

export const playBattleSound = (cue: BattleSoundCue) =>
  emitGameSound({ channel: "battle", cue });

export const playRewardSound = (cue: RewardSoundCue) =>
  emitGameSound({ channel: "reward", cue });

export const playSystemSound = (cue: SystemSoundCue) =>
  emitGameSound({ channel: "system", cue });

const getButtonCue = (button: HTMLButtonElement): UiSoundCue => {
  const label = (button.textContent ?? "").toUpperCase();
  if (/ZURÜCK|SCHLIESSEN|ABBRECHEN|NEIN/.test(label)) return "cancel";
  if (button.dataset.prAction === "danger") return "danger";
  if (button.dataset.prAction === "primary") return "confirm";
  if (/DETAIL|INFO|FILTER|SORT|OPTION|INVENTAR|POKÉDEX/.test(label)) return "open";
  return "select";
};

export const mountGameSoundHooks = () => {
  const root = document.getElementById("root");
  if (!root) return;

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const button = target.closest<HTMLButtonElement>("button");
    if (!button || button.disabled) return;

    playUiSound(getButtonCue(button));
  });
};
