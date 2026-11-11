import { LEVELS, ENDING } from "./levels.js";
import { World, overlaps } from "./world.js";
import { Player, physicsFor, PLAYER_W, PLAYER_H } from "./player.js";
import { spawnEntities } from "./entities.js";
import { HERO_FRAMES, HERO_W, HERO_H, PORTRAIT, heroPalette, drawSprite } from "./sprites.js";
import {
    VIEW_W,
    VIEW_H,
    FONT,
    drawBackground,
    drawTiles,
    drawCollectible,
    drawCheckpoint,
    drawGoal,
    drawEnemy,
    drawText,
    drawShuttleStack,
    drawOrbiter,
} from "./render.js";
import { Input } from "./input.js";
import { Sound } from "./audio.js";

const DT = 1 / 60;
const PROGRESS_KEY = "frimout.progress";
const DEATH_TIME = 0.9;
const INVULNERABLE_TIME = 1.2;
const LAUNCH_AFTER = "pad39a";
const CUTSCENE_TIME = 6;

const canvas = requireElement("game", HTMLCanvasElement);
const screenCtx = requireContext(canvas);
const low = document.createElement("canvas");
low.width = VIEW_W;
low.height = VIEW_H;
const ctx = requireContext(low);

const input = new Input();
const sound = new Sound();
input.onGesture(() => sound.unlock());
input.bindTap(canvas);
input.bindTouchButtons(document);

class Game {
    constructor() {
        this.state = "title";
        this.time = 0;
        this.stateTime = 0;
        this.menuIndex = 0;
        this.paused = false;
        this.levelIndex = 0;
        this.results = [];
        this.toast = null;
        this.progress = readProgress();
        this.loadLevel(0);
    }

    get level() {
        const level = LEVELS[this.levelIndex];
        if (!level) throw new Error(`No level at index ${this.levelIndex}`);
        return level;
    }

    setState(state) {
        this.state = state;
        this.stateTime = 0;
    }

    loadLevel(index) {
        this.levelIndex = index;
        const level = this.level;
        this.world = new World(level);
        this.physics = physicsFor(level);
        const { enemies, pickups, checkpoints } = spawnEntities(this.world);
        this.enemies = enemies;
        this.pickups = pickups;
        this.checkpoints = checkpoints;
        this.respawn = { ...this.world.start };
        this.player = new Player(this.respawn.x, this.respawn.y, this.physics);
        this.collected = 0;
        this.deaths = 0;
        this.levelTime = 0;
        this.invulnerable = 0;
        this.deathTimer = 0;
        this.snapCamera();
    }

    startLevel(index) {
        this.loadLevel(index);
        this.setState("intro");
    }

    snapCamera() {
        const target = this.cameraTarget();
        this.camX = target.x;
        this.camY = target.y;
    }

    cameraTarget() {
        const p = this.player;
        let x = p.x + PLAYER_W / 2 - VIEW_W / 2 + p.facing * 24;
        let y = p.y + PLAYER_H / 2 - VIEW_H / 2 - 10;
        x = clamp(x, 0, Math.max(0, this.world.pixelWidth - VIEW_W));
        y = this.world.pixelHeight <= VIEW_H ? this.world.pixelHeight - VIEW_H : clamp(y, 0, this.world.pixelHeight - VIEW_H);
        return { x, y };
    }

    update(dt) {
        this.time += dt;
        this.stateTime += dt;
        if (input.pressed("mute")) {
            const muted = sound.toggleMute();
            this.toast = { text: muted ? "Sound off" : "Sound on", t: 1.5 };
        }
        if (this.toast) {
            this.toast.t -= dt;
            if (this.toast.t <= 0) this.toast = null;
        }

        switch (this.state) {
            case "title":
                this.updateTitle();
                break;
            case "intro":
                if (this.stateTime > 0.3 && confirmPressed()) {
                    sound.play("select");
                    sound.startMusic(this.level.gravityScale < 1 ? 112 : 140);
                    this.setState("play");
                }
                break;
            case "play":
                this.updatePlay(dt);
                break;
            case "dying":
                this.updateDying(dt);
                break;
            case "complete":
                if (this.stateTime > 0.8 && confirmPressed()) this.afterLevel();
                break;
            case "launch":
            case "landing":
                if ((this.stateTime > 0.5 && confirmPressed()) || this.stateTime > CUTSCENE_TIME) {
                    if (this.state === "launch") this.startLevel(this.levelIndex + 1);
                    else this.setState("ending");
                }
                break;
            case "ending":
                if (this.stateTime > 1.5 && confirmPressed()) {
                    this.results = [];
                    this.menuIndex = 0;
                    this.setState("title");
                }
                break;
            default:
                throw new Error(`Unknown state "${this.state}"`);
        }
    }

