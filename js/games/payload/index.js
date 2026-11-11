import { Board, makeRng } from "./board.js";
import { prepareSwap, stepPoints, tally, goalsMet, starsFor } from "./rules.js";
import { MISSIONS, TILE_NAMES } from "./missions.js";
import { BOARD_SIZE, TILE_TYPES } from "./config.js";
import { TILE_PX, TILE_COLORS, tileCanvases, drawRocketOverlay, drawFlare } from "./tiles.js";
import { VIEW_W, VIEW_H } from "../../core/screen.js";
import { drawText, drawPanel } from "../../core/text.js";
import { PORTRAIT, heroPalette, drawSprite } from "../../core/sprites.js";
import { drawSpaceBackdrop } from "../../core/backdrop.js";
import { MENU } from "../../core/bindings.js";
import { readStorage, writeStorage } from "../../core/storage.js";

const STARS_KEY = "frimout.payload.stars";
const CELL = 28;
const BOARD_X = VIEW_W - BOARD_SIZE * CELL - 14;
const BOARD_Y = 23;
const SWAP_TIME = 0.14;
const CLEAR_TIME = 0.24;
const FALL_GRAVITY = 70;
const HINT_DELAY = 6;

// Keys that grab/release on the board. Tap is excluded: pointers select directly.
const GRAB = ["Space", "Enter", "NumpadEnter", "PadA", "TouchA"];
const DIRS = [
    { codes: MENU.left, dx: -1, dy: 0 },
    { codes: MENU.right, dx: 1, dy: 0 },
    { codes: MENU.up, dx: 0, dy: -1 },
    { codes: MENU.down, dx: 0, dy: 1 },
];

const CHEERS = ["", "", "Goed zo!", "Schitterend!", "Fantastisch!", "Ongelooflijk!"];

const SONG = {
    tempo: 120,
    leadWave: "triangle",
    lead: [
        12, null, 16, null, 19, 16, 12, null, 14, null, 17, null, 21, 17, 14, null,
        16, null, 19, null, 24, 21, 19, 16, 14, 12, 11, 12, 14, null, null, null,
    ],
    bass: [-12, -12, -5, -5, -10, -10, -3, -3, -8, -8, -1, -1, -10, -10, -5, -5],
};

const CARD_W = 90;
const CARD_H = 50;
// Cards start right of the portrait in the bottom-left corner.
const cardRect = (i) => ({ x: 82 + (i % 4) * (CARD_W + 6), y: 96 + Math.floor(i / 4) * (CARD_H + 8), w: CARD_W, h: CARD_H });

export function createPayload(shell, params) {
    const game = new PayloadGame(shell);
    const mission = Number.parseInt(params.get("mission") ?? "", 10);
    if (mission >= 1 && mission <= MISSIONS.length) game.startMission(mission - 1);
    return game;
}

