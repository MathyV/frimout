// Match-3 board logic for Payload Swap. Pure, no DOM, so tools can load it.
//
// A tile is { id, type, special }:
//   type     0..types-1, or -1 for a flare (it matches nothing)
//   special  null | "row" | "col" | "flare"
// Coordinates are (x, y) with y = 0 at the top.

export const SCORE_PER_TILE = 60;
export const SPECIAL_BONUS = 200;

// Small seeded PRNG (mulberry32) so playouts are reproducible.
export function makeRng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const key = (x, y) => y * 64 + x;
const unkey = (k) => ({ x: k % 64, y: Math.floor(k / 64) });

export class Board {
    constructor(width, height, types, rng) {
        this.width = width;
        this.height = height;
        this.types = types;
        this.rng = rng;
        this.nextId = 1;
        this.grid = [];
        this.fillFresh();
    }

    // Copy for look-ahead; refills on the copy use the given rng.
    clone(rng) {
        const copy = Object.create(Board.prototype);
        copy.width = this.width;
        copy.height = this.height;
        copy.types = this.types;
        copy.rng = rng;
        copy.nextId = this.nextId;
        copy.grid = this.grid.map((row) => row.map((t) => (t ? { ...t } : null)));
        return copy;
    }

    newTile(type, special = null) {
        return { id: this.nextId++, type, special };
    }

    randomType() {
        return Math.floor(this.rng() * this.types);
    }

