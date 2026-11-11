import { LEVELS, ENDING } from "./levels.js";
import { World, overlaps } from "./world.js";
import { Player, physicsFor, PLAYER_W, PLAYER_H } from "./player.js";
import { spawnEntities } from "./entities.js";
import {
    drawBackground,
    drawTiles,
    drawCollectible,
    drawCheckpoint,
    drawGoal,
    drawEnemy,
    drawShuttleStack,
    drawOrbiter,
} from "./render.js";
import { VIEW_W, VIEW_H } from "../../core/screen.js";
import { drawText, drawPanel, drawMenu, wrap, formatTime } from "../../core/text.js";
import { HERO_FRAMES, HERO_W, HERO_H, PORTRAIT, heroPalette, drawSprite } from "../../core/sprites.js";
import { drawSpaceBackdrop } from "../../core/backdrop.js";
import { MENU } from "../../core/bindings.js";
import { readStorage, writeStorage } from "../../core/storage.js";

const PROGRESS_KEY = "frimout.progress";
const DEATH_TIME = 0.9;
const INVULNERABLE_TIME = 1.2;
const LAUNCH_AFTER = "pad39a";
const CUTSCENE_TIME = 6;

const KEYS = {
    left: ["ArrowLeft", "KeyA", "PadLeft", "TouchLeft"],
    right: ["ArrowRight", "KeyD", "PadRight", "TouchRight"],
    jump: ["Space", "ArrowUp", "KeyW", "KeyZ", "KeyK", "PadA", "PadB", "TouchA"],
};
const CONFIRM = [...MENU.confirm, ...KEYS.jump];

const LEAD = [
    0, null, 4, 7, 12, null, 7, 4, 5, null, 9, 12, 9, null, 5, null,
    7, null, 11, 14, 12, null, 11, 7, 9, 7, 5, 4, 2, null, null, null,
];
const BASS = [-24, -24, -17, -17, -19, -19, -12, -12, -20, -20, -13, -13, -17, -17, -22, -22];
const SONG = { tempo: 140, lead: LEAD, bass: BASS };
const ORBIT_SONG = { tempo: 112, lead: LEAD, bass: BASS };

export function createJourney(shell, params) {
    const game = new JourneyGame(shell);
    const chapter = Number.parseInt(params.get("chapter") ?? "", 10);
    if (chapter >= 1 && chapter <= LEVELS.length) game.startLevel(chapter - 1);
    return game;
}

class JourneyGame {
    constructor(shell) {
        this.shell = shell;
        this.input = shell.input;
        this.sound = shell.sound;
        this.state = "title";
        this.time = 0;
        this.stateTime = 0;
        this.menuIndex = 0;
        this.levelIndex = 0;
        this.results = [];
        this.progress = readProgress();
        this.loadLevel(0);
    }

    get pausable() {
        return this.state === "play" || this.state === "dying";
    }

    get touchLayout() {
        return this.pausable ? "platform" : "menu";
    }

    onPause() {
        this.sound.stopMusic();
    }

    onResume() {
        this.sound.startMusic(this.song());
    }

    dispose() {
        this.sound.stopMusic();
    }

