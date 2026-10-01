import { readFile } from "node:fs/promises";

const js = await readFile(new URL("../public/recovered/v1.0.0-alpha.1-r7.js", import.meta.url), "utf8");
const required = [
  "1.0.0-alpha.1",
  "QalphaAscensionMax",
  "DAILY-",
  "Rogue Codex",
  "Species Mastery",
  "RUN SCORE",
  "bossTelegraph",
  "lootReroll",
  "rescued-return",
  "debt-collector",
  "rocket-cache",
  "shrine-guardian",
  "fisher-jetty",
  "weather-station",
  "hidden-cave",
  "fossil-researcher",
  "lost-trainer",
  "pokemon-nest",
  "traveling-nurse",
  "recentEvents",
  "Meta Points",
  "rogue-die",
  "black-feather",
  "secret-route",
  "QalphaCompletion",
  "QalphaSetLane",
  "QalphaQuestReady",
  "DAILY FAIR",
  "Auftragsprofi",
  "QalphaNodeHelp",
  "60% · FOLGE 10%",
  "QalphaRepairRoute",
  "Wegschutz: Ein blockierter Pfad wurde automatisch freigelegt.",
  "emergencyLeave",
  "Sicher weiterziehen →",
  "Alpha2026",
  "first-wave",
  "achievement-toast-stack",
  "aria-live",
  "PokéRegions Hauptmenü",
  "QalphaCoreAchievementStats",
  "WILLKOMMEN ZU POKÉREGIONS",
  "Vier Regionen. Unzählige Runs.",
];

const missing = required.filter((needle) => !js.includes(needle));
if (missing.length) {
  throw new Error(`Alpha smoke check failed; missing markers: ${missing.join(", ")}`);
}
if (js.length < 700_000) throw new Error(`Alpha bundle unexpectedly small: ${js.length}`);

console.log(`Alpha smoke check passed (${js.length} chars, ${required.length} system markers).`);
const forbidden = [
  "returnQalphaRelic",
  "returnQalphaDamage",
  "returnQalphaIncoming",
  "returnQalphaMoney",
  "returnQalphaXp",
];

const accidentalTokens = forbidden.filter((needle) => js.includes(needle));
if (accidentalTokens.length) {
  throw new Error(`Alpha bundle contains concatenated runtime identifiers: ${accidentalTokens.join(", ")}`);
}

if (!js.includes('const QalphaRelic=(a,i)=>a?.includes?.(i)')) {
  throw new Error("Alpha relic helper missing from generated bundle.");
}

if (!js.includes('classUpgrade:i.run.dailyChallenge?0:')) throw new Error("daily fair class-upgrade patch missing");

if (!js.includes("Score-Rang")) throw new Error("Alpha history score detail missing");

if (!js.includes("DAILY EXPEDITION · RUNARCHIV")) throw new Error("Daily history presentation missing");

if (!js.includes("Meta-Aufträge findest du im Hauptmenü")) throw new Error("legacy run quest retirement missing");

if (!js.includes("QalphaType")) throw new Error("Elite archetype item mechanic missing");

if (!js.includes("optimierte IVs")) throw new Error("Elite archetype flavor missing");

if (!js.includes("★ ELITE · ")) throw new Error("Elite archetype battle label missing");

if (!js.includes('!oe.shiny&&!i.dailyChallenge&&Sy(a)>1')) throw new Error("daily persistent shiny bonus guard missing");

if (!js.includes('W("protect","Schutzschild","normal","status",0,1,4')) throw new Error("protect PP nerf missing");

if (!js.includes('kanto:["rocket-scout","lost-backpack","lost-trainer","traveling-nurse"]')) throw new Error("Kanto event identity weighting missing");
if (!js.includes('hoenn:["berry-bush","fisher-jetty","weather-station","pokemon-nest"]')) throw new Error("Hoenn event identity weighting missing");
if (!js.includes("recentEvents=[...(i.recentEvents??[])")) throw new Error("Mystery anti-repetition history missing");
if (js.includes("Rogue-Punkte")) throw new Error("Legacy player-facing Rogue-Punkte copy remains; use Meta Points.");

if (!js.includes("QalphaRow.length===3")) throw new Error("safe secret generation missing");
if (!js.includes("QalphaRepairRoute(a)")) throw new Error("route advance repair hook missing");


const launchForbidden = [
  "PokéRogue Regions",
  "PokéRogue-Regions",
  "POKÉROGUE REGIONS",
  "/test/regions/",
];

const launchForbiddenHits = launchForbidden.filter((needle) => js.includes(needle));
if (launchForbiddenHits.length) {
  throw new Error(`Launch bundle still contains retired branding/paths: ${launchForbiddenHits.join(", ")}`);
}

if (!js.includes('ALPHA2026:{display:"Alpha2026"')) {
  throw new Error("Alpha2026 gift code missing from launch bundle.");
}
if (!js.includes('achievement:"first-wave"')) {
  throw new Error("First Wave gift achievement hook missing.");
}
if (!js.includes('className:"achievement-toast-stack"')) {
  throw new Error("Stacked achievement notifications missing.");
}
if (!js.includes('onError:d=>{d.currentTarget.style.display="none"}')) {
  throw new Error("Region artwork fallback missing.");
}

if (!js.includes('const QalphaCoreAchievements=()=>cn.filter(i=>!i.special)')) {
  throw new Error("Special achievements are affecting core completion scoring.");
}
if (!js.includes('"aria-pressed":h===N')) {
  throw new Error("Region selection accessibility state missing.");
}
if (!js.includes('"aria-live":"polite"')) {
  throw new Error("Gift-code live feedback missing.");
}

if (!js.includes('unlimitedLevel:a.mode==="endless"')) {
  throw new Error("Endless party did not receive unlimited-level mode.");
}
if (!js.includes('a.mode==="endless"?Infinity:Ve.maxPokemonLevel')) {
  throw new Error("Endless player XP is still capped at Level 100.");
}
if (!js.includes('i.mode==="endless"?Infinity:Ve.maxPokemonLevel')) {
  throw new Error("Endless enemy factory is still capped at Level 100.");
}
if (!js.includes('♾ Endless · Lv.-Cap ∞')) {
  throw new Error("Endless unlimited-level rule is missing from the HUD.");
}
if (js.includes('return Math.min(100,Math.max(5,Math.floor(m*h)+(i==="boss"?4:0)))')) {
  throw new Error("Legacy Endless enemy Level 100 cap is still present.");
}

if (!js.includes('type:"reorderTeam"')) {
  throw new Error("Party reorder action is missing.");
}
if (!js.includes('onReorder:(O,ae)=>r({type:"reorderTeam",from:O,to:ae})')) {
  throw new Error("Party reorder UI is not wired to the reducer.");
}
if (!js.includes('draggable:U&&!b&&!!QalphaReorder')) {
  throw new Error("Drag-and-drop party ordering is missing.");
}
if (!js.includes('führt jetzt dein Team an')) {
  throw new Error("Lead-selection feedback is missing.");
}

if (!js.includes('https://discord.gg/7q4uR7tsrH')) {
  throw new Error("Official Discord invite is missing.");
}
if (!js.includes('className:"discord-community-link"')) {
  throw new Error("Official Discord button is missing.");
}
if (!js.includes('Offizieller Discord')) {
  throw new Error("Official Discord CTA label is missing.");
}
