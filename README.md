# Runebound · The Sunken Crypt

A cinematic, landscape-first dark-fantasy mobile encounter. The screen is intentionally built as a high-fidelity gameplay moment: a fully armored knight rolls through a torchlit rune dungeon while a spectral warrior emerges from the blue mist.

The project is a standalone Vite site with no runtime backend. Its generated key art stays behind an interactive HUD so the image remains crisp while controls, loot, counters, cooldowns, pause/map navigation, and result cards are real UI.

## Run locally

```bash
npm install
npm run dev
```

Open the shown Vite URL. The experience is designed for landscape screens, but keeps the primary controls usable at narrow widths.

```bash
npm run build       # production build
npm run test:ui     # jsdom coverage for HUD and encounter flow
npm run test:assets # retained validation for the bundled GLB source assets
```

## Encounter controls

| Control | Touch | Keyboard |
| --- | --- | --- |
| Sword strike | **ATTACK** | `J` / `Space` |
| Combat roll | **DODGE** | `K` / `Shift` |
| Rune gauntlet | **SPECIAL** | `Q` |
| Shift position | eight-way D-pad | arrows / `WASD` |
| Level map | **MAP** | `M` |
| Pause / resume | top stop button | `Esc` closes pause or map |

Defeat the **Spectral Warrior**, then tap the scattered coins and moon pearls. Collecting the full hoard opens the green **LEVEL CLEAR!** card with the time bonus, defeated-enemy count, secrets line, and **NEXT LEVEL** action. If the player’s vigor reaches zero — or the paused expedition is ended — the distinct dark **GAME OVER** card presents total points, **TRY AGAIN**, and **STORE** actions.

## Key files

```text
public/assets/images/dungeon-battle.png  cinematic dungeon combat background
index.html                               semantic HUD, collectible layer, result overlays
src/dungeon-game.js                      encounter state, effects, loot, pause/map flow
src/styles/main.css                      responsive cinematic game UI and animations
src/main.js                              application boot
```

### Art direction

The background is an original generated landscape composition for this project. It preserves the requested visual hierarchy: mossy stone floor, cracked arches, orange torchlight, cyan runes, volumetric mist, the rolling steel knight, spectral wraith, and recessed treasure chests. All text remains DOM-rendered rather than baked into art, keeping every gameplay label sharp and accessible.