    get(x, y) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
        return this.grid[y]?.[x] ?? null;
    }

    set(x, y, tile) {
        const row = this.grid[y];
        if (!row) throw new Error(`Row ${y} out of range`);
        row[x] = tile;
    }

    // Fills the board with no ready-made matches and at least one valid move.
    fillFresh() {
        for (let attempt = 0; attempt < 100; attempt++) {
            this.grid = [];
            for (let y = 0; y < this.height; y++) {
                const row = [];
                this.grid.push(row);
                for (let x = 0; x < this.width; x++) {
                    let type;
                    do {
                        type = this.randomType();
                    } while (
                        (x >= 2 && row[x - 1]?.type === type && row[x - 2]?.type === type) ||
                        (y >= 2 && this.grid[y - 1]?.[x]?.type === type && this.grid[y - 2]?.[x]?.type === type)
                    );
                    row.push(this.newTile(type));
                }
            }
            if (this.findMove()) return;
        }
        throw new Error("Could not generate a playable board");
    }

    // Keeps the tiles but rearranges them until there is a move and no match.
    shuffle() {
        const tiles = this.grid.flat().filter((t) => t !== null);
        for (let attempt = 0; attempt < 200; attempt++) {
            for (let i = tiles.length - 1; i > 0; i--) {
                const j = Math.floor(this.rng() * (i + 1));
                const a = tiles[i];
                const b = tiles[j];
                if (a && b) {
                    tiles[i] = b;
                    tiles[j] = a;
                }
            }
            let i = 0;
            for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) this.set(x, y, tiles[i++] ?? null);
            if (this.findMatches().cells.size === 0 && this.findMove()) return;
        }
        this.fillFresh();
    }

    swap(a, b) {
        const ta = this.get(a.x, a.y);
        const tb = this.get(b.x, b.y);
        this.set(a.x, a.y, tb);
        this.set(b.x, b.y, ta);
    }

    // Runs of 3+ equal types, horizontal and vertical.
    findMatches() {
        const runs = [];
        const cells = new Set();
        const scan = (dir) => {
            const outer = dir === "h" ? this.height : this.width;
            const inner = dir === "h" ? this.width : this.height;
            for (let o = 0; o < outer; o++) {
                let start = 0;
                for (let i = 1; i <= inner; i++) {
                    const at = (n) => (dir === "h" ? this.get(n, o) : this.get(o, n));
                    const cur = i < inner ? at(i) : null;
                    const first = at(start);
                    const same = cur && first && cur.type >= 0 && cur.type === first.type;
                    if (same) continue;
                    const len = i - start;
                    if (len >= 3 && first && first.type >= 0) {
                        const run = [];
                        for (let n = start; n < i; n++) run.push(dir === "h" ? { x: n, y: o } : { x: o, y: n });
                        runs.push({ dir, type: first.type, cells: run });
                        for (const c of run) cells.add(key(c.x, c.y));
                    }
                    start = i;
                }
            }
        };
        scan("h");
        scan("v");
        return { runs, cells };
    }

    // True if swapping a and b is a legal move.
    isValidSwap(a, b) {
        if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) !== 1) return false;
        const ta = this.get(a.x, a.y);
        const tb = this.get(b.x, b.y);
        if (!ta || !tb) return false;
        if (ta.special === "flare" || tb.special === "flare") return true;
        this.swap(a, b);
        const ok = this.findMatches().cells.size > 0;
        this.swap(a, b);
        return ok;
    }

    allMoves() {
        const moves = [];
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const a = { x, y };
                for (const b of [{ x: x + 1, y }, { x, y: y + 1 }]) {
                    if (this.isValidSwap(a, b)) moves.push({ a, b });
                }
            }
        }
        return moves;
    }

    findMove() {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const a = { x, y };
                for (const b of [{ x: x + 1, y }, { x, y: y + 1 }]) {
                    if (this.isValidSwap(a, b)) return { a, b };
                }
            }
        }
        return null;
    }

    mostCommonType() {
        const counts = new Array(this.types).fill(0);
        for (const row of this.grid) for (const t of row) if (t && t.type >= 0) counts[t.type]++;
        let best = 0;
        counts.forEach((c, i) => {
            if (c > (counts[best] ?? 0)) best = i;
        });
        return best;
    }

    // One clearing step. pivots: cells where new specials should appear
    // (usually the two swapped cells). forced: extra cell keys to clear, with
    // flareTargets mapping a flare's cell key to the type it should wipe out.
    // Returns null when nothing clears.
    resolve(pivots = [], forced = new Set(), flareTargets = new Map()) {
        const { runs, cells } = this.findMatches();
        if (cells.size === 0 && forced.size === 0) return null;

        // Specials created by long runs.
        const created = new Map();
        const pivotKeys = pivots.map((p) => key(p.x, p.y));
        for (const run of runs) {
            if (run.cells.length < 4) continue;
            const inRun = run.cells.find((c) => pivotKeys.includes(key(c.x, c.y)));
            const at = inRun ?? run.cells[Math.floor(run.cells.length / 2)];
            if (!at) continue;
            const k = key(at.x, at.y);
            const special = run.cells.length >= 5 ? "flare" : run.dir === "h" ? "row" : "col";
            const prev = created.get(k);
            if (prev && prev.special === "flare") continue;
            created.set(k, { x: at.x, y: at.y, special, type: special === "flare" ? -1 : run.type });
        }

        const clear = new Set([...cells, ...forced]);
        const activated = [];
        const queue = [...clear];
        const seenSpecial = new Set();
        while (queue.length > 0) {
            const k = queue.pop();
            if (k === undefined) break;
            const { x, y } = unkey(k);
            const tile = this.get(x, y);
            if (!tile || !tile.special || seenSpecial.has(k)) continue;
            seenSpecial.add(k);
            const add = (cx, cy) => {
                const ck = key(cx, cy);
                if (!this.get(cx, cy) || clear.has(ck)) return;
                clear.add(ck);
                queue.push(ck);
            };
            if (tile.special === "row") {
                for (let cx = 0; cx < this.width; cx++) add(cx, y);
                activated.push({ x, y, special: "row" });
            } else if (tile.special === "col") {
                for (let cy = 0; cy < this.height; cy++) add(x, cy);
                activated.push({ x, y, special: "col" });
            } else if (tile.special === "flare") {
                const target = flareTargets.get(k) ?? this.mostCommonType();
                for (let cy = 0; cy < this.height; cy++) {
                    for (let cx = 0; cx < this.width; cx++) if (this.get(cx, cy)?.type === target) add(cx, cy);
                }
                activated.push({ x, y, special: "flare", target });
            }
        }

        const cleared = [];
        for (const k of clear) {
            const { x, y } = unkey(k);
            const tile = this.get(x, y);
            if (!tile) continue;
            cleared.push({ x, y, tile });
            this.set(x, y, null);
        }
        const spawned = [];
        for (const c of created.values()) {
            const tile = this.newTile(c.type, c.special);
            this.set(c.x, c.y, tile);
            spawned.push({ x: c.x, y: c.y, tile });
        }
        return { cleared, created: spawned, activated };
    }

    // Drops tiles into gaps and refills from the top.
    collapse() {
        const moved = [];
        const added = [];
        for (let x = 0; x < this.width; x++) {
            let write = this.height - 1;
            for (let y = this.height - 1; y >= 0; y--) {
                const t = this.get(x, y);
                if (!t) continue;
                if (write !== y) {
                    this.set(x, write, t);
                    this.set(x, y, null);
                    moved.push({ tile: t, x, fromY: y, toY: write });
                }
                write--;
            }
            const missing = write + 1;
            for (let y = write; y >= 0; y--) {
                const t = this.newTile(this.randomType());
                this.set(x, y, t);
                added.push({ tile: t, x, fromY: y - missing, toY: y });
            }
        }
        return { moved, added };
    }
}

export { key as cellKey };