class PayloadGame {
    constructor(shell) {
        this.shell = shell;
        this.input = shell.input;
        this.sound = shell.sound;
        this.canvas = shell.canvas;
        this.state = "select";
        this.time = 0;
        this.stateTime = 0;
        this.best = readStars();
        this.sel = Math.min(this.unlockedCount() - 1, MISSIONS.length - 1);
        this.pointerQueue = [];
        this.particles = [];
        this.popups = [];
        this.beams = [];
        this.speech = null;
        this.missionIndex = 0;

        this.onPointer = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = ((e.clientX - rect.left) * VIEW_W) / rect.width;
            const y = ((e.clientY - rect.top) * VIEW_H) / rect.height;
            this.pointerQueue.push({ type: e.type, x, y });
        };
        for (const t of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) this.canvas.addEventListener(t, this.onPointer);
    }

    get pausable() {
        return this.state === "play";
    }

    get touchLayout() {
        return this.state === "play" || this.state === "select" ? "board" : "menu";
    }

    onPause() {
        this.sound.stopMusic();
    }

    onResume() {
        this.sound.startMusic(SONG);
    }

    dispose() {
        this.sound.stopMusic();
        for (const t of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) this.canvas.removeEventListener(t, this.onPointer);
    }

    get mission() {
        const m = MISSIONS[this.missionIndex];
        if (!m) throw new Error(`No mission at index ${this.missionIndex}`);
        return m;
    }

    unlockedCount() {
        let n = 1;
        while (n < MISSIONS.length && (this.best[n - 1] ?? 0) > 0) n++;
        return n;
    }

    setState(state) {
        this.state = state;
        this.stateTime = 0;
    }

    startMission(index) {
        this.missionIndex = index;
        this.board = new Board(BOARD_SIZE, BOARD_SIZE, TILE_TYPES, makeRng((Math.random() * 2 ** 32) >>> 0));
        this.pos = new Map();
        this.vel = new Map();
        this.forEachTile((t, x, y) => this.pos.set(t.id, { x, y, s: 1 }));
        this.score = 0;
        this.collected = new Array(TILE_TYPES).fill(0);
        this.movesLeft = this.mission.moves;
        this.phase = "idle";
        this.phaseTime = 0;
        this.idleTime = 0;
        this.selected = null;
        this.drag = null;
        this.cursor = { x: 3, y: 3 };
        this.showCursor = false;
        this.grabbed = false;
        this.hint = null;
        this.dying = [];
        this.beams = [];
        this.particles = [];
        this.popups = [];
        this.speech = null;
        this.setState("intro");
    }

    forEachTile(fn) {
        for (let y = 0; y < BOARD_SIZE; y++) {
            for (let x = 0; x < BOARD_SIZE; x++) {
                const t = this.board.get(x, y);
                if (t) fn(t, x, y);
            }
        }
    }

    // ---- update --------------------------------------------------------

    update(dt) {
        this.time += dt;
        this.stateTime += dt;
        this.particles = this.particles.filter((p) => {
            p.vy += 300 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.t -= dt;
            return p.t > 0;
        });
        this.popups = this.popups.filter((p) => (p.t -= dt) > 0);
        this.beams = this.beams.filter((b) => (b.t -= dt) > 0);
        if (this.speech && (this.speech.t -= dt) <= 0) this.speech = null;
        const pointers = this.pointerQueue;
        this.pointerQueue = [];

        switch (this.state) {
            case "select":
                this.updateSelect(pointers);
                break;
            case "intro":
                if (this.stateTime > 0.3 && this.input.pressed(MENU.confirm)) {
                    this.sound.play("select");
                    this.sound.startMusic(SONG);
                    this.setState("play");
                }
                break;
            case "play":
                this.updatePlay(dt, pointers);
                break;
            case "won":
                if (this.stateTime > 1 && this.input.pressed(MENU.confirm)) {
                    if (this.missionIndex >= MISSIONS.length - 1) this.setState("ending");
                    else this.startMission(this.missionIndex + 1);
                }
                break;
            case "lost":
                if (this.stateTime > 1 && this.input.pressed(MENU.confirm)) this.startMission(this.missionIndex);
                else if (this.stateTime > 0.5 && this.input.pressed(["Backspace", "PadB"])) this.toSelect();
                break;
            case "ending":
                if (this.stateTime > 1.5 && this.input.pressed(MENU.confirm)) this.toSelect();
                break;
            default:
                throw new Error(`Unknown state "${this.state}"`);
        }
    }

    toSelect() {
        this.sound.stopMusic();
        this.sel = Math.min(this.unlockedCount() - 1, MISSIONS.length - 1);
        this.setState("select");
    }

    updateSelect(pointers) {
        const unlocked = this.unlockedCount();
        const moves = [
            [MENU.left, -1],
            [MENU.right, 1],
            [MENU.up, -4],
            [MENU.down, 4],
        ];
        for (const [codes, d] of moves) {
            if (this.input.pressed(codes)) {
                const next = this.sel + d;
                if (next >= 0 && next < unlocked) {
                    this.sel = next;
                    this.sound.play("select");
                }
            }
        }
        for (const p of pointers) {
            if (p.type !== "pointerdown") continue;
            for (let i = 0; i < MISSIONS.length; i++) {
                const r = cardRect(i);
                if (p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h && i < unlocked) {
                    this.sel = i;
                    this.sound.play("select");
                    this.startMission(i);
                    return;
                }
            }
        }
        if (this.stateTime > 0.3 && this.input.pressed(GRAB)) {
            this.sound.play("select");
            this.startMission(this.sel);
        }
    }

    updatePlay(dt, pointers) {
        this.phaseTime += dt;
        switch (this.phase) {
            case "idle":
                this.updateIdle(dt, pointers);
                break;
            case "swap":
            case "unswap":
                if (this.phaseTime >= SWAP_TIME) this.finishSwap();
                break;
            case "clear":
                this.growCreated(dt);
                if (this.phaseTime >= CLEAR_TIME) this.startFall();
                break;
            case "fall":
                this.growCreated(dt);
                if (this.stepFall(dt)) {
                    this.combo++;
                    this.resolveStep({ pivots: [], forced: new Set(), flareTargets: new Map() });
                }
                break;
            case "settle":
                if (this.stepSettle(dt)) this.setPhase("idle");
                break;
            default:
                throw new Error(`Unknown phase "${this.phase}"`);
        }
    }

    setPhase(phase) {
        this.phase = phase;
        this.phaseTime = 0;
        if (phase === "idle") {
            this.idleTime = 0;
            this.hint = null;
        }
    }

    updateIdle(dt, pointers) {
        this.idleTime += dt;
        if (this.idleTime > HINT_DELAY && !this.hint) this.hint = this.board.findMove();

        for (const p of pointers) {
            const cell = cellAt(p.x, p.y);
            if (p.type === "pointerdown") {
                this.showCursor = false;
                if (!cell) {
                    this.selected = null;
                    continue;
                }
                if (this.selected && adjacent(this.selected, cell)) {
                    this.trySwap(this.selected, cell);
                    return;
                }
                this.selected = cell;
                this.drag = { cell, x: p.x, y: p.y };
            } else if (p.type === "pointermove" && this.drag) {
                const dx = p.x - this.drag.x;
                const dy = p.y - this.drag.y;
                if (Math.max(Math.abs(dx), Math.abs(dy)) > CELL * 0.45) {
                    const dir = Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
                    const target = { x: this.drag.cell.x + dir.x, y: this.drag.cell.y + dir.y };
                    const from = this.drag.cell;
                    this.drag = null;
                    if (inBoard(target)) {
                        this.trySwap(from, target);
                        return;
                    }
                }
            } else if (p.type === "pointerup" || p.type === "pointercancel") {
                this.drag = null;
            }
        }

        for (const d of DIRS) {
            if (!this.input.pressed(d.codes)) continue;
            this.showCursor = true;
            const target = { x: this.cursor.x + d.dx, y: this.cursor.y + d.dy };
            if (!inBoard(target)) continue;
            if (this.grabbed) {
                this.grabbed = false;
                this.trySwap({ ...this.cursor }, target);
                return;
            }
            this.cursor = target;
        }
        if (this.input.pressed(GRAB)) {
            this.showCursor = true;
            this.grabbed = !this.grabbed;
        }
    }

    trySwap(a, b) {
        this.selected = null;
        this.drag = null;
        this.hint = null;
        const valid = this.board.isValidSwap(a, b);
        this.swapAnim = { a, b, ta: this.board.get(a.x, a.y), tb: this.board.get(b.x, b.y), valid };
        this.sound.play("swap");
        this.setPhase("swap");
    }

    finishSwap() {
        const s = this.swapAnim;
        if (!s) throw new Error("finishSwap without a swap");
        if (this.phase === "unswap") {
            this.setPhase("idle");
            return;
        }
        if (!s.valid) {
            this.sound.play("invalid");
            this.setPhase("unswap");
            return;
        }
        this.movesLeft--;
        this.combo = 1;
        // Tiles visually arrived at their new cells.
        if (s.ta) this.pos.set(s.ta.id, { x: s.b.x, y: s.b.y, s: 1 });
        if (s.tb) this.pos.set(s.tb.id, { x: s.a.x, y: s.a.y, s: 1 });
        this.resolveStep(prepareSwap(this.board, s.a, s.b));
    }

    resolveStep(args) {
        const result = this.board.resolve(args.pivots, args.forced, args.flareTargets);
        if (!result) {
            this.endTurn();
            return;
        }
        const points = stepPoints(result, this.combo);
        this.score += points;
        tally(result, this.collected);

        this.dying = result.cleared.map((c) => ({ tile: c.tile, x: c.x, y: c.y }));
        for (const c of result.cleared) {
            this.pos.delete(c.tile.id);
            this.burst(c.x, c.y, c.tile.type);
        }
        for (const c of result.created) this.pos.set(c.tile.id, { x: c.x, y: c.y, s: 0 });
        this.beams = result.activated.map((a) => ({ ...a, t: CLEAR_TIME + 0.1 }));

        if (result.cleared.length > 0) {
            const cx = result.cleared.reduce((n, c) => n + c.x, 0) / result.cleared.length;
            const cy = result.cleared.reduce((n, c) => n + c.y, 0) / result.cleared.length;
            this.popups.push({ text: `+${points}`, x: BOARD_X + (cx + 0.5) * CELL, y: BOARD_Y + (cy + 0.5) * CELL, t: 0.9 });
        }
        this.sound.play("match", this.combo - 1);
        if (result.activated.some((a) => a.special === "flare")) {
            this.sound.play("flare");
            this.speech = { text: "Zonnevlam!", t: 1.6 };
        } else if (result.activated.length > 0) {
            this.sound.play("rocket");
        }
        const cheer = CHEERS[Math.min(this.combo, CHEERS.length - 1)];
        if (cheer) this.speech = { text: cheer, t: 1.4 };
        this.setPhase("clear");
    }

    burst(x, y, type) {
        const color = type >= 0 ? (TILE_COLORS[type] ?? "#ffffff") : "#ffd23f";
        const cx = BOARD_X + (x + 0.5) * CELL;
        const cy = BOARD_Y + (y + 0.5) * CELL;
        for (let i = 0; i < 5; i++) {
            const a = Math.random() * Math.PI * 2;
            const v = 40 + Math.random() * 70;
            this.particles.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, t: 0.5 + Math.random() * 0.3, color });
        }
    }

    growCreated(dt) {
        for (const p of this.pos.values()) if (p.s < 1) p.s = Math.min(1, p.s + dt * 5);
    }

    startFall() {
        this.dying = [];
        const { moved, added } = this.board.collapse();
        for (const m of moved) {
            const p = this.pos.get(m.tile.id);
            if (!p) this.pos.set(m.tile.id, { x: m.x, y: m.fromY, s: 1 });
        }
        for (const a of added) this.pos.set(a.tile.id, { x: a.x, y: a.fromY, s: 1 });
        this.vel = new Map();
        this.setPhase("fall");
    }

    // Moves tiles down toward their cells; true when all have landed.
    stepFall(dt) {
        let done = true;
        this.forEachTile((t, x, y) => {
            const p = this.pos.get(t.id) ?? { x, y, s: 1 };
            this.pos.set(t.id, p);
            p.x = x;
            if (p.y < y) {
                const v = (this.vel.get(t.id) ?? 0) + FALL_GRAVITY * dt;
                this.vel.set(t.id, v);
                p.y = Math.min(y, p.y + v * dt);
                if (p.y < y) done = false;
            } else {
                p.y = y;
            }
            if (p.s < 1) done = false;
        });
        return done;
    }

    stepSettle(dt) {
        let done = true;
        const k = 1 - Math.exp(-dt * 12);
        this.forEachTile((t, x, y) => {
            const p = this.pos.get(t.id) ?? { x, y, s: 1 };
            this.pos.set(t.id, p);
            p.x += (x - p.x) * k;
            p.y += (y - p.y) * k;
            if (Math.abs(p.x - x) > 0.01 || Math.abs(p.y - y) > 0.01) done = false;
            else {
                p.x = x;
                p.y = y;
            }
        });
        return done;
    }

    endTurn() {
        if (goalsMet(this.mission, this.score, this.collected)) {
            const stars = starsFor(this.mission, this.score);
            this.best[this.missionIndex] = Math.max(this.best[this.missionIndex] ?? 0, stars);
            writeStorage(STARS_KEY, JSON.stringify(this.best));
            this.wonStars = stars;
            this.sound.stopMusic();
            this.sound.play("win");
            this.setState("won");
            return;
        }
        if (this.movesLeft <= 0) {
            this.sound.stopMusic();
            this.sound.play("lose");
            this.setState("lost");
            return;
        }
        if (!this.board.findMove()) {
            this.board.shuffle();
            this.sound.play("shuffle");
            this.speech = { text: "Alles door elkaar!", t: 1.5 };
            this.setPhase("settle");
            return;
        }
        this.setPhase("idle");
    }

    // ---- drawing -------------------------------------------------------

    drawPixels(ctx) {
        drawSpaceBackdrop(ctx, this.time);
        if (this.state === "select" || this.state === "ending") {
            this.drawSelectPixels(ctx);
            return;
        }
        this.drawBoard(ctx);
        this.drawSidePixels(ctx);
    }

    drawSelectPixels(ctx) {
        const unlocked = this.unlockedCount();
        const bob = Math.round(Math.sin(this.time * 1.5) * 2);
        drawSprite(ctx, PORTRAIT, heroPalette("pumpkin"), 8, 180 + bob, false, 3);
        if (this.state === "ending") return;
        MISSIONS.forEach((m, i) => {
            const r = cardRect(i);
            const locked = i >= unlocked;
            ctx.fillStyle = locked ? "rgba(30,36,50,0.75)" : "rgba(20,40,80,0.85)";
            ctx.fillRect(r.x, r.y, r.w, r.h);
            ctx.strokeStyle = i === this.sel ? "#ffd23f" : locked ? "#3a4256" : "#5d7fb8";
            ctx.lineWidth = i === this.sel ? 2 : 1;
            ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
            const stars = this.best[i] ?? 0;
            for (let s = 0; s < 3; s++) drawStar(ctx, r.x + r.w / 2 - 14 + s * 14, r.y + r.h - 12, 5, s < stars ? "#ffd23f" : "#3a4256");
        });
    }

    drawBoard(ctx) {
        ctx.fillStyle = "rgba(6, 10, 24, 0.8)";
        ctx.fillRect(BOARD_X - 4, BOARD_Y - 4, BOARD_SIZE * CELL + 8, BOARD_SIZE * CELL + 8);
        for (let y = 0; y < BOARD_SIZE; y++) {
            for (let x = 0; x < BOARD_SIZE; x++) {
                ctx.fillStyle = (x + y) % 2 === 0 ? "rgba(60, 90, 150, 0.25)" : "rgba(60, 90, 150, 0.12)";
                ctx.fillRect(BOARD_X + x * CELL, BOARD_Y + y * CELL, CELL, CELL);
            }
        }
        if (this.state !== "play" && this.state !== "won" && this.state !== "lost") return;

        const highlight = (c, color) => {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.strokeRect(BOARD_X + c.x * CELL + 1, BOARD_Y + c.y * CELL + 1, CELL - 2, CELL - 2);
        };
        if (this.hint && Math.floor(this.time * 3) % 2 === 0) {
            highlight(this.hint.a, "rgba(255,255,255,0.6)");
            highlight(this.hint.b, "rgba(255,255,255,0.6)");
        }
        if (this.selected) highlight(this.selected, "#ffd23f");

        ctx.save();
        ctx.beginPath();
        ctx.rect(BOARD_X, BOARD_Y, BOARD_SIZE * CELL, BOARD_SIZE * CELL);
        ctx.clip();
        const swap = (this.phase === "swap" || this.phase === "unswap") && this.swapAnim ? this.swapAnim : null;
        let f = swap ? Math.min(1, this.phaseTime / SWAP_TIME) : 0;
        if (this.phase === "unswap") f = 1 - f;
        f = f * f * (3 - 2 * f);
        this.forEachTile((t, x, y) => {
            let p = this.pos.get(t.id) ?? { x, y, s: 1 };
            if (swap && t === swap.ta) p = { x: swap.a.x + (swap.b.x - swap.a.x) * f, y: swap.a.y + (swap.b.y - swap.a.y) * f, s: 1 };
            else if (swap && t === swap.tb) p = { x: swap.b.x + (swap.a.x - swap.b.x) * f, y: swap.b.y + (swap.a.y - swap.b.y) * f, s: 1 };
            else if (this.phase === "idle") p = { x, y, s: 1 };
            this.drawTile(ctx, t, p.x, p.y, p.s);
        });
        const shrink = 1 - Math.min(1, this.phaseTime / CLEAR_TIME);
        for (const d of this.dying) this.drawTile(ctx, d.tile, d.x, d.y, shrink);
        ctx.restore();

        for (const b of this.beams) {
            ctx.fillStyle = `rgba(200, 240, 255, ${Math.min(0.8, b.t * 3)})`;
            if (b.special === "row") ctx.fillRect(BOARD_X, BOARD_Y + b.y * CELL + CELL / 2 - 3, BOARD_SIZE * CELL, 6);
            else if (b.special === "col") ctx.fillRect(BOARD_X + b.x * CELL + CELL / 2 - 3, BOARD_Y, 6, BOARD_SIZE * CELL);
            else {
                ctx.fillStyle = `rgba(255, 220, 120, ${Math.min(0.5, b.t * 2)})`;
                ctx.fillRect(BOARD_X, BOARD_Y, BOARD_SIZE * CELL, BOARD_SIZE * CELL);
            }
        }

        for (const p of this.particles) {
            ctx.fillStyle = p.color;
            ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
        }

        if (this.showCursor && this.phase === "idle") {
            const c = this.cursor;
            ctx.strokeStyle = this.grabbed ? "#ff6a3d" : "#ffffff";
            ctx.lineWidth = 2;
            const pad = this.grabbed ? 0 : Math.floor(this.time * 4) % 2;
            ctx.strokeRect(BOARD_X + c.x * CELL + pad, BOARD_Y + c.y * CELL + pad, CELL - pad * 2, CELL - pad * 2);
        }
    }

    drawTile(ctx, tile, x, y, scale) {
        if (scale <= 0) return;
        const cx = BOARD_X + (x + 0.5) * CELL;
        const cy = BOARD_Y + (y + 0.5) * CELL;
        const size = TILE_PX * scale;
        if (tile.special === "flare") {
            drawFlare(ctx, cx, cy, size, this.time);
            return;
        }
        const img = tileCanvases()[tile.type];
        if (!img) return;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, Math.round(cx - size / 2), Math.round(cy - size / 2), Math.round(size), Math.round(size));
        if (tile.special === "row" || tile.special === "col") drawRocketOverlay(ctx, tile.special, cx, cy, size, this.time);
    }

    drawSidePixels(ctx) {
        const m = this.mission;
        // score bar with star ticks
        const max = m.stars[2] ?? m.target;
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.fillRect(12, 74, 200, 6);
        ctx.fillStyle = "#56d364";
        ctx.fillRect(12, 74, Math.round(200 * Math.min(1, this.score / max)), 6);
        m.stars.forEach((s) => {
            const x = 12 + Math.round((200 * s) / max);
            drawStar(ctx, Math.min(x, 210), 86, 4, this.score >= s ? "#ffd23f" : "#3a4256");
        });
        // goal icons
        const canv = tileCanvases();
        Object.keys(m.collect).forEach((type, i) => {
            const img = canv[Number(type)];
            if (img) ctx.drawImage(img, 14, 104 + i * 22, 18, 18);
        });
        const bob = Math.round(Math.sin(this.time * 1.5) * 2);
        drawSprite(ctx, PORTRAIT, heroPalette("polo"), 8, 196 + bob, false, 3);
        if (this.speech) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(62, 204, 156, 20);
            ctx.fillRect(56, 212, 6, 4);
        }
    }

    drawOverlay(c) {
        switch (this.state) {
            case "select":
                this.drawSelectText(c);
                break;
            case "intro":
                this.drawSideText(c);
                this.drawIntroPanel(c);
                break;
            case "play":
                this.drawSideText(c);
                break;
            case "won":
                this.drawSideText(c);
                drawPanel(c, [
                    "Mission complete!",
                    "",
                    "",
                    `Score ${this.score}   Moves left ${this.movesLeft}`,
                    "",
                    this.missionIndex >= MISSIONS.length - 1 ? "Press Enter" : "Press Enter for the next mission",
                ]);
                // Panel line 2 is left blank for the earned stars.
                for (let s = 0; s < 3; s++) {
                    drawStar(c, VIEW_W / 2 - 20 + s * 20, 127, 7, s < (this.wonStars ?? 0) ? "#ffd23f" : "#3a4256");
                }
                break;
            case "lost":
                this.drawSideText(c);
                drawPanel(c, ["Out of moves", "", this.goalSummary(), "", "Enter retry   Backspace missions"]);
                break;
            case "ending":
                this.drawEndingText(c);
                break;
            default:
                throw new Error(`Unknown state "${this.state}"`);
        }
    }

    goalSummary() {
        const m = this.mission;
        const parts = Object.entries(m.collect).map(([t, need]) => `${Math.min(this.collected[Number(t)] ?? 0, need)}/${need}`);
        return `Score ${this.score}/${m.target}   Goals ${parts.join(" ")}`;
    }

    drawSelectText(c) {
        drawText(c, "PAYLOAD SWAP", VIEW_W / 2, 24, 18, "#ffd23f", "center");
        drawText(c, "Match three or more along the STS-45 flight", VIEW_W / 2, 52, 6, "#cfe0f5", "center");
        drawText(c, "4 in a row: rocket   5 in a row: solar flare", VIEW_W / 2, 64, 6, "#cfe0f5", "center");
        const unlocked = this.unlockedCount();
        MISSIONS.forEach((m, i) => {
            const r = cardRect(i);
            const locked = i >= unlocked;
            drawText(c, `${i + 1}`, r.x + 6, r.y + 6, 6, locked ? "#5a6478" : "#8fa3bd");
            drawText(c, locked ? "Locked" : m.title, r.x + r.w / 2, r.y + 18, 5, locked ? "#5a6478" : "#ffffff", "center");
        });
        drawText(c, "Arrows choose   Enter or tap play   Esc back", VIEW_W / 2 + 20, 238, 6, "#8fa3bd", "center");
        const total = this.best.reduce((n, s) => n + (s ?? 0), 0);
        drawText(c, `Stars ${total}/${MISSIONS.length * 3}`, VIEW_W - 10, 252, 6, "#ffd23f", "right");
    }

    drawSideText(c) {
        const m = this.mission;
        drawText(c, `Mission ${this.missionIndex + 1}: ${m.title}`, 12, 10, 6, "#ffd23f");
        drawText(c, "MOVES", 12, 28, 5, "#8fa3bd");
        drawText(c, String(this.movesLeft), 12, 38, 14, this.movesLeft <= 3 ? "#ff6b6b" : "#ffffff");
        drawText(c, "SCORE", 110, 28, 5, "#8fa3bd");
        drawText(c, String(this.score), 110, 40, 9, "#ffffff");
        drawText(c, `Target ${m.target}`, 110, 56, 5, "#8fa3bd");
        Object.entries(m.collect).forEach(([type, need], i) => {
            const have = Math.min(this.collected[Number(type)] ?? 0, need);
            const done = have >= need;
            drawText(c, `${TILE_NAMES[Number(type)] ?? ""}`, 38, 106 + i * 22, 5, "#cfe0f5");
            drawText(c, done ? "Done!" : `${have}/${need}`, 38, 115 + i * 22, 6, done ? "#56d364" : "#ffffff");
        });
        for (const p of this.popups) {
            drawText(c, p.text, p.x, p.y - (0.9 - p.t) * 30, 7, "#ffffff", "center");
        }
        if (this.speech) drawText(c, this.speech.text, 140, 210, 6, "#1d1d28", "center");
    }

    drawIntroPanel(c) {
        const m = this.mission;
        const goals = Object.entries(m.collect).map(([t, n]) => `${n} ${TILE_NAMES[Number(t)] ?? ""}`);
        drawPanel(c, [m.title, "", m.note, "", `Collect: ${goals.join(", ")}`, `Score ${m.target} in ${m.moves} moves`, "", "Press Enter or tap"]);
    }

    drawEndingText(c) {
        const total = this.best.reduce((n, s) => n + (s ?? 0), 0);
        drawText(c, "Proficiat!", VIEW_W / 2 + 30, 60, 16, "#ffd23f", "center");
        drawText(c, "All eight missions are complete.", VIEW_W / 2 + 30, 96, 7, "#ffffff", "center");
        drawText(c, "Atlantis is home, and so is Dirk Frimout,", VIEW_W / 2 + 30, 116, 6, "#cfe0f5", "center");
        drawText(c, "the first Belgian in space.", VIEW_W / 2 + 30, 128, 6, "#cfe0f5", "center");
        drawText(c, `Stars ${total}/${MISSIONS.length * 3}`, VIEW_W / 2 + 30, 156, 8, "#ffd23f", "center");
        if (this.stateTime > 1.5 && Math.floor(this.time * 2) % 2 === 0) {
            drawText(c, "Press Enter for the mission list", VIEW_W / 2 + 30, 200, 7, "#ffd23f", "center");
        }
    }
}

function cellAt(px, py) {
    const x = Math.floor((px - BOARD_X) / CELL);
    const y = Math.floor((py - BOARD_Y) / CELL);
    return inBoard({ x, y }) ? { x, y } : null;
}

function inBoard(c) {
    return c.x >= 0 && c.y >= 0 && c.x < BOARD_SIZE && c.y < BOARD_SIZE;
}

function adjacent(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

function drawStar(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 === 0 ? r : r * 0.45;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
}

function readStars() {
    try {
        const raw = JSON.parse(readStorage(STARS_KEY, "[]"));
        if (!Array.isArray(raw)) return [];
        return MISSIONS.map((_, i) => {
            const v = raw[i];
            return typeof v === "number" && v >= 0 && v <= 3 ? v : 0;
        });
    } catch {
        return [];
    }
}