    updateTitle() {
        const hasContinue = this.progress > 0;
        if (hasContinue && (input.pressed("left") || input.pressed("right"))) {
            this.menuIndex = 1 - this.menuIndex;
            sound.play("select");
        }
        if (this.stateTime > 0.3 && confirmPressed()) {
            sound.play("select");
            this.results = [];
            this.startLevel(hasContinue && this.menuIndex === 1 ? this.progress : 0);
        }
    }

    updatePlay(dt) {
        if (input.pressed("pause")) {
            this.paused = !this.paused;
            if (this.paused) sound.stopMusic();
            else sound.startMusic(this.level.gravityScale < 1 ? 112 : 140);
        }
        if (this.paused) return;

        this.levelTime += dt;
        this.invulnerable = Math.max(0, this.invulnerable - dt);
        const p = this.player;
        const events = p.step(
            this.world,
            {
                left: input.isHeld("left"),
                right: input.isHeld("right"),
                jumpPressed: input.pressed("jump"),
                jumpHeld: input.isHeld("jump"),
            },
            dt,
        );
        for (const e of events) sound.play(e);

        for (const enemy of this.enemies) enemy.update(this.world, dt);
        this.enemies = this.enemies.filter((e) => e.alive || e.squash < 1);

        for (const item of this.pickups) {
            item.t += dt;
            if (!item.taken && overlaps(p.x, p.y, PLAYER_W, PLAYER_H, item.x, item.y, item.w, item.h)) {
                item.taken = true;
                this.collected++;
                sound.play("pickup");
            }
        }

        for (const cp of this.checkpoints) {
            if (!cp.active && overlaps(p.x, p.y, PLAYER_W, PLAYER_H, cp.x, cp.y, cp.w, cp.h)) {
                this.checkpoints.forEach((c) => (c.active = false));
                cp.active = true;
                this.respawn = { x: cp.tileX, y: cp.tileY };
                sound.play("checkpoint");
            }
        }

        let hurt = false;
        for (const enemy of this.enemies) {
            if (!enemy.alive) continue;
            if (!overlaps(p.x, p.y, PLAYER_W, PLAYER_H, enemy.x, enemy.y, enemy.w, enemy.h)) continue;
            const stomp = p.vy > 0 && p.y + PLAYER_H - enemy.y < 8;
            if (stomp) {
                enemy.alive = false;
                p.bounce();
                sound.play("stomp");
            } else if (this.invulnerable <= 0) {
                hurt = true;
            }
        }

        if (this.invulnerable <= 0) {
            if (this.world.touchesSpikes(p.x, p.y, PLAYER_W, PLAYER_H)) hurt = true;
            for (const vent of this.world.vents) {
                const b = this.world.ventBox(vent);
                if (this.world.ventActive(vent, this.time) && overlaps(p.x, p.y, PLAYER_W, PLAYER_H, b.x, b.y, b.w, b.h)) hurt = true;
            }
        }
        if (p.y > this.world.pixelHeight + 32) hurt = true;

        if (hurt) {
            this.deaths++;
            this.deathTimer = 0;
            sound.play("die");
            this.setState("dying");
            return;
        }

        const g = this.world.goalBox();
        if (overlaps(p.x, p.y, PLAYER_W, PLAYER_H, g.x, g.y, g.w, g.h)) {
            sound.stopMusic();
            sound.play("goal");
            this.results[this.levelIndex] = {
                title: this.level.title,
                collected: this.collected,
                total: this.pickups.length,
                deaths: this.deaths,
                time: this.levelTime,
            };
            this.progress = Math.max(this.progress, Math.min(this.levelIndex + 1, LEVELS.length - 1));
            writeProgress(this.progress);
            this.setState("complete");
            return;
        }

        this.followCamera(dt);
    }

