# Changelog

## 1.0.0-alpha.1 The Journey — 2026-10-01

### Neues Reiseprinzip
- Das sichtbare Node-/Map-System wurde durch **The Journey** ersetzt. Spieler sehen nicht mehr den gesamten Encounter-Graphen, sondern nur den aktuellen Ort und die Wege, die unmittelbar vor ihnen liegen.
- Wege werden über Landschaft, Richtung und natürliche Hinweise beschrieben. Technische Kategorien wie Wild-, Trainer-, Shop- oder Event-Node bleiben im Hintergrund und werden nicht mehr als Routenstruktur offengelegt.
- Bestehende Kampf-, Fang-, Shop-, Stadt-, Tutor-, Mystery- und Boss-Systeme bleiben als Content-Engine erhalten, werden aber durch die neue Reise ausgelöst.

### Reiseaktionen
- Jeder neue Gebietsabschnitt startet mit 6 Reiseenergie. Normales Weiterreisen kostet keine Energie und kann deshalb niemals einen Run blockieren.
- **Umgebung lesen** kostet 1 Energie und macht aus vagen Landschaftshinweisen konkrete Spuren wie Stimmen, Bewegung im Gras, Rauch oder entfernte Lichter.
- **Abseits suchen** kostet 1 Energie und kann Geld, Vorräte oder regionale Entdeckungen aufdecken.
- **Kurzes Lager** kostet 2 Energie und regeneriert einen Teil der Team-KP; pro Gebiet kann nur einmal gelagert werden.
- Nach abgeschlossenen Reisebegegnungen regeneriert sich 1 Energie. PokéCenter füllen die Reiseenergie vollständig auf.

### Entdeckungen & Regionen
- Kanto, Johto, Hoenn und Sinnoh besitzen eigene versteckte Entdeckungen mit regionalem Flavor und kleinen Belohnungen.
- Einzigartige Funde werden sowohl im aktuellen Run als auch accountweit als **Welt-Entdeckungen** gespeichert.
- Die Trainerkarte zeigt den accountweiten Entdeckungsfortschritt als neuen Prestige-Wert.
- Landschaft, Farbwelt und Wegdarstellung reagieren auf Region und Biom statt auf generische Node-Farben.

### Wartungsmodus
- Die Wartungsseite wurde für den Umbau wieder aktiviert und bleibt nach dem Deploy absichtlich aktiv.
- Der bestehende Admin-Bypass bleibt verfügbar, damit der neue Reise-Loop vor der öffentlichen Freigabe getestet werden kann.


## 1.0.0-alpha.1 Adventure Atlas route redesign — 2026-10-01

### Route / node system
- Replaced the previous Expedition Board presentation with a new **Adventure Atlas** world-map view.
- Removed the permanent route sidebars, risk legend and rectangular node-card layout.
- Nodes are now circular waypoints embedded directly into the region map, with current choices enlarged as destinations, completed choices reduced to trail markers and unrevealed nodes shown as fogged map pins.
- Gym, Rival, League and Legendary endpoints use landmark-style waypoint shapes so bosses read as destinations instead of ordinary cards.
- Existing route connection logic remains intact, but SVG paths are visually integrated into the atlas as travel trails.

### World & HUD
- Added region-specific atlas landscapes for Kanto, Johto, Hoenn and Sinnoh plus biome tinting for forest, cave, coast/sea, snow and volcano routes.
- Replaced duplicated route panels with one compact expedition HUD for route progress, money, balls, healing, badges/endless stage, relics and the current party.
- Team management now opens from the atlas HUD instead of occupying permanent route space.
- Arena routes and Endless routes receive their own route-mode labels.

### Performance / responsive
- Kept the atlas static: no continuous path animation, blur pass or sprite filters.
- Atlas-owned DOM updates are excluded from the polish observer to avoid self-triggered rerenders.
- Added dedicated tablet/mobile waypoint sizing, including compact boss landmarks and readable three-choice rows.


