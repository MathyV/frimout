export const TILE = 16;

const EDGE_EPSILON = 0.001;

// Tile index containing a box's leading (top/left) edge.
export function firstTile(edge) {
    return Math.floor(edge / TILE);
}

// Tile index containing a box's trailing (bottom/right) edge. A box whose edge
// lies exactly on a tile boundary does not occupy the next tile.
export function lastTile(edge) {
    return Math.floor((edge - EDGE_EPSILON) / TILE);
}

const SOLID = new Set(["#", "=", "B", "V"]);
const STATIC_TILES = new Set(["#", "=", "-", "^", "B", "V"]);

export const VENT_PERIOD = 3.0;
export const VENT_ACTIVE = 1.2;
export const VENT_HEIGHT = 3;

export class World {
    constructor(level) {
        const rows = level.map;
        const width = rows[0]?.length ?? 0;
        rows.forEach((row, i) => {
            if (row.length !== width) {
                throw new Error(`Level "${level.id}" row ${i} has length ${row.length}, expected ${width}`);
            }
        });

        this.level = level;
        this.width = width;
        this.height = rows.length;
        this.pixelWidth = width * TILE;
        this.pixelHeight = this.height * TILE;
        this.tiles = [];
        this.spawns = [];
        this.vents = [];
        this.start = null;
        this.goal = null;

        for (let ty = 0; ty < this.height; ty++) {
            const line = [];
            const row = rows[ty] ?? "";
            for (let tx = 0; tx < width; tx++) {
                const ch = row[tx] ?? ".";
                if (STATIC_TILES.has(ch)) {
                    line.push(ch);
                    if (ch === "V") this.vents.push({ tx, ty });
                } else {
                    line.push(".");
                    if (ch === "S") this.start = { x: tx * TILE, y: ty * TILE };
                    else if (ch === "G") this.goal = { x: tx * TILE, y: ty * TILE };
                    else if (ch !== ".") this.spawns.push({ type: ch, x: tx * TILE, y: ty * TILE });
                }
            }
            this.tiles.push(line);
        }

        if (!this.start) throw new Error(`Level "${level.id}" has no start tile S`);
        if (!this.goal) throw new Error(`Level "${level.id}" has no goal tile G`);
    }

    tileAt(tx, ty) {
        if (tx < 0 || tx >= this.width) return "#";
        if (ty < 0 || ty >= this.height) return ".";
        return this.tiles[ty]?.[tx] ?? ".";
    }

    isSolid(tx, ty) {
        return SOLID.has(this.tileAt(tx, ty));
    }

    isOneWay(tx, ty) {
        return this.tileAt(tx, ty) === "-";
    }

    ventActive(vent, time) {
        const phase = ((vent.tx * 0.37) % 1) * VENT_PERIOD;
        return (time + phase) % VENT_PERIOD < VENT_ACTIVE;
    }

    // Steam column hitbox above a vent, in pixels.
    ventBox(vent) {
        return {
            x: vent.tx * TILE + 3,
            y: (vent.ty - VENT_HEIGHT) * TILE,
            w: TILE - 6,
            h: VENT_HEIGHT * TILE,
        };
    }

    goalBox() {
        if (!this.goal) throw new Error("World has no goal");
        return { x: this.goal.x, y: this.goal.y - TILE, w: TILE, h: TILE * 2 };
    }

    // True if the box touches spikes. Spikes only hurt on their lower part.
    touchesSpikes(x, y, w, h) {
        const x0 = firstTile(x);
        const x1 = lastTile(x + w);
        const y0 = firstTile(y);
        const y1 = lastTile(y + h);
        for (let ty = y0; ty <= y1; ty++) {
            for (let tx = x0; tx <= x1; tx++) {
                if (this.tileAt(tx, ty) !== "^") continue;
                const sx = tx * TILE + 2;
                const sy = ty * TILE + 7;
                if (overlaps(x, y, w, h, sx, sy, TILE - 4, TILE - 7)) return true;
            }
        }
        return false;
    }
}

export function overlaps(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
