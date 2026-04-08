# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

No build step, no server required. Open any HTML file directly in a browser:

```
games/countrydash/index.html   ← CountryDash game
index.html                     ← Game collection homepage
```

If a local server is ever needed (e.g. for future ES module use):

```bash
# Python venv is required for all Python installs in this project
python -m venv venv
source venv/Scripts/activate
pip install <package>

# Serve locally
python -m http.server 8080
```

## Architecture

### Site structure

- **`index.html` + `style.css`** — Static homepage. Game cards link to game subdirectories. Add a card here manually when a new game is added. No JS needed on the homepage.
- **`games/<game-name>/`** — Each game is fully self-contained in its subdirectory.

### CountryDash (`games/countrydash/`)

Pure HTML5 Canvas game. No framework, no bundler, no ES modules. Scripts are loaded via `<script>` tags in dependency order in `index.html`.

**Load order (matters):**
```
save.js → characters.js → levels.js → player.js → renderer.js → audio.js → shop.js → game.js
```

**State machine** (`game.js`): `Game.state` is the single source of truth. Values: `'menu'`, `'playing'`, `'dead'`, `'levelcomplete'`. The RAF loop reads this to decide what to update and what to render.

**Game loop** (`game.js`): `requestAnimationFrame` loop with delta time capped at 50ms. On each tick: `Player.update(dt)` → `checkPlatforms()` → `checkCoins()` → `camera.x = Player.x - 150` → `checkObstacles()` → `checkLevelEnd()` → `Renderer.draw(...)`.

**Player** (`player.js`): Horizontal position increases every frame at `Player.speed` px/s. Camera follows so the player appears fixed at screen x=150. Vertical physics: gravity=1800 px/s², jump=-760 px/s. Hitbox is `radius - 4` for forgiving collisions. `GROUND_Y = 340`.

**Levels** (`levels.js`): Array of plain objects. Always call `Levels.getActive(index)` (deep clone) — never mutate `LEVEL_DEFS` directly. Obstacle `x` values are absolute world-space coordinates. Levels 1–3: spikes; 4–6: blocks + tall obstacles; 7–9: ground gaps introduced; 10–12: combined hazards; 13: boss.

**Characters** (`characters.js`): `CHARACTERS` array + `CharacterMap` (Map for O(1) lookup). Each entry has `{ code, name, rarity, price, flag }`. Poland (`'PL'`) is `rarity:'starter'` with `price:0` — never shown in shop. Flag data drives `Renderer.drawFlag()`. Rarities in order: `starter` → `common` (100) → `uncommon` (250) → `rare` (500) → `legendary` (1000) → `mystical` (2500) → `godly` (10000). `RARITY_ORDER` array must stay in sync.

**Renderer** (`renderer.js`): All canvas drawing. `Renderer.draw(state, activeLevel, cameraX, coinsThisRun, coinsEarned)` is the only public draw call. `Renderer.drawFlag(ctx, cx, cy, radius, code)` clips to a circle and dispatches to a flag type handler. Flag types: `horizontal_stripes`, `vertical_stripes`, `nordic_cross`, `solid_with_emblem`, `diagonal`, `cross`, `quartered`, `union_jack`. `drawBackground(level, cameraX)` takes cameraX for parallax — do not call without it. Player is drawn with squish/stretch (based on `Player.vy`), eye, specular glint, and ground drop shadow.

**Audio** (`audio.js`): Web Audio API chiptune engine. `Audio.playLevel(index)` starts the track for that level (0-indexed, clamped to 13 tracks). `Audio.stop()` halts playback. `Audio.setVolume(0–1)` adjusts master gain. AudioContext is lazy-initialized on first call — must be triggered by a user gesture. Each level has a unique BPM (140–200), key, scale (MAJ/MIN/PENT/HARM), bassline, melody, and arp pattern. Drums (kick/snare/hihat) are generated from noise buffers — no audio files. Call `Audio.playLevel` in `startLevel`/`restartLevel`, `Audio.stop` in `die`/`nextLevel` (when done)/ESC-to-menu.

**Save** (`save.js`): Thin `localStorage` wrapper with in-memory fallback. All keys namespaced with `cd_`. Never call `localStorage` directly — always go through `Save.*`. `isLevelUnlocked()` always returns `true` — all levels are open from the start.

**Shop / Level Select** (`shop.js`): HTML overlay (`<div class="overlay">`) toggled with `.active` class. Shop renders flag previews using small per-card canvases calling `Renderer.drawFlag`. `showToast(msg)` is a global helper defined here. Mystical/Godly rarity filter buttons are in the HTML; their CSS animations (`mystical-shimmer`, `godly-pulse`) are in `index.html`'s `<style>` block.

### Collision detection

- Circle vs rectangle: `circleVsRect` in `game.js` — finds nearest point on rect to circle center.
- Spike hitbox uses 70% of declared height (tip is forgiving).
- Platform landing: player must be moving downward (`vy >= 0`) and within 20px above surface.
- Ground gap death: player falls more than 30px below `GROUND_Y` while in a gap range.

### Adding a new game

1. Create `games/<name>/` with its own `index.html` and JS files.
2. Add a game card to the root `index.html` linking to the new directory.

### Adding a new country/character

Add an entry to the `CHARACTERS` array in `characters.js`. The `CharacterMap` is built automatically at load time. If the flag requires a new draw type, add a handler in `renderer.js`'s `drawFlag` switch and the corresponding draw function.
