'use strict';

// ── Constants ─────────────────────────────────────────────────────────────

const CANVAS_W = 800;
const CANVAS_H = 400;
const PLAYER_SCREEN_X = 150;   // fixed screen x where player appears

// ── Game state ────────────────────────────────────────────────────────────

const Game = {
    state: 'menu',          // 'menu' | 'playing' | 'dead' | 'levelcomplete'
    currentLevel: 0,
    camera: { x: 0 },
    activeLevel: null,      // cloned level object for current run
    coinsThisRun: 0,        // coins collected mid-run (lost on death)
    coinsEarned: 0,         // coins awarded on level complete (shown on screen)
    scaleRatio: 1,          // canvas CSS scale for mouse coordinate correction

    startLevel(index) {
        if (!Save.isLevelUnlocked(index)) return;
        this.currentLevel = index;
        this.activeLevel  = Levels.getActive(index);
        this.camera.x     = 0;
        this.coinsThisRun = 0;
        Player.reset(this.activeLevel.speed);
        this.state = 'playing';
        Audio.playLevel(index);
    },

    restartLevel() {
        this.activeLevel  = Levels.getActive(this.currentLevel);
        this.camera.x     = 0;
        this.coinsThisRun = 0;
        Player.reset(this.activeLevel.speed);
        this.state = 'playing';
        Audio.playLevel(this.currentLevel);
    },

    die() {
        this.state = 'dead';
        this.coinsThisRun = 0;   // lose coins collected this run
        // Music keeps playing through death screen
    },

    completeLevel() {
        const level = this.activeLevel;
        const earned = level.coinReward + this.coinsThisRun;
        this.coinsEarned = earned;
        Save.addCoins(earned);
        Save.completeLevel(this.currentLevel);
        this.state = 'levelcomplete';
    },

    nextLevel() {
        const next = this.currentLevel + 1;
        if (next < Levels.count) {
            this.startLevel(next);
        } else {
            this.state = 'menu';
            Audio.playMenu();
        }
    },
};

// ── Collision helpers ─────────────────────────────────────────────────────

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function circleVsRect(cx, cy, r, rx, ry, rw, rh) {
    const nearX = clamp(cx, rx, rx + rw);
    const nearY = clamp(cy, ry, ry + rh);
    const dx = cx - nearX;
    const dy = cy - nearY;
    return dx * dx + dy * dy < r * r;
}

function circleVsCircle(ax, ay, ar, bx, by, br) {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy < (ar + br) * (ar + br);
}

// ── Ground gap check ──────────────────────────────────────────────────────

function hasGroundAt(worldX) {
    const gaps = Game.activeLevel ? Game.activeLevel.groundGaps : [];
    for (const gap of gaps) {
        if (worldX > gap.startX && worldX < gap.endX) return false;
    }
    return true;
}

// ── Platform collision ────────────────────────────────────────────────────

function checkPlatforms() {
    const level = Game.activeLevel;
    if (!level) return;
    const hb = Player.getHitbox();
    const groundSurface = GROUND_Y + PLAYER_RADIUS; // top of ground

    for (const plat of level.platforms) {
        const sx = plat.x;
        // Player must be moving downward, above the platform surface, and within x range
        if (Player.vy >= 0 &&
            Player.y <= plat.y + 2 &&
            Player.y > plat.y - 20 &&
            hb.cx + hb.r > plat.x &&
            hb.cx - hb.r < plat.x + plat.w) {
            Player.landOnPlatform(plat.y);
        }
    }
}

// ── Obstacle collision ────────────────────────────────────────────────────

function checkObstacles() {
    const level = Game.activeLevel;
    if (!level) return false;
    const hb = Player.getHitbox();
    const groundSurface = GROUND_Y + PLAYER_RADIUS;

    for (const obs of level.obstacles) {
        if (obs.type === 'spike') {
            // Spikes = instant death
            const spikeRectH = obs.h * 0.7;
            const rx = obs.x;
            const ry = groundSurface - obs.h + (obs.h - spikeRectH);
            if (circleVsRect(hb.cx, hb.cy, hb.r, rx, ry, obs.w, spikeRectH)) return true;
        } else if (obs.type === 'block' || obs.type === 'tall') {
            // Blocks = solid platforms: land on top, die only on side collision
            const rx = obs.x;
            const ry = groundSurface - obs.h;
            if (!circleVsRect(hb.cx, hb.cy, hb.r, rx, ry, obs.w, obs.h)) continue;

            // Check if player is coming from above (land on top)
            const playerBottom = hb.cy + hb.r;
            const blockTop     = ry;
            const comingFromAbove = Player.vy >= 0 && playerBottom <= blockTop + 12;
            if (comingFromAbove) {
                Player.landOnPlatform(blockTop);
            } else {
                // Side or bottom collision = death (ran into the wall)
                return true;
            }
        }
    }

    // Fall through gap = death
    if (!hasGroundAt(Player.x) && Player.y > GROUND_Y + PLAYER_RADIUS + 30) {
        return true;
    }

    return false;
}

