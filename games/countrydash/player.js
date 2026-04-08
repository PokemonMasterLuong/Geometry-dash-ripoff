'use strict';

const GRAVITY       = 1800;  // px/s²
const JUMP_VELOCITY = 760;   // px/s upward
const GROUND_Y      = 340;   // canvas y of ground surface (player center rests here)
const PLAYER_RADIUS = 22;
const HITBOX_SHRINK = 4;     // hitbox radius = PLAYER_RADIUS - HITBOX_SHRINK

const SHIP_THRUST   = 1350;  // px/s² upward thrust when held
const SHIP_GRAVITY  = 880;   // px/s² downward in ship mode
const SHIP_MAX_VY   = 370;   // max vertical speed in ship mode
const CEILING_Y     = PLAYER_RADIUS + 8;  // top boundary

// Global input state — updated by game.js event listeners
const Input = { held: false };

const Player = {
    x: 0,
    y: GROUND_Y,
    vy: 0,
    isGrounded: true,
    radius: PLAYER_RADIUS,
    speed: 300,
    mode: 'cube',   // 'cube' | 'ship'

    reset(levelSpeed) {
        this.x = 150;
        this.y = GROUND_Y;
        this.vy = 0;
        this.isGrounded = true;
        this.speed = levelSpeed || 300;
        this.mode = 'cube';
    },

    jump() {
        if (this.mode === 'cube' && this.isGrounded) {
            this.vy = -JUMP_VELOCITY;
            this.isGrounded = false;
        }
        // Ship mode: holding is handled in update() via Input.held
    },

    update(dt, hasGround) {
        this.x += this.speed * dt;

        if (this.mode === 'ship') {
            // Ship: hold = thrust up, release = gravity pulls down
            if (Input.held) {
                this.vy -= SHIP_THRUST * dt;
            } else {
                this.vy += SHIP_GRAVITY * dt;
            }
            this.vy = Math.max(-SHIP_MAX_VY, Math.min(SHIP_MAX_VY, this.vy));
            this.y += this.vy * dt;

            // Ceiling boundary
            if (this.y < CEILING_Y) {
                this.y = CEILING_Y;
                this.vy = Math.max(0, this.vy);
            }
            // Ground boundary
            if (this.y >= GROUND_Y) {
                this.y = GROUND_Y;
                this.vy = 0;
                this.isGrounded = true;
            } else {
                this.isGrounded = false;
            }
        } else {
            // Cube mode — original physics
            if (!this.isGrounded) {
                this.vy += GRAVITY * dt;
            }
            this.y += this.vy * dt;

            if (hasGround && this.y >= GROUND_Y) {
                this.y = GROUND_Y;
                this.vy = 0;
                this.isGrounded = true;
                // Auto-jump if still holding
                if (Input.held) {
                    this.vy = -JUMP_VELOCITY;
                    this.isGrounded = false;
                }
            } else if (!hasGround && this.y >= GROUND_Y) {
                this.isGrounded = false;
            }
        }
    },

    landOnPlatform(surfaceY) {
        this.y = surfaceY;
        this.vy = 0;
        this.isGrounded = true;
        if (this.mode === 'cube' && Input.held) {
            this.vy = -JUMP_VELOCITY;
            this.isGrounded = false;
        }
    },

    getHitbox() {
        return {
            cx: this.x,
            cy: this.y,
            r: PLAYER_RADIUS - HITBOX_SHRINK,
        };
    },
};
