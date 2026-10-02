import { readFile } from "node:fs/promises";

const js = await readFile(new URL("../public/recovered/v1.0.0-alpha.1-r7.js", import.meta.url), "utf8");
const gameplayCss = await readFile(new URL("../src/styles/gameplay-overhaul.css", import.meta.url), "utf8");
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
  "abandoned-center",
  "route-photographer",
  "apricorn-craftsman",
  "bell-tower-echo",
  "storm-wreckage",
  "secret-base",
  "coronet-crystal",
  "snow-rescue",
  "recentEvents",
  "Meta Points",
  "rogue-die",
  "black-feather",
  "QjourneyState",
  "free-roam-overworld",
  "overworldMove",
  "overworldInteract",
  "overworldTrigger",
  "QowBuild",
  "QowEnsure",
  "worldDiscoveries",
  "WASD zum Laufen",
  "E zum Interagieren",
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

if (gameplayCss.includes('background-image:url("/ui/overworld/frlg/general-tiles.png")')) {
  throw new Error("Raw FireRed decomp tile sheet is still being used as a CSS atlas.");
}
if (!gameplayCss.includes(".canvas-overworld .ow-canvas")) throw new Error("Canvas overworld styling is missing.");
if (!gameplayCss.includes(".canvas-overworld .ow-debug")) throw new Error("Overworld debug styling is missing.");
if (!gameplayCss.includes(".ow-floor-meta")) throw new Error("Roguelike floor HUD styling is missing.");
if (!gameplayCss.includes(".alpha-shell:has(.free-roam-overworld)>.pr-game-chrome")) {
  throw new Error("Legacy website chrome is not hidden during free-roam.");
}


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

if (!js.includes('kanto:["trainer","trainer","trainer","city","shop"]')) throw new Error("Kanto route-node identity weighting missing");
if (!js.includes('johto:["mystery","mystery","mystery","heal","wild"]')) throw new Error("Johto route-node identity weighting missing");
if (!js.includes('hoenn:["wild","wild","wild","mystery","item"]')) throw new Error("Hoenn route-node identity weighting missing");
if (!js.includes('sinnoh:["trainer","trainer","mystery","mystery","item"]')) throw new Error("Sinnoh route-node identity weighting missing");
if (!js.includes('scavenger:["item","item"]')) throw new Error("Trainer class route identity missing");
if (!js.includes('scientist:["item","tutor"]')) throw new Error("Researcher route identity missing");
if (!js.includes('breeder:["wild","heal"]')) throw new Error("Breeder route identity missing");
if (!js.includes('a.route=ph(yh(a.seed,a.region,a.mapIndex),a.region,a.mapIndex,a.trainerClass)')) throw new Error("Story class identity is not persisted between maps");
if (!js.includes('a.route=gh(bh(a.seed,a.endlessMap),a.region,a.endlessMap,a.trainerClass)')) throw new Error("Endless class identity is not persisted between maps");
if (!js.includes('p.types.length&&p.types.some(b=>Ls[h]?.types.includes(b))')) throw new Error("Biome trainer archetype weighting missing");
if (!js.includes("mehr Wild- und Fundpfade")) throw new Error("Player-facing class route identity copy missing");

if (!js.includes('kanto:["rocket-scout","lost-backpack","lost-trainer","traveling-nurse","abandoned-center","route-photographer"]')) throw new Error("Kanto event identity weighting missing");
if (!js.includes('hoenn:["berry-bush","fisher-jetty","weather-station","pokemon-nest","storm-wreckage","secret-base"]')) throw new Error("Hoenn event identity weighting missing");
if (!js.includes("recentEvents=[...(i.recentEvents??[])")) throw new Error("Mystery anti-repetition history missing");
if (!js.includes('johto:["old-shrine","fortune-teller","ancient-map","strange-egg","apricorn-craftsman","bell-tower-echo"]')) throw new Error("Johto expanded event identity weighting missing");
if (!js.includes('sinnoh:["hidden-cave","fossil-researcher","ancient-map","shady-deal","coronet-crystal","snow-rescue"]')) throw new Error("Sinnoh expanded event identity weighting missing");
if (!js.includes('QalphaPolishEvent==="snow-rescue"')) throw new Error("New regional event outcomes missing");
if (!js.includes('QalphaSetBallsOpen(!0)')) throw new Error("B shortcut does not open the ball chooser");
if (!js.includes("B Ball-Menü")) throw new Error("Battle shortcut copy is stale");
if (js.includes("Rogue-Punkte")) throw new Error("Legacy player-facing Rogue-Punkte copy remains; use Meta Points.");