    followCamera(dt) {
        const target = this.cameraTarget();
        const k = 1 - Math.exp(-dt * 7);
        this.camX += (target.x - this.camX) * k;
        this.camY += (target.y - this.camY) * k;
    }

    updateDying(dt) {
        this.deathTimer += dt;
        for (const enemy of this.enemies) enemy.update(this.world, dt);
        if (this.deathTimer >= DEATH_TIME) {
            this.player = new Player(this.respawn.x, this.respawn.y, this.physics);
            this.invulnerable = INVULNERABLE_TIME;
            this.snapCamera();
            this.setState("play");
        }
    }

    afterLevel() {
        const id = this.level.id;
        if (this.levelIndex >= LEVELS.length - 1) {
            this.setState("landing");
        } else if (id === LAUNCH_AFTER) {
            this.setState("launch");
        } else {
            this.startLevel(this.levelIndex + 1);
        }
    }

    // ---- drawing -------------------------------------------------------

    draw() {
        ctx.imageSmoothingEnabled = false;
        switch (this.state) {
            case "title":
            case "ending":
                this.drawSpaceBackdrop();
                break;
            case "launch":
                this.drawLaunch();
                break;
            case "landing":
                this.drawLanding();
                break;
            default:
                this.drawWorld();
        }

        screenCtx.setTransform(1, 0, 0, 1, 0, 0);
        screenCtx.imageSmoothingEnabled = false;
        screenCtx.drawImage(low, 0, 0, canvas.width, canvas.height);
        const s = canvas.width / VIEW_W;
        screenCtx.setTransform(s, 0, 0, s, 0, 0);

        switch (this.state) {
            case "title":
                this.drawTitleText();
                break;
            case "intro":
                this.drawIntroText();
                break;
            case "play":
            case "dying":
                this.drawHud();
                if (this.paused) this.drawPanel(["Paused", "", "Press P or Esc to resume"]);
                break;
            case "complete":
                this.drawHud();
                this.drawComplete();
                break;
            case "launch":
                this.drawCaption("STS-45  |  24 March 1992", "Atlantis lifts off from Pad 39A");
                break;
            case "landing":
                this.drawCaption("2 April 1992", "Wheels stop at Kennedy Space Center");
                break;
            case "ending":
                this.drawEndingText();
                break;
            default:
                throw new Error(`Unknown state "${this.state}"`);
        }
        if (this.toast) drawText(screenCtx, this.toast.text, VIEW_W - 8, VIEW_H - 16, 6, "#ffffff", "right");
    }

    drawWorld() {
        const camX = Math.round(this.camX);
        const camY = Math.round(this.camY);
        const level = this.level;
        drawBackground(ctx, level, camX, camY, this.time);
        drawTiles(ctx, this.world, camX, camY, this.time);
        for (const cp of this.checkpoints) drawCheckpoint(ctx, cp, camX, camY, this.time);
        drawGoal(ctx, level, this.world, camX, camY, this.time);
        for (const item of this.pickups) {
            if (!item.taken) drawCollectible(ctx, level.collectible, Math.round(item.x - camX), Math.round(item.y - camY), item.t);
        }
        for (const enemy of this.enemies) drawEnemy(ctx, level.theme, enemy, camX, camY);
        this.drawPlayer(camX, camY);
    }

    drawPlayer(camX, camY) {
        const p = this.player;
        const palette = heroPalette(this.level.outfit);
        let frame = HERO_FRAMES.idle;
        if (!p.onGround) frame = HERO_FRAMES.jump;
        else if (Math.abs(p.vx) > 10) frame = Math.floor(p.animTime * 10) % 2 === 0 ? HERO_FRAMES.run1 : HERO_FRAMES.run2;
        if (!frame) return;

        const x = Math.round(p.x + PLAYER_W / 2 - HERO_W / 2 - camX);
        let y = Math.round(p.y + PLAYER_H - HERO_H - camY);
        if (this.state === "dying") {
            const t = this.deathTimer;
            y += Math.round(-60 * t + 180 * t * t);
            frame = HERO_FRAMES.jump ?? frame;
        } else if (this.invulnerable > 0 && Math.floor(this.invulnerable * 12) % 2 === 0) {
            return;
        }
        drawSprite(ctx, frame, palette, x, y, p.facing < 0);
    }

