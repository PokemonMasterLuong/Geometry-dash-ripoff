'use strict';

const GRAVITY       = 1800;  // px/s²
const JUMP_VELOCITY = 760;   // px/s upward
const GROUND_Y      = 340;   // canvas y of ground surface (player center rests here)
const PLAYER_RADIUS = 22;
const HITBOX_SHRINK = 4;     // hitbox radius = PLAYER_RADIUS - HITBOX_SHRINK

const Player = {
    x: 0,
    y: GROUND_Y,
    vy: 0,
    isGrounded: true,
    radius: PLAYER_RADIUS,
    speed: 300,       // set by level on load

    reset(levelSpeed) {
        this.x = 150;
        this.y = GROUND_Y;
        this.vy = 0;
        this.isGrounded = true;
        this.speed = levelSpeed || 300;
    },

    jump() {
        if (this.isGrounded) {
            this.vy = -JUMP_VELOCITY;
            this.isGrounded = false;
        }
    },

    // hasGround: whether the ground is solid at the player's current world-x
    update(dt, hasGround) {
        // Horizontal movement
        this.x += this.speed * dt;

        // Vertical physics
        if (!this.isGrounded) {
            this.vy += GRAVITY * dt;
        }
        this.y += this.vy * dt;

        // Ground collision (only if ground is present at this x)
        if (hasGround && this.y >= GROUND_Y) {
            this.y = GROUND_Y;
            this.vy = 0;
            this.isGrounded = true;
        } else if (!hasGround && this.y >= GROUND_Y) {
            // No ground — player keeps falling (death handled by game.js)
            this.isGrounded = false;
        }
    },

    // Land on a platform surface (called by game.js when platform collision detected)
    landOnPlatform(surfaceY) {
        this.y = surfaceY;
        this.vy = 0;
        this.isGrounded = true;
    },

    // Returns the hitbox for collision detection (slightly smaller than visual)
    getHitbox() {
        return {
            cx: this.x,
            cy: this.y,
            r: PLAYER_RADIUS - HITBOX_SHRINK,
        };
    },
};