## 1.0.0-alpha.1 final friendly polish — 2026-10-01

### Launcher / active run
- Rebuilt **Run fortsetzen** as the main Adventure Save entry instead of a third generic launcher tile.
- The active run now shows region, mode, current route state, visual progress and up to three real party sprites.
- **Neuer Run** and **Sammlung & Fortschritt** are deliberately smaller secondary actions so the home remains minimal.

### Zwischenstopp
- Reduced the city stop to four clear actions: PokéCenter, Vorräte, Team verwalten and Move-Tutor.
- Added one compact summary row for money, balls, healing items and active relics.
- The Move-Tutor workbench stays hidden until explicitly opened, removing the previous wall of controls.

### Final presentation
- Softened route-board surfaces, node cards, team cards, shop/inventory cards and battle controls without changing the dark PokéRegions identity.
- Kept responsive/mobile fallbacks and reduced the heavy border/dashboard feeling.
- Maintenance gating was removed only after the UI branch passed CI.

## 1.0.0-alpha.1 route board pass — 2026-10-01

### Expedition board
- Reworked the route screen around a centered game-board layout inspired by classic roguelike map screens rather than stacked dashboard cards.
- Desktop routes now use compact left/right support rails for Run Vorräte, Team and regional route traits while the node board owns the center of the screen.
- The full Team manager is no longer a permanent route column; it opens deliberately from **TEAM VERWALTEN** and remains unchanged for management actions.
- Tablet/mobile keep the native Team panel below the route instead of forcing the three-column desktop board.

### Nodes
- Route nodes are now compact sprite-first tiles instead of wide information cards.
- Existing Pokémon/trainer/item sprites are used as the visual focus; labels stay short and full node explanations remain in hover/focus tooltips.
- Available, chosen, future and hidden nodes have clearer board states without extra badges or permanent helper text.
- Goal/boss nodes receive slightly more visual weight while staying inside the same board language.
- Path lines are cleaner and behave like map connections rather than a debug overlay.
- Keyboard-selected nodes continue to use the visible route cursor from the previous polish pass.

### Regional identity
- Kept the dark PokéRegions UI while giving Kanto, Johto, Hoenn and Sinnoh restrained board tinting.
- Biome scenery remains behind the board at lower intensity so node readability wins over decoration.
- Route traits now surface the current biome/region identity in the right support rail.

## 1.0.0-alpha.1 minimal home pass — 2026-10-01

### Less launcher, more game
- Removed the permanent desktop library rail, build/status strip and Alpha-news wall from the title screen.
- Rebuilt the home view around one centered PokéRegions identity and only the actions that matter immediately: continue, new run and trainer collection.
- Kept the full feature set behind the existing hamburger / Trainer menu instead of displaying every destination at once.
- Replaced the dashboard-heavy launcher layout with three large game-mode cards and a restrained regional landscape treatment.
- Simplified the title-screen top chrome to a single menu control.
- Hid Trainer Passport/dashboard details from the title screen; they remain accessible through the game menu.
- Flattened and narrowed the utility drawer so secondary navigation stays functional without dominating the game.

### Startup
- Reduced the client boot presentation to logo, one status line and a thin progress bar.

## 1.0.0-alpha.1 launcher shell pass — 2026-10-01

### Hub / launcher identity
- Rebuilt the main hub around a persistent launcher-style library rail on desktop while keeping the existing drawer as the compact/tablet/mobile fallback.
- Added quick launcher navigation for Play, Trainer, Progress and System destinations without duplicating game state or replacing the original actions.
- Added a dynamic status strip for current build, save mode and run status.
- Added an in-client Alpha highlight/news row so the home screen reads like a maintained game client instead of a large web menu.
- Refined the featured run banner, primary Play CTA and Trainer Passport presentation around a proper game-launcher hierarchy.
- Added Account & Cloud and Admin quick access directly to the launcher rail when available.