    drawSpaceBackdrop() {
        const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
        g.addColorStop(0, "#02030a");
        g.addColorStop(1, "#0d1838");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        for (let i = 0; i < 120; i++) {
            const x = (Math.sin(i * 91.7) * 0.5 + 0.5) * VIEW_W;
            const y = (Math.sin(i * 47.3 + 1) * 0.5 + 0.5) * VIEW_H;
            ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(this.time * 0.8 + i));
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
        }
        ctx.globalAlpha = 1;
        // Earth limb
        ctx.fillStyle = "#3d7fd0";
        ctx.beginPath();
        ctx.arc(VIEW_W / 2, VIEW_H + 420, 470, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(140, 200, 255, 0.6)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(VIEW_W / 2, VIEW_H + 420, 472, Math.PI, Math.PI * 2);
        ctx.stroke();

        const outfit = this.state === "ending" ? "polo" : "pumpkin";
        const bob = Math.round(Math.sin(this.time * 1.5) * 3);
        drawSprite(ctx, PORTRAIT, heroPalette(outfit), 44, 72 + bob, false, 6);
    }

    drawLaunch() {
        const t = this.stateTime;
        const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
        g.addColorStop(0, "#3c5f98");
        g.addColorStop(1, "#ffa86a");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        ctx.fillStyle = "#2f5f8f";
        ctx.fillRect(0, 230, VIEW_W, 40);
        ctx.fillStyle = "#77746f";
        ctx.fillRect(170, 222, 140, 10);
        // launch tower
        ctx.fillStyle = "#b23a2b";
        ctx.fillRect(196, 90, 10, 132);
        for (let y = 96; y < 222; y += 12) ctx.fillRect(196, y, 22, 2);

        const ignition = 1.2;
        const rise = t < ignition ? 0 : 0.5 * 60 * (t - ignition) * (t - ignition);
        const baseY = 222 - rise;
        if (t > ignition - 0.3) {
            for (let i = 0; i < 40; i++) {
                const age = (t * 1.3 + i * 0.13) % 2;
                const spread = age * 60;
                const x = 240 + Math.sin(i * 12.9) * spread;
                const y = 226 - age * 8 + Math.cos(i * 3.1) * 4;
                ctx.fillStyle = `rgba(235,235,235,${0.75 - age * 0.3})`;
                ctx.fillRect(Math.round(x), Math.round(y), 10 + Math.round(age * 6), 8);
            }
        }
        drawShuttleStack(ctx, 240, Math.round(baseY), t > ignition - 0.2);
    }

    drawLanding() {
        const t = Math.min(this.stateTime / (CUTSCENE_TIME - 1.5), 1);
        const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
        g.addColorStop(0, "#6aa7dc");
        g.addColorStop(1, "#f4d9b0");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        ctx.fillStyle = "#5c8f3e";
        ctx.fillRect(0, 222, VIEW_W, 48);
        ctx.fillStyle = "#4a4a4f";
        ctx.fillRect(0, 226, VIEW_W, 12);
        ctx.fillStyle = "#f4f4f4";
        for (let x = 0; x < VIEW_W; x += 32) ctx.fillRect(x + Math.round(t * 64) % 32, 231, 14, 2);

        const ease = 1 - Math.pow(1 - t, 2);
        const x = -60 + ease * 330;
        const y = 40 + ease * 180;
        const ox = Math.round(x);
        const oy = Math.round(y);
        if (t > 0.6) {
            // landing gear
            ctx.fillStyle = "#2a2a2e";
            ctx.fillRect(ox - 14, oy + 5, 2, 4);
            ctx.fillRect(ox + 30, oy + 5, 2, 4);
            ctx.fillRect(ox - 16, oy + 8, 6, 3);
            ctx.fillRect(ox + 28, oy + 8, 5, 3);
        }
        drawOrbiter(ctx, ox, oy);
    }

