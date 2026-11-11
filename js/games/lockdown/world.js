// Grid world for Lab Lockdown. Pure logic, no DOM, so tools can load it.
//
// Map legend
//   #  wall panel     R  computer rack   W  window      P  pipes
//   F  flag wall      D  sliding door    X  exit hatch
//   .  floor          @  player start    r  robot
//   d  data disk      h  waffle (health) e  energy cell

export const WALLS = new Set(["#", "R", "W", "P", "F", "X"]);
export const DOOR = "D";
export const EXIT = "X";
const SPAWNS = new Set(["@", "r", "d", "h", "e"]);

const DOOR_SPEED = 2.5;
const DOOR_TRIGGER = 1.4;
const DOOR_HOLD = 2.0;
export const DOOR_PASSABLE = 0.9;
const DOOR_OPAQUE = 0.6;
export const EXIT_REACH = 0.9;

export class LabWorld {
    constructor(map) {
        const rows = map.grid;
        const width = rows[0]?.length ?? 0;
        rows.forEach((row, i) => {
            if (row.length !== width) throw new Error(`Map "${map.id}" row ${i} has length ${row.length}, expected ${width}`);
        });
        this.map = map;
        this.width = width;
        this.height = rows.length;
        this.cells = [];
        this.doors = new Map();
        this.spawns = [];
        this.start = null;
        this.exits = [];

        for (let y = 0; y < this.height; y++) {
            const row = rows[y] ?? "";
            for (let x = 0; x < width; x++) {
                const ch = row[x] ?? "#";
                if (WALLS.has(ch) || ch === DOOR) {
                    this.cells.push(ch);
                    if (ch === EXIT) this.exits.push({ x, y });
                } else if (ch === "." || SPAWNS.has(ch)) {
                    this.cells.push(".");
                    if (ch === "@") this.start = { x: x + 0.5, y: y + 0.5 };
                    else if (ch !== ".") this.spawns.push({ type: ch, x: x + 0.5, y: y + 0.5 });
                } else {
                    throw new Error(`Map "${map.id}" has unknown tile "${ch}" at (${x}, ${y})`);
                }
            }
        }
        if (!this.start) throw new Error(`Map "${map.id}" has no start @`);
        if (this.exits.length === 0) throw new Error(`Map "${map.id}" has no exit X`);

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < width; x++) {
                if (this.cell(x, y) !== DOOR) continue;
                const openX = !this.isWallChar(this.cell(x - 1, y)) && !this.isWallChar(this.cell(x + 1, y));
                const openY = !this.isWallChar(this.cell(x, y - 1)) && !this.isWallChar(this.cell(x, y + 1));
                if (openX === openY) throw new Error(`Map "${map.id}" door at (${x}, ${y}) must sit between two walls`);
                // axis "x": the door slab is a plane of constant x (passage runs east-west)
                this.doors.set(y * width + x, { x, y, axis: openX ? "x" : "y", open: 0, hold: 0 });
            }
        }
    }

    cell(x, y) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return "#";
        return this.cells[y * this.width + x] ?? "#";
    }

    isWallChar(ch) {
        return WALLS.has(ch);
    }

    door(x, y) {
        return this.doors.get(y * this.width + x) ?? null;
    }

    // True if an actor can't stand in this cell.
    blocked(x, y) {
        const ch = this.cell(x, y);
        if (WALLS.has(ch)) return true;
        if (ch === DOOR) return (this.door(x, y)?.open ?? 0) < DOOR_PASSABLE;
        return false;
    }

    opaque(x, y) {
        const ch = this.cell(x, y);
        if (WALLS.has(ch)) return true;
        if (ch === DOOR) return (this.door(x, y)?.open ?? 0) < DOOR_OPAQUE;
        return false;
    }

    // Opens doors near any of the given actors and closes idle ones.
    updateDoors(actors, dt) {
        const events = [];
        for (const d of this.doors.values()) {
            const cx = d.x + 0.5;
            const cy = d.y + 0.5;
            const near = actors.some((a) => Math.hypot(a.x - cx, a.y - cy) < DOOR_TRIGGER);
            const occupied = actors.some((a) => Math.floor(a.x) === d.x && Math.floor(a.y) === d.y);
            if (near || occupied) {
                if (d.open === 0) events.push("door");
                d.hold = DOOR_HOLD;
            } else {
                d.hold = Math.max(0, d.hold - dt);
            }
            const target = d.hold > 0 ? 1 : 0;
            d.open = target > d.open ? Math.min(1, d.open + DOOR_SPEED * dt) : Math.max(0, d.open - DOOR_SPEED * dt);
        }
        return events;
    }

    // Moves a circular actor, sliding along walls.
    move(actor, dx, dy, radius) {
        const nx = actor.x + dx;
        if (!this.circleBlocked(nx, actor.y, radius)) actor.x = nx;
        const ny = actor.y + dy;
        if (!this.circleBlocked(actor.x, ny, radius)) actor.y = ny;
    }

    circleBlocked(x, y, r) {
        const x0 = Math.floor(x - r);
        const x1 = Math.floor(x + r);
        const y0 = Math.floor(y - r);
        const y1 = Math.floor(y + r);
        for (let cy = y0; cy <= y1; cy++) {
            for (let cx = x0; cx <= x1; cx++) {
                if (this.blocked(cx, cy)) return true;
            }
        }
        return false;
    }

    lineOfSight(ax, ay, bx, by) {
        const dist = Math.hypot(bx - ax, by - ay);
        const steps = Math.ceil(dist / 0.1);
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            if (this.opaque(Math.floor(ax + (bx - ax) * t), Math.floor(ay + (by - ay) * t))) return false;
        }
        return true;
    }

    atExit(x, y) {
        return this.exits.some((e) => Math.hypot(x - (e.x + 0.5), y - (e.y + 0.5)) < EXIT_REACH);
    }
}