### Startup experience
- Added a dedicated PokéRegions client boot overlay with build information and staged loading feedback.
- The boot watchdog now waits for the actual game shell instead of treating any root content as a successful start.
- Boot failures still fall back to the recovery UI and never delete or reset the local save.

### Responsive behavior
- Desktop uses the persistent launcher rail; medium layouts collapse back into the existing Library drawer.
- News/status surfaces collapse progressively on tablet and mobile without hiding the primary Play path.
- Reduced-motion preferences are respected by the new boot and launcher transitions.

## 1.0.0-alpha.1 overall polish pass — 2026-10-01

### Flow & battle clarity
- Added collapsible battle history with a persisted preference so the command area stays compact without losing combat information.
- Added restrained low/critical HP states and a catch-window cue for weakened wild encounters.
- Removed generic screen flashes from normal Wild/Trainer encounters while preserving special Rival, Gym, League and Legendary presentation.
- Updated battle shortcut behavior so **B opens the ball chooser** and the displayed shortcut guide matches the actual controls.
- Route keyboard navigation now visibly highlights the selected node before Enter confirms it.

### Mystery Event variety
- Added eight region-flavored Mystery Events: Abandoned Center, Route Photographer, Apricorn Craftsman, Bell Tower Echo, Storm Wreckage, Secret Base, Coronet Crystal and Snow Rescue.
- Wired the new events into existing regional weighting and anti-repetition logic instead of creating a second event system.
- Added safe/cost/risk visual treatment to event choices while keeping exact hidden outcomes hidden where appropriate.

### Admin & consistency
- Added a dedicated Admin **Unlock Endless** action for the selected player through the existing trusted game-grant pipeline.
- Unified remaining PokéMart polish labels with the newer **Versorgung** route concept.
- Expanded smoke checks for the regional event pool, battle ball-menu shortcut and visible keyboard route selection.

## 1.0.0-alpha.1 game identity pass — 2026-10-01

### Game-first UX
- Added a dedicated `game-experience` layer instead of extending the already large legacy Alpha stylesheet again.
- Unified button priority, panel density, typography rhythm, spacing, focus states and screen width around a calmer GBA/DS-inspired hierarchy.
- Reworked the main-menu hierarchy so play/continue actions read before collection/meta/system navigation.
- Added an expedition step rail to run creation and stronger selected-region feedback.
- Added short screen transitions that respect `prefers-reduced-motion`.

### Regions, routes & replayability
- Added region-aware route context with stage, biome flavor and distinct Kanto/Johto/Hoenn/Sinnoh identity.
- Added subtle Safe/Balanced/Variable/Dangerous route readability without revealing exact outcomes.
- Added run-persistent `recentEvents` history with backwards-safe migration so recently seen Mystery Events are suppressed.
- Added region-weighted Mystery Event pools so Kanto leans trainer/Rocket, Johto mystical, Hoenn nature/weather and Sinnoh exploration/risk.
- Expanded Mystery Events with Angler, Weather Station, Hidden Cave, Fossil Researcher, Lost Trainer, Pokémon Nest and Traveling Nurse encounters.
- Kept the new event rewards run-scoped; no new trusted permanent account rewards are accepted directly from the client.

### Battles & collection screens
- Added short battle intros for wild, trainer, rival, gym, league and legendary encounters.
- Added lightweight Shiny encounter feedback without turning every battle element into an animation.
- Further reduced battle borders/panel weight and tightened HP, command and log presentation.
- Flattened Party, PC, Pokédex, Shop, Loot and Trainer Card presentation to reduce dashboard-style nested cards.
- Added friendlier empty-state copy and mobile-specific layout rules.