    drawTitleText() {
        const c = screenCtx;
        drawText(c, "FRIMOUT", 300, 40, 24, "#ffd23f", "center");
        drawText(c, "Journey to the Stars", 300, 74, 8, "#ffffff", "center");
        drawText(c, "A tribute to Dirk Frimout,", 300, 100, 6, "#cfe0f5", "center");
        drawText(c, "the first Belgian in space", 300, 110, 6, "#cfe0f5", "center");
        drawText(c, "(STS-45, Space Shuttle Atlantis, 1992)", 300, 120, 6, "#cfe0f5", "center");

        const hasContinue = this.progress > 0;
        const items = hasContinue ? ["New game", `Continue: ${LEVELS[this.progress]?.title ?? ""}`] : ["Start"];
        items.forEach((label, i) => {
            const selected = i === (hasContinue ? this.menuIndex : 0);
            const blink = selected && Math.floor(this.time * 2.5) % 2 === 0;
            drawText(c, `${selected ? ">" : " "} ${label}`, 300, 150 + i * 14, 8, selected ? (blink ? "#ffffff" : "#ffd23f") : "#8fa3bd", "center");
        });

        drawText(c, "Arrows/WASD move  Space/Up jump", 300, 196, 6, "#8fa3bd", "center");
        drawText(c, hasContinue ? "Left/Right choose  Enter start" : "Press Enter or tap to start", 300, 206, 6, "#8fa3bd", "center");
        drawText(c, "P pause  M sound", 300, 216, 6, "#8fa3bd", "center");
    }

    drawIntroText() {
        const c = screenCtx;
        c.fillStyle = "rgba(4, 8, 20, 0.78)";
        c.fillRect(0, 0, VIEW_W, VIEW_H);
        const level = this.level;
        drawText(c, `Chapter ${this.levelIndex + 1} of ${LEVELS.length}`, VIEW_W / 2, 44, 6, "#8fa3bd", "center");
        drawText(c, level.title, VIEW_W / 2, 60, 14, "#ffd23f", "center");
        drawText(c, level.year, VIEW_W / 2, 84, 8, "#ffffff", "center");
        let y = 112;
        for (const line of wrap(c, level.intro, 7, VIEW_W - 40)) {
            drawText(c, line, VIEW_W / 2, y, 7, "#e9f1fb", "center");
            y += 13;
        }
        if (Math.floor(this.time * 2) % 2 === 0) drawText(c, "Press Enter or tap", VIEW_W / 2, 230, 7, "#ffd23f", "center");
    }

    drawHud() {
        const c = screenCtx;
        c.fillStyle = "rgba(0,0,0,0.35)";
        c.fillRect(0, 0, VIEW_W, 16);
        drawText(c, this.level.title, 6, 5, 6, "#ffffff");
        drawCollectibleIcon(c, this.level.collectible, VIEW_W - 118, 3, this.time);
        drawText(c, `${this.collected}/${this.pickups.length}`, VIEW_W - 102, 5, 6, "#ffffff");
        drawText(c, `Falls ${this.deaths}`, VIEW_W - 6, 5, 6, "#ffffff", "right");
    }

    drawComplete() {
        const r = this.results[this.levelIndex];
        if (!r) return;
        this.drawPanel([
            this.level.goalText,
            "",
            `${capitalize(this.level.collectible)}s: ${r.collected}/${r.total}`,
            `Falls: ${r.deaths}`,
            `Time: ${formatTime(r.time)}`,
            "",
            "Press Enter or tap",
        ]);
    }

    drawPanel(lines) {
        const c = screenCtx;
        const h = lines.length * 14 + 24;
        const y0 = Math.round((VIEW_H - h) / 2);
        c.fillStyle = "rgba(4, 8, 20, 0.82)";
        c.fillRect(70, y0, VIEW_W - 140, h);
        c.strokeStyle = "#ffd23f";
        c.lineWidth = 1;
        c.strokeRect(70.5, y0 + 0.5, VIEW_W - 141, h - 1);
        lines.forEach((line, i) => drawText(c, line, VIEW_W / 2, y0 + 14 + i * 14, i === 0 ? 8 : 7, i === 0 ? "#ffd23f" : "#ffffff", "center"));
    }