    song() {
        return this.level.gravityScale < 1 ? ORBIT_SONG : SONG;
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

    confirmPressed() {
        return this.input.pressed(CONFIRM);
    }

    update(dt) {
        this.time += dt;
        this.stateTime += dt;

        switch (this.state) {
            case "title":
                this.updateTitle();
                break;
            case "intro":
                if (this.stateTime > 0.3 && this.confirmPressed()) {
                    this.sound.play("select");
                    this.sound.startMusic(this.song());
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
                if (this.stateTime > 0.8 && this.confirmPressed()) this.afterLevel();
                break;
            case "launch":
            case "landing":
                if ((this.stateTime > 0.5 && this.confirmPressed()) || this.stateTime > CUTSCENE_TIME) {
                    if (this.state === "launch") this.startLevel(this.levelIndex + 1);
                    else this.setState("ending");
                }
                break;
            case "ending":
                if (this.stateTime > 1.5 && this.confirmPressed()) {
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
        const move = [...MENU.up, ...MENU.down, ...MENU.left, ...MENU.right];
        if (hasContinue && this.input.pressed(move)) {
            this.menuIndex = 1 - this.menuIndex;
            this.sound.play("select");
        }
        if (this.stateTime > 0.3 && this.input.pressed(MENU.confirm)) {
            this.sound.play("select");
            this.results = [];
            this.startLevel(hasContinue && this.menuIndex === 1 ? this.progress : 0);
        }
    }

    updatePlay(dt) {
        const input = this.input;
        const sound = this.sound;
        this.levelTime += dt;
        this.invulnerable = Math.max(0, this.invulnerable - dt);
        const p = this.player;
        const events = p.step(
            this.world,
            {
                left: input.held(KEYS.left),
                right: input.held(KEYS.right),
                jumpPressed: input.pressed(KEYS.jump),
                jumpHeld: input.held(KEYS.jump),
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
                collected: this.collected,
                total: this.pickups.length,
                deaths: this.deaths,
                time: this.levelTime,
            };
            this.progress = Math.max(this.progress, Math.min(this.levelIndex + 1, LEVELS.length - 1));
            writeStorage(PROGRESS_KEY, String(this.progress));
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
        if (this.levelIndex >= LEVELS.length - 1) {
            this.setState("landing");
        } else if (this.level.id === LAUNCH_AFTER) {
            this.setState("launch");
        } else {
            this.startLevel(this.levelIndex + 1);
        }
    }

    // ---- drawing -------------------------------------------------------

    drawPixels(ctx) {
        switch (this.state) {
            case "title":
            case "ending": {
                drawSpaceBackdrop(ctx, this.time);
                const outfit = this.state === "ending" ? "polo" : "pumpkin";
                const bob = Math.round(Math.sin(this.time * 1.5) * 3);
                drawSprite(ctx, PORTRAIT, heroPalette(outfit), 44, 72 + bob, false, 6);
                break;
            }
            case "launch":
                this.drawLaunch(ctx);
                break;
            case "landing":
                this.drawLanding(ctx);
                break;
            default:
                this.drawWorld(ctx);
        }
    }

    drawOverlay(c) {
        switch (this.state) {
            case "title":
                this.drawTitleText(c);
                break;
            case "intro":
                this.drawIntroText(c);
                break;
            case "play":
            case "dying":
                this.drawHud(c);
                break;
            case "complete":
                this.drawHud(c);
                this.drawComplete(c);
                break;
            case "launch":
                this.drawCaption(c, "STS-45  |  24 March 1992", "Atlantis lifts off from Pad 39A");
                break;
            case "landing":
                this.drawCaption(c, "2 April 1992", "Wheels stop at Kennedy Space Center");
                break;
            case "ending":
                this.drawEndingText(c);
                break;
            default:
                throw new Error(`Unknown state "${this.state}"`);
        }
    }

    drawWorld(ctx) {
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
        this.drawPlayer(ctx, camX, camY);
    }

    drawPlayer(ctx, camX, camY) {
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

    drawLaunch(ctx) {
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

    drawLanding(ctx) {
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
        for (let x = 0; x < VIEW_W; x += 32) ctx.fillRect(x + (Math.round(t * 64) % 32), 231, 14, 2);

        const ease = 1 - Math.pow(1 - t, 2);
        const ox = Math.round(-60 + ease * 330);
        const oy = Math.round(40 + ease * 180);
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

    drawTitleText(c) {
        drawText(c, "FRIMOUT", 300, 40, 24, "#ffd23f", "center");
        drawText(c, "Journey to the Stars", 300, 74, 8, "#ffffff", "center");
        drawText(c, "A tribute to Dirk Frimout,", 300, 100, 6, "#cfe0f5", "center");
        drawText(c, "the first Belgian in space", 300, 110, 6, "#cfe0f5", "center");
        drawText(c, "(STS-45, Space Shuttle Atlantis, 1992)", 300, 120, 6, "#cfe0f5", "center");

        const hasContinue = this.progress > 0;
        const items = hasContinue ? ["New game", `Continue: ${LEVELS[this.progress]?.title ?? ""}`] : ["Start"];
        drawMenu(c, items, hasContinue ? this.menuIndex : 0, 300, 150, this.time);

        drawText(c, "Arrows/WASD move  Space/Up jump", 300, 196, 6, "#8fa3bd", "center");
        drawText(c, hasContinue ? "Up/Down choose  Enter start" : "Press Enter or tap to start", 300, 206, 6, "#8fa3bd", "center");
        drawText(c, "P pause  M sound  Esc back", 300, 216, 6, "#8fa3bd", "center");
    }

    drawIntroText(c) {
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

    drawHud(c) {
        c.fillStyle = "rgba(0,0,0,0.35)";
        c.fillRect(0, 0, VIEW_W, 16);
        drawText(c, this.level.title, 6, 5, 6, "#ffffff");
        c.save();
        c.translate(VIEW_W - 118, 3);
        drawCollectible(c, this.level.collectible, 0, 0, this.time);
        c.restore();
        drawText(c, `${this.collected}/${this.pickups.length}`, VIEW_W - 102, 5, 6, "#ffffff");
        drawText(c, `Falls ${this.deaths}`, VIEW_W - 6, 5, 6, "#ffffff", "right");
    }

    drawComplete(c) {
        const r = this.results[this.levelIndex];
        if (!r) return;
        drawPanel(c, [
            this.level.goalText,
            "",
            `${capitalize(this.level.collectible)}s: ${r.collected}/${r.total}`,
            `Falls: ${r.deaths}`,
            `Time: ${formatTime(r.time)}`,
            "",
            "Press Enter or tap",
        ]);
    }

    drawCaption(c, title, subtitle) {
        drawText(c, title, VIEW_W / 2, 20, 10, "#ffffff", "center");
        drawText(c, subtitle, VIEW_W / 2, 38, 7, "#ffffff", "center");
        if (this.stateTime > 0.5) drawText(c, "Enter to skip", VIEW_W - 6, VIEW_H - 12, 5, "rgba(255,255,255,0.7)", "right");
    }

    drawEndingText(c) {
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

function clamp(v, min, max) {
    return Math.min(Math.max(v, min), max);
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function readProgress() {
    const v = Number.parseInt(readStorage(PROGRESS_KEY, "0"), 10);
    return Number.isFinite(v) ? clamp(v, 0, LEVELS.length - 1) : 0;
}
