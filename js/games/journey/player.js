import { TILE, firstTile, lastTile } from "./world.js";

export const PLAYER_W = 10;
export const PLAYER_H = 14;

const BASE = {
    runSpeed: 130,
    groundAccel: 1300,
    airAccel: 850,
    friction: 1500,
    gravity: 1400,
    jumpVelocity: 430,
    maxFall: 420,
    springVelocity: 640,
    stompBounce: 300,
    jumpCut: 0.45,
    coyoteTime: 0.1,
    jumpBuffer: 0.12,
};

export function physicsFor(level) {
    const g = level.gravityScale;
    if (g === 1) return { ...BASE };
    return {
        ...BASE,
        gravity: BASE.gravity * g,
        jumpVelocity: 300,
        maxFall: 200,
        springVelocity: 420,
        stompBounce: 200,
        airAccel: 600,
    };
}

export class Player {
    constructor(x, y, physics) {
        this.physics = physics;
        this.x = x + (TILE - PLAYER_W) / 2;
        this.y = y + TILE - PLAYER_H;
        this.vx = 0;
        this.vy = 0;
        this.onGround = false;
        this.facing = 1;
        this.coyote = 0;
        this.buffer = 0;
        this.jumping = false;
        this.landedOnSpring = false;
        this.animTime = 0;
    }

    // Advances the player one step. Returns events that happened this step.
    step(world, input, dt) {
        const p = this.physics;
        const events = [];
        const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);

        if (dir !== 0) {
            this.facing = dir;
            const accel = this.onGround ? p.groundAccel : p.airAccel;
            this.vx = approach(this.vx, dir * p.runSpeed, accel * dt);
        } else if (this.onGround) {
            this.vx = approach(this.vx, 0, p.friction * dt);
        } else {
            this.vx = approach(this.vx, 0, p.airAccel * 0.5 * dt);
        }

        this.coyote = this.onGround ? p.coyoteTime : Math.max(0, this.coyote - dt);
        this.buffer = input.jumpPressed ? p.jumpBuffer : Math.max(0, this.buffer - dt);

        if (this.buffer > 0 && this.coyote > 0) {
            this.vy = -p.jumpVelocity;
            this.buffer = 0;
            this.coyote = 0;
            this.onGround = false;
            this.jumping = true;
            events.push("jump");
        }

        if (this.jumping && !input.jumpHeld && this.vy < 0) {
            this.vy *= p.jumpCut;
            this.jumping = false;
        }
        if (this.vy >= 0) this.jumping = false;

        this.vy = Math.min(this.vy + p.gravity * dt, p.maxFall);

        this.moveX(world, this.vx * dt);
        const wasFalling = this.vy > 0;
        this.onGround = false;
        const landedOn = this.moveY(world, this.vy * dt);

        if (landedOn === "B" && wasFalling) {
            this.vy = -p.springVelocity;
            this.onGround = false;
            this.jumping = false;
            events.push("spring");
        }

        this.animTime += dt;
        return events;
    }

    bounce() {
        this.vy = -this.physics.stompBounce;
        this.jumping = false;
    }

    moveX(world, dx) {
        this.x += dx;
        const y0 = firstTile(this.y);
        const y1 = lastTile(this.y + PLAYER_H);
        if (dx > 0) {
            const tx = lastTile(this.x + PLAYER_W);
            for (let ty = y0; ty <= y1; ty++) {
                if (world.isSolid(tx, ty)) {
                    this.x = tx * TILE - PLAYER_W;
                    this.vx = 0;
                    return;
                }
            }
        } else if (dx < 0) {
            const tx = firstTile(this.x);
            for (let ty = y0; ty <= y1; ty++) {
                if (world.isSolid(tx, ty)) {
                    this.x = (tx + 1) * TILE;
                    this.vx = 0;
                    return;
                }
            }
        }
    }

    // Returns the tile character landed on, or null.
    moveY(world, dy) {
        const prevBottom = this.y + PLAYER_H;
        this.y += dy;
        const x0 = firstTile(this.x);
        const x1 = lastTile(this.x + PLAYER_W);
        if (dy > 0) {
            const ty = lastTile(this.y + PLAYER_H);
            const top = ty * TILE;
            let landed = null;
            for (let tx = x0; tx <= x1; tx++) {
                const solid = world.isSolid(tx, ty);
                const oneWay = world.isOneWay(tx, ty) && prevBottom <= top;
                if (solid || oneWay) {
                    const ch = world.tileAt(tx, ty);
                    if (landed === null || ch === "B") landed = ch;
                }
            }
            if (landed !== null) {
                this.y = top - PLAYER_H;
                this.vy = 0;
                this.onGround = true;
                return landed;
            }
        } else if (dy < 0) {
            const ty = firstTile(this.y);
            for (let tx = x0; tx <= x1; tx++) {
                if (world.isSolid(tx, ty)) {
                    this.y = (ty + 1) * TILE;
                    this.vy = 0;
                    return null;
                }
            }
        }
        return null;
    }
}

function approach(value, target, amount) {
    if (value < target) return Math.min(value + amount, target);
    return Math.max(value - amount, target);
}