### Journey & profile depth
- Added biome-specific route flavor lines and compact encounter-type hints for grassland, forest, cave, coast, sea, city, ruins, mountain, volcano, marsh, snow and night routes.
- Normal route-node weighting now reinforces regional identity: Kanto favors trainers/cities, Johto favors Mystery Events, Hoenn favors wild/nature nodes and Sinnoh favors trainer/event risk.
- Added a compact route-risk legend that preserves hidden outcomes while making Safe/Balanced/Variable/Dangerous path intent easier to read.
- Upgraded the Trainer Card with account prestige: completed regions, Hall of Fame entries, Endless best, Pokédex completion, Shinies and achievements.
- Alpha `First Wave` ownership now appears as an exclusive Trainer Card prestige stamp.
- Biome context now survives correctly when entering a battle directly or reloading during one.

### Runtime architecture
- Scoped the battle visual MutationObserver so unrelated UI mutations no longer trigger battle enhancement work.
- Added typed `playUiSound`, `playBattleSound`, `playRewardSound` and `playSystemSound` hooks via a `pokeregions:sound` event for future audio without coupling gameplay to final sound assets.

### Trainer class identity
- Trainer classes now influence the route generator instead of existing mainly as catch-rate modifiers.
- Type-focused classes receive distinct path tendencies: e.g. Angler favors Wild/Mystery, Wanderer favors Fund/Trainer and Aromalady favors Heal/Mystery.
- Existing specialist classes now reinforce their fantasy: Feldsanitäter sees more healing windows, Schatzjäger more item nodes, Forscher more item/tutor opportunities and Taktiker more trainer-heavy routes.
- Class route identity persists when advancing to later Story maps and Endless maps while remaining deterministic from the run seed.
- Normal trainer archetypes now prefer type themes that fit the active biome, while generic trainer classes remain in the pool to avoid predictability.
- Run-setup class descriptions now explain both the combat/economy bonus and the route-style impact.

### Battle & run-end presentation
- Native Gym, Rival and League trainer intros are now preserved without a redundant second overlay from the polish layer.
- Wild, standard Trainer and Legendary encounters keep a fast one-shot intro, with Legendary encounters receiving a distinct but restrained treatment.
- Boss, Gym, League and Legendary battlefields now communicate importance through border/title hierarchy instead of permanent glow.
- Keyboard shortcuts and always-visible Ability HUD information are visually de-emphasized so the battle command, moves and HP state read first.
- Finished runs now receive a compact Run Record with difficulty, class, elapsed time, badges, wins, score when available and seed.
- Champion runs receive a cleaner Hall of Fame share-card treatment, while losses keep a quieter visual hierarchy.
- Run-result layout remains responsive down to phone widths and does not expose internal run/account UUIDs.

### Consistency & QA
- Player-facing Rogue Point currency copy is now consistently named **Meta Points** while the internal `metaPoints` save key remains unchanged.
- Added smoke coverage for region event weighting, the anti-repetition state, the expanded event pool and currency terminology.
- Existing save/backend/security behavior remains untouched apart from defensive run-field migration.

## 1.0.0-alpha.1 launch candidate r7 — 2026-09-29

### Final audit
- Re-read every tracked repository file, including the preserved baseline assets, launch styles, scripts, workflows, configuration and project documentation.
- Production Pages deployment now runs the full Alpha validation before publishing; manual Wrangler deploys do the same.
- Hardened the boot watchdog so it cancels as soon as the app mounts and no longer relies on an inline click handler.
- Strengthened recovery and launch smoke checks and added typed recovery/build manifests.
- Updated stale recovery/rewrite documentation and corrected launch cache guidance.
- Confirmed limited event achievements do not block standard 100% completion.

### Launch polish
- Added a final responsive pass for desktop, tablet and phone layouts, including Meta-Shop, PC, inventory, achievements, starter selection, settings and loot screens.
- Improved touch targets, safe-area handling, text overflow, modal scrolling and reduced-motion behavior.
- Added clearer accessibility state for mode/region selection and live gift-code status feedback.
- Added a boot recovery screen instead of leaving players on a silent blank page if startup is interrupted.
- Added social/share metadata and connection warm-up for external sprite/map hosts.
- Bumped the reconstructed runtime to r7 and added cache controls to reduce stale-build issues at launch.