// ── Coin collection ───────────────────────────────────────────────────────

function checkCoins() {
    const level = Game.activeLevel;
    if (!level) return;
    const hb = Player.getHitbox();

    for (const coin of level.coins) {
        if (coin.collected) continue;
        if (circleVsCircle(hb.cx, hb.cy, hb.r, coin.x, coin.y, 10)) {
            coin.collected = true;
            Game.coinsThisRun++;
        }
    }
}

// ── Portal check ─────────────────────────────────────────────────────────

function checkPortals() {
    const level = Game.activeLevel;
    if (!level || !level.portals) return;
    for (const portal of level.portals) {
        if (!portal.triggered &&
            Player.x + PLAYER_RADIUS > portal.x &&
            Player.x - PLAYER_RADIUS < portal.x + 50) {
            portal.triggered = true;
            Player.mode = portal.portalType;
            // Smooth transition: zero out vertical speed when entering cube
            if (portal.portalType === 'cube') Player.vy = 0;
        }
    }
}

// ── Level end check ───────────────────────────────────────────────────────

function checkLevelEnd() {
    if (Player.x >= Game.activeLevel.endX) {
        Game.completeLevel();
    }
}

// ── Canvas scaling ────────────────────────────────────────────────────────

function updateScale() {
    const canvas = Renderer.canvas;
    const rect   = canvas.getBoundingClientRect();
    Game.scaleRatio = CANVAS_W / rect.width;
}

// ── Input handling ────────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
    if (e.repeat) return;

    if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        Input.held = true;
        handleAction();
    }
    if (e.code === 'KeyS' && (Game.state === 'menu' || Game.state === 'playing')) {
        Shop.open();
    }
    if (e.code === 'KeyL' && (Game.state === 'menu')) {
        LevelSelect.open();
    }
    if (e.code === 'Escape') {
        Shop.close();
        LevelSelect.close();
        if (Game.state === 'playing') { Game.state = 'menu'; Audio.playMenu(); }
    }
});

document.addEventListener('keyup', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        Input.held = false;
    }
});

Renderer.canvas.addEventListener('pointerdown', e => {
    // Ignore clicks on overlays
    if (document.getElementById('shopOverlay').classList.contains('active')) return;
    if (document.getElementById('levelSelectOverlay').classList.contains('active')) return;

    Input.held = true;
    handleAction();
});

Renderer.canvas.addEventListener('pointerup',  () => { Input.held = false; });
Renderer.canvas.addEventListener('pointerout', () => { Input.held = false; });

function handleAction() {
    switch (Game.state) {
        case 'menu':
            Game.startLevel(Game.currentLevel);
            break;
        case 'playing':
            Player.jump();
            break;
        case 'dead':
            Game.restartLevel();
            break;
        case 'levelcomplete':
            Game.nextLevel();
            break;
    }
}

// ── Main loop ─────────────────────────────────────────────────────────────

let lastTimestamp = 0;

function loop(timestamp) {
    const raw = (timestamp - lastTimestamp) / 1000;
    const dt  = Math.min(raw, 0.05); // cap at 50ms to prevent spiral of death
    lastTimestamp = timestamp;

    if (Game.state === 'playing') {
        const grounded = hasGroundAt(Player.x);
        Player.update(dt, grounded);
        checkPlatforms();
        checkPortals();
        checkCoins();

        // Move camera
        Game.camera.x = Player.x - PLAYER_SCREEN_X;

        if (checkObstacles()) {
            Game.die();
        } else {
            checkLevelEnd();
        }
    }

    Renderer.draw(
        Game.state,
        Game.activeLevel,
        Game.camera.x,
        Game.coinsThisRun,
        Game.coinsEarned,
    );

    requestAnimationFrame(loop);
}

// ── Init ──────────────────────────────────────────────────────────────────

window.addEventListener('resize', updateScale);
updateScale();

// Kick off with last played level or level 0
Game.currentLevel = 0;
requestAnimationFrame(ts => {
    lastTimestamp = ts;
    requestAnimationFrame(loop);
});