if (!js.includes("QalphaRow.length===3")) throw new Error("safe secret generation missing");
if (!js.includes("QalphaRepairRoute(a)")) throw new Error("route advance repair hook missing");

if (!js.includes('journey:QjourneyState()')) throw new Error("Journey state is missing from new runs.");
if (!js.includes('type:"overworldMove"')) throw new Error("Free-roam movement action is missing.");
if (!js.includes('type:"overworldInteract"')) throw new Error("Free-roam interaction action is missing.");
if (!js.includes('type:"overworldTrigger"')) throw new Error("Free-roam encounter trigger is missing.");
if (!js.includes('QjourneyDiscoveryPools')) throw new Error("Regional Journey discoveries are missing.");
if (!js.includes('d.worldDiscoveries??=[]')) throw new Error("Persistent world discovery migration is missing.");
if (!js.includes('QjourneyFindDiscovery(r.region,d.worldDiscoveries??[],u)')) throw new Error("Overworld discoveries are not checked against account-wide finds.");
if (!js.includes('free-roam-overworld')) throw new Error("Free-roam overworld presentation is missing.");
if (!js.includes('const QowTileSize=16,QowW=45,QowH=31')) throw new Error("Canvas overworld dimensions are missing.");
if (!js.includes('const QowVisible=')) throw new Error("Fog-of-war visibility helper is missing.");
if (!js.includes('const QowValidate=')) throw new Error("Generator validation is missing.");
if (!js.includes('const QowBuildAttempt=')) throw new Error("Procedural room generator is missing.");
if (!js.includes('const QowCanvas=')) throw new Error("Canvas renderer host is missing.");
if (!js.includes('const QowTilesetCatalog=')) throw new Error("Semantic overworld tileset catalog is missing.");
if (!js.includes('metatilesB64:')) throw new Error("FRLG metatile source data is missing.");
if (!js.includes('const QowEnsureFrlgAtlas=')) throw new Error("FRLG metatile reconstruction pipeline is missing.");
if (!js.includes('const QowCityCanvas=')) throw new Error("Walkable city Canvas is missing.");
if (!js.includes('className:"ow-city-hub scene-"+scene')) throw new Error("Walkable city hub is missing.");
if (!js.includes('QowCenterStatic')) throw new Error("Walkable Pokémon Center interior is missing.");
if (!js.includes('className:"ow-canvas"')) throw new Error("Canvas overworld surface is missing.");
if (!js.includes('className:"ow-floor-meta"')) throw new Error("Roguelike floor prompt is missing.");
if (!js.includes('className:"ow-debug"')) throw new Error("F2 debug overlay is missing.");
if (!js.includes('encounterOnly')) throw new Error("Return-to-overworld encounter state is missing.");
if (!js.includes('/ui/overworld/frlg/red-normal.png')) throw new Error("Local FRLG player sprite integration is missing.");
if (js.includes('className:"ow-map"')) throw new Error("Legacy DOM tile-map renderer still exists.");
if (js.includes('className:`route-map mini-map pixel-map-crawler')) throw new Error("Legacy visible node-map renderer still exists.");
if (js.includes("Knoten")) throw new Error("Player-facing node terminology remains in Journey build.");


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

if (!js.includes('Qdirs={w:"up",arrowup:"up",s:"down",arrowdown:"down",a:"left",arrowleft:"left",d:"right",arrowright:"right"}')) throw new Error("WASD/arrow held-key overworld controls are missing.");
if (!js.includes('document.querySelector(".free-roam-overworld")')) throw new Error("Legacy route hotkeys are not disabled during free-roam.");

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