    drawCaption(title, subtitle) {
        const c = screenCtx;
        drawText(c, title, VIEW_W / 2, 20, 10, "#ffffff", "center");
        drawText(c, subtitle, VIEW_W / 2, 38, 7, "#ffffff", "center");
        if (this.stateTime > 0.5) drawText(c, "Enter to skip", VIEW_W - 6, VIEW_H - 12, 5, "rgba(255,255,255,0.7)", "right");
    }

    drawEndingText() {
        const c = screenCtx;
        drawText(c, "Mission accomplished", 300, 30, 10, "#ffd23f", "center");
        let y = 56;
        for (const line of wrap(c, ENDING, 6, 320)) {
            drawText(c, line, 300, y, 6, "#e9f1fb", "center");
            y += 11;
        }
        const done = this.results.filter((r) => r !== undefined);
        const collected = done.reduce((n, r) => n + r.collected, 0);
        const total = done.reduce((n, r) => n + r.total, 0);
        const deaths = done.reduce((n, r) => n + r.deaths, 0);
        const time = done.reduce((n, r) => n + r.time, 0);
        y += 10;
        drawText(c, `Collected ${collected}/${total}   Falls ${deaths}   Time ${formatTime(time)}`, 300, y, 6, "#ffffff", "center");
        if (this.stateTime > 1.5 && Math.floor(this.time * 2) % 2 === 0) {
            drawText(c, "Press Enter to play again", 300, 236, 7, "#ffd23f", "center");
        }
    }
}

function drawCollectibleIcon(c, kind, x, y, t) {
    c.save();
    c.translate(x, y);
    drawCollectible(c, kind, 0, 0, t);
    c.restore();
}

function confirmPressed() {
    return input.pressed("confirm") || input.pressed("jump");
}

function wrap(c, lines, size, maxWidth) {
    c.font = `${size}px ${FONT}`;
    const out = [];
    for (const line of lines) {
        if (line === "") {
            out.push("");
            continue;
        }
        let current = "";
        for (const word of line.split(" ")) {
            const next = current ? `${current} ${word}` : word;
            if (c.measureText(next).width > maxWidth && current) {
                out.push(current);
                current = word;
            } else {
                current = next;
            }
        }
        out.push(current);
    }
    return out;
}

function clamp(v, min, max) {
    return Math.min(Math.max(v, min), max);
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
}

function readProgress() {
    try {
        const v = Number.parseInt(localStorage.getItem(PROGRESS_KEY) ?? "0", 10);
        return Number.isFinite(v) ? clamp(v, 0, LEVELS.length - 1) : 0;
    } catch {
        return 0;
    }
}

function writeProgress(v) {
    try {
        localStorage.setItem(PROGRESS_KEY, String(v));
    } catch {
        // Storage may be unavailable (private mode); progress then lasts for this session only.
    }
}

function requireElement(id, type) {
    const el = document.getElementById(id);
    if (!(el instanceof type)) throw new Error(`Element #${id} missing or not a ${type.name}`);
    return el;
}

function requireContext(c) {
    const context = c.getContext("2d");
    if (!context) throw new Error("Canvas 2D context unavailable");
    return context;
}

function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(VIEW_W, Math.round(rect.width * dpr));
    canvas.width = w;
    canvas.height = Math.round((w * VIEW_H) / VIEW_W);
}

export const game = new Game();

// ?chapter=N jumps straight to chapter N (1-based).
const chapterParam = Number.parseInt(new URLSearchParams(window.location.search).get("chapter") ?? "", 10);
if (chapterParam >= 1 && chapterParam <= LEVELS.length) game.startLevel(chapterParam - 1);

window.addEventListener("resize", resize);
resize();

document.addEventListener("visibilitychange", () => {
    if (document.hidden && game.state === "play" && !game.paused) {
        game.paused = true;
        sound.stopMusic();
    }
});

let last = performance.now();
let acc = 0;
function frame(now) {
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    while (acc >= DT) {
        input.update();
        game.update(DT);
        acc -= DT;
    }
    game.draw();
    requestAnimationFrame(frame);
}

// Draw only once the pixel font is ready so the first frames aren't in a fallback font.
void document.fonts.load(`8px ${FONT}`).finally(() => requestAnimationFrame(frame));
