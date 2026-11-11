import { TILE, firstTile, lastTile } from "./world.js";

const WALKER_SPEED = 35;
const ENEMY_GRAVITY = 1400;

export class Walker {
    constructor(x, y, gravityScale) {
        this.kind = "walker";
        this.w = 14;
        this.h = 12;
        this.x = x + (TILE - this.w) / 2;
        this.y = y + TILE - this.h;
        this.vx = -WALKER_SPEED;
        this.vy = 0;
        this.gravity = ENEMY_GRAVITY * gravityScale;
        this.alive = true;
        this.squash = 0;
        this.t = 0;
    }

    update(world, dt) {
        this.t += dt;
        if (!this.alive) {
            this.squash += dt;
            return;
        }

        this.vy = Math.min(this.vy + this.gravity * dt, 400);
        this.y += this.vy * dt;
        const footRow = lastTile(this.y + this.h);
        const x0 = firstTile(this.x);
        const x1 = lastTile(this.x + this.w);
        for (let tx = x0; tx <= x1; tx++) {
            if (world.isSolid(tx, footRow) || world.isOneWay(tx, footRow)) {
                this.y = footRow * TILE - this.h;
                this.vy = 0;
                break;
            }
        }

        const grounded = this.vy === 0;
        const nextX = this.x + this.vx * dt;
        const leadX = this.vx > 0 ? lastTile(nextX + this.w) : firstTile(nextX);
        const bodyRow = lastTile(this.y + this.h);
        const groundRow = bodyRow + 1;
        const wall = world.isSolid(leadX, bodyRow);
        const ledge = grounded && !world.isSolid(leadX, groundRow) && !world.isOneWay(leadX, groundRow);
        const hazard = world.tileAt(leadX, bodyRow) === "^";
        if (wall || ledge || hazard) {
            this.vx = -this.vx;
        } else {
            this.x = nextX;
        }
    }
}

export class Flyer {
    constructor(x, y) {
        this.kind = "flyer";
        this.w = 14;
        this.h = 10;
        this.baseX = x + (TILE - this.w) / 2;
        this.baseY = y + (TILE - this.h) / 2;
        this.x = this.baseX;
        this.y = this.baseY;
        this.t = Math.random() * Math.PI * 2;
        this.alive = true;
        this.squash = 0;
        this.facing = 1;
    }

    update(_world, dt) {
        this.t += dt;
        if (!this.alive) {
            this.squash += dt;
            this.y += 120 * dt;
            return;
        }
        const prevX = this.x;
        this.x = this.baseX + Math.sin(this.t * 1.1) * 40;
        this.y = this.baseY + Math.sin(this.t * 2.6) * 6;
        this.facing = this.x >= prevX ? 1 : -1;
    }
}

export function spawnEntities(world) {
    const enemies = [];
    const pickups = [];
    const checkpoints = [];
    for (const s of world.spawns) {
        switch (s.type) {
            case "E":
                enemies.push(new Walker(s.x, s.y, world.level.gravityScale));
                break;
            case "F":
                enemies.push(new Flyer(s.x, s.y));
                break;
            case "o":
                pickups.push({ x: s.x + 3, y: s.y + 3, w: 10, h: 10, taken: false, t: Math.random() * 6 });
                break;
            case "C":
                checkpoints.push({ x: s.x + 4, y: s.y - TILE, w: 8, h: TILE * 2, tileX: s.x, tileY: s.y, active: false });
                break;
            default:
                throw new Error(`Unknown spawn tile "${s.type}" in level "${world.level.id}"`);
        }
    }
    return { enemies, pickups, checkpoints };
}