### Alpha tester rewards
- Added gift-code redemption to the region selection screen.
- Added `Alpha2026`: permanent Shiny Riolu Meta-Starter with the `First Wave` tag.
- Added the special `First Wave` achievement/title and migration for testers who redeemed the code before the achievement shipped.
- Multiple achievements unlocked by one action now display as a vertical toast stack.

### Region & combat UI
- Restored region artwork with polished hover/selected states and graceful image fallback.
- Added short move descriptions on hover/focus in battle, tutor and party views.
- Compacted the party sidebar when a run only contains one Pokémon.
- Renamed visible legacy PokéRogue Regions branding to PokéRegions while retaining internal legacy save keys for compatibility.

## 1.0.0-alpha.1 — 2026-09-28

### Route safety pass
- Fixed optional-node exits such as Move-Tutor, Shop, Heal, Item and City being able to lead into a route with no selectable continuation.
- Added a route watchdog that repairs already-stuck active saves on reload.
- Secret routes now only replace nodes in full three-lane rows, so hiding a secret can never remove the sole valid path.
- Schutzschild is limited to 4 PP, 60% first-use success and 10% on consecutive uses.
- Revealed route nodes now explain their function on hover/focus.

### Protect balance & route clarity
- Schutzschild heavily nerfed: 4 PP, 60% base success, only 10% when repeated until another move is used.
- Reduced AI value for repeated Protect stalling and exposed the success rule directly on the move button.
- Added hover/focus tooltips to revealed route nodes explaining Wild Battle, Trainer Battle, Market, Event, Healing, Tutor, Arena, League and Legendary nodes.

### Quality & fairness pass
- Elite archetypes now have distinct mechanics: IV Specialists, Hunter crit focus, Relic Keeper sustain/loot, Veteran lead protection and Weather Ace type boosters.
- Run History now exposes Daily runs, score/rank, Ascension, elite battles and secret routes.
- Daily Expeditions now isolate persistent account power: no equipped relics, Meta-Starters, Bottle-Cap starter IVs, Mastery moves or trainer-class upgrades.
- Converted the obsolete per-run quest achievement into an account Questboard milestone.
- Added live run-condition chips for Daily/Ascension, challenge rules, active relics, loot rerolls and live score.
- Added a dynamic main-menu count for Questboard rewards ready to claim.
- Continued the unified dark-theme and sprite-alignment polish pass.

### Roguelike progression
- Added region-specific Ascension 0–10 with difficulty, shop and score scaling.
- Added deterministic Daily Expeditions with date seed, fixed rules and best-score records.
- Added Run Score and D/C/B/A/S/S+ result ranks.
- Added Species Mastery and Pokédex mastery challenges.
- Added a weighted Completion dashboard.

### Runs & encounters
- Added Relics 2.0 with eight new rogue relics alongside the 18 type plates.
- Added Loot Control with reward lock, reroll and skip-for-money actions.
- Added Boss Telegraphs for key encounters.
- Added five-stat battle stages and new setup/debuff moves.
- Added Elite Trainer archetypes, Secret Routes and event-chain follow-ups.
- Added Cracked Compass, Hunter Mark, Black Feather, Glass Charm, Lucky Egg, Old Coin, Rogue Die and Warden Charm effects.

### UX
- Added Rogue Codex and first-run Alpha onboarding.
- Added menu, route and battle keyboard shortcuts.
- Added a broad Pokémon/handheld-inspired visual polish layer while retaining the project's own layout and assets.
- Improved save migration for the new Alpha fields while keeping save schema v5 compatible.

### Recovery
- Reconstructed this Alpha from the preserved v0.9.4 production baseline.
- Added a reproducible `scripts/build-alpha.py` patch pipeline and Alpha smoke validation.

## 0.9.4-recovered.1 — 2026-09-28

- Established new repository after loss of access to previous GitHub account.
- Recovered production JavaScript and CSS from Opera HTTP cache.
- Added deterministic recovery verification.
- Added Vite shell for the preserved v0.9.4 production build.