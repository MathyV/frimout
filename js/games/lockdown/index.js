import { MAPS, ENDING } from "./maps.js";
import { LabWorld } from "./world.js";
import { Raycaster, camera, PROJ } from "./raycaster.js";
import { SPRITES } from "./textures.js";
import { VIEW_W, VIEW_H } from "../../core/screen.js";
import { drawText, drawPanel, drawMenu, wrap, formatTime } from "../../core/text.js";
import { PORTRAIT, heroPalette, drawSprite } from "../../core/sprites.js";
import { drawSpaceBackdrop } from "../../core/backdrop.js";
import { MENU } from "../../core/bindings.js";
import { readStorage, writeStorage } from "../../core/storage.js";

const PROGRESS_KEY = "frimout.lockdown.progress";

const KEYS = {
    forward: ["KeyW", "ArrowUp", "PadUp", "TouchUp"],
    back: ["KeyS", "ArrowDown", "PadDown", "TouchDown"],
    turnLeft: ["ArrowLeft", "PadLeft", "TouchLeft"],
    turnRight: ["ArrowRight", "PadRight", "TouchRight"],
    strafeLeft: ["KeyA", "PadLB"],
    strafeRight: ["KeyD", "PadRB"],
    fire: ["Space", "ControlLeft", "ControlRight", "KeyF", "KeyK", "MouseLeft", "PadA", "PadRT", "TouchA"],
};

const MOVE_SPEED = 3.0;
const TURN_SPEED = 2.6;
const MOUSE_SENSITIVITY = 0.0025;
const PLAYER_RADIUS = 0.22;
const ROBOT_RADIUS = 0.3;
const FIRE_COST = 12;
const FIRE_COOLDOWN = 0.28;
const ENERGY_REGEN = 9;
const ROBOT_HP = 3;
const ROBOT_SPEED = 1.1;
const ROBOT_SIGHT = 9;
const ROBOT_KEEP_DISTANCE = 2.2;
const SHOT_SPEED = 4.5;
const SHOT_DAMAGE = 10;
const PICKUP_REACH = 0.5;

const SONG = {
    tempo: 132,
    lead: [
        0, null, 3, null, 7, null, 3, 0, -2, null, 2, null, 5, null, 2, -2,
        -4, null, 0, null, 3, null, 0, -4, -5, null, -1, null, 2, null, 7, null,
    ],
    bass: [-24, -24, -24, -24, -26, -26, -26, -26, -28, -28, -28, -28, -29, -29, -17, -17],
};

const ZAPPER = [
    "........cccc........",
    ".......cCCCCc.......",
    "........gggg........",
    ".......gGGGGg.......",
    ".......gGyyGg.......",
    ".......gGGGGg.......",
    ".......gGGGGg.......",
    ".......gGyyGg.......",
    "......sgGGGGgs......",
    ".....ssgGGGGgss.....",
    "....sssssGGsssss....",
    "....ssssssssssss....",
    "...ssssssssssssss...",
    "...bbbbbbbbbbbbbb...",
    "..bbbbbbbbbbbbbbbb..",
    "..bbbbbbbbbbbbbbbb..",
];
const ZAPPER_PALETTE = {
    c: "#3fb5ff",
    C: "#9be3ff",
    g: "#2b2f36",
    G: "#8a939f",
    y: "#f0b429",
    s: "#f1c3a2",
    b: "#2c55a8",
};
const ZAPPER_FIRING = { ...ZAPPER_PALETTE, c: "#ffffff", C: "#ffffff" };
const ZAPPER_SCALE = 4;

export function createLockdown(shell, params) {
    const game = new LockdownGame(shell);
    const map = Number.parseInt(params.get("map") ?? "", 10);
    if (map >= 1 && map <= MAPS.length) game.startMap(map - 1);
    return game;
}

class LockdownGame {
    constructor(shell) {
        this.shell = shell;
        this.input = shell.input;
        this.sound = shell.sound;
        this.canvas = shell.canvas;
        this.ray = new Raycaster();
        this.state = "title";
        this.time = 0;
        this.stateTime = 0;
        this.menuIndex = 0;
        this.mapIndex = 0;
        this.results = [];
        this.message = null;
        this.fireLock = true;
        this.progress = readProgress();

        this.onClick = () => {
            if (this.state === "play" && document.pointerLockElement !== this.canvas) {
                this.canvas.requestPointerLock?.();
            }
        };
        this.onLockChange = () => {
            if (document.pointerLockElement !== this.canvas && this.state === "play") this.shell.pause();
        };
        this.canvas.addEventListener("click", this.onClick);
        document.addEventListener("pointerlockchange", this.onLockChange);
        this.loadMap(0);
    }

    get pausable() {
        return this.state === "play";
    }

    get touchLayout() {
        return this.state === "play" ? "fps" : "menu";
    }

    onPause() {
        this.sound.stopMusic();
        if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    }

    onResume() {
        this.sound.startMusic(SONG);
    }

    dispose() {
        this.sound.stopMusic();
        this.canvas.removeEventListener("click", this.onClick);
        document.removeEventListener("pointerlockchange", this.onLockChange);
        if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    }

    get map() {
        const map = MAPS[this.mapIndex];
        if (!map) throw new Error(`No map at index ${this.mapIndex}`);
        return map;
    }

    setState(state) {
        if (this.state === "play" && state !== "play" && document.pointerLockElement === this.canvas) {
            document.exitPointerLock();
        }
        this.state = state;
        this.stateTime = 0;
        if (state === "play") this.fireLock = true;
    }

    loadMap(index) {
        this.mapIndex = index;
        this.world = new LabWorld(this.map);
        const start = this.world.start;
        if (!start) throw new Error("Map without start");
        this.player = { x: start.x, y: start.y, angle: this.map.startAngle, health: 100, energy: 100, hurt: 0, cooldown: 0, muzzle: 0, walk: 0 };
        this.robots = [];
        this.pickups = [];
        for (const s of this.world.spawns) {
            if (s.type === "r") {
                this.robots.push({ x: s.x, y: s.y, hp: ROBOT_HP, alive: true, alerted: false, cool: 1 + Math.random(), flash: 0, fire: 0, tx: s.x, ty: s.y, t: Math.random() * 6 });
            } else {
                this.pickups.push({ type: s.type, x: s.x, y: s.y, taken: false });
            }
        }
        this.shots = [];
        this.impacts = [];
        this.disks = 0;
        this.disabled = 0;
        this.mapTime = 0;
        this.message = null;
    }

    startMap(index) {
        this.loadMap(index);
        this.setState("intro");
    }

    confirmPressed() {
        return this.input.pressed(MENU.confirm);
    }

    say(text) {
        this.message = { text, t: 2 };
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
                    this.sound.startMusic(SONG);
                    this.setState("play");
                }
                break;
            case "play":
                this.updatePlay(dt);
                break;
            case "dead":
                if (this.stateTime > 1 && this.confirmPressed()) this.startMap(this.mapIndex);
                break;
            case "complete":
                if (this.stateTime > 0.8 && this.confirmPressed()) {
                    if (this.mapIndex >= MAPS.length - 1) this.setState("ending");
                    else this.startMap(this.mapIndex + 1);
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
        if (hasContinue && this.input.pressed([...MENU.up, ...MENU.down, ...MENU.left, ...MENU.right])) {
            this.menuIndex = 1 - this.menuIndex;
            this.sound.play("select");
        }
        if (this.stateTime > 0.3 && this.confirmPressed()) {
            this.sound.play("select");
            this.results = [];
            this.startMap(hasContinue && this.menuIndex === 1 ? this.progress : 0);
        }
    }

    updatePlay(dt) {
        const input = this.input;
        const p = this.player;
        this.mapTime += dt;
        if (this.message) {
            this.message.t -= dt;
            if (this.message.t <= 0) this.message = null;
        }

        const turn = (input.held(KEYS.turnRight) ? 1 : 0) - (input.held(KEYS.turnLeft) ? 1 : 0);
        p.angle += turn * TURN_SPEED * dt + input.mouseX() * MOUSE_SENSITIVITY;
        const fwd = (input.held(KEYS.forward) ? 1 : 0) - (input.held(KEYS.back) ? 1 : 0);
        const strafe = (input.held(KEYS.strafeRight) ? 1 : 0) - (input.held(KEYS.strafeLeft) ? 1 : 0);
        const cos = Math.cos(p.angle);
        const sin = Math.sin(p.angle);
        let mx = cos * fwd - sin * strafe;
        let my = sin * fwd + cos * strafe;
        const len = Math.hypot(mx, my);
        if (len > 0) {
            mx = (mx / len) * MOVE_SPEED * dt;
            my = (my / len) * MOVE_SPEED * dt;
            this.world.move(p, mx, my, PLAYER_RADIUS);
            p.walk += dt;
        }

        const actors = [p, ...this.robots.filter((r) => r.alive)];
        for (const e of this.world.updateDoors(actors, dt)) this.sound.play(e);

        p.energy = Math.min(100, p.energy + ENERGY_REGEN * dt);
        p.cooldown = Math.max(0, p.cooldown - dt);
        p.muzzle = Math.max(0, p.muzzle - dt);
        p.hurt = Math.max(0, p.hurt - dt);
        // The key that confirmed the intro must be released before it can fire.
        if (this.fireLock && !input.held(KEYS.fire)) this.fireLock = false;
        if (!this.fireLock && p.cooldown <= 0 && (input.pressed(KEYS.fire) || input.held(KEYS.fire))) this.fire();

        for (const item of this.pickups) {
            if (item.taken || Math.hypot(item.x - p.x, item.y - p.y) > PICKUP_REACH) continue;
            if (item.type === "h" && p.health >= 100) continue;
            item.taken = true;
            this.sound.play("pickup");
            if (item.type === "d") {
                this.disks++;
                this.say("Data disk recovered");
            } else if (item.type === "h") {
                p.health = Math.min(100, p.health + 25);
                this.say("Belgian waffle! +25 health");
            } else if (item.type === "e") {
                p.energy = 100;
                this.say("Zapper recharged");
            }
        }

        for (const r of this.robots) this.updateRobot(r, dt);
        this.updateShots(dt);
        this.impacts = this.impacts.filter((i) => (i.t -= dt) > 0);

        if (p.health <= 0) {
            this.sound.stopMusic();
            this.sound.play("die");
            this.setState("dead");
            return;
        }
        if (this.world.atExit(p.x, p.y)) {
            this.sound.stopMusic();
            this.sound.play("goal");
            this.results[this.mapIndex] = {
                disabled: this.disabled,
                robots: this.robots.length,
                disks: this.disks,
                totalDisks: this.pickups.filter((i) => i.type === "d").length,
                time: this.mapTime,
            };
            this.progress = Math.max(this.progress, Math.min(this.mapIndex + 1, MAPS.length - 1));
            writeStorage(PROGRESS_KEY, String(this.progress));
            this.setState("complete");
        }
    }

    fire() {
        const p = this.player;
        p.cooldown = FIRE_COOLDOWN;
        if (p.energy < FIRE_COST) {
            this.sound.play("empty");
            return;
        }
        p.energy -= FIRE_COST;
        p.muzzle = 0.12;
        this.sound.play("zap");

        const cam = camera(p.x, p.y, p.angle);
        const centerDepth = this.ray.zbuf[VIEW_W / 2] ?? Infinity;
        let best = null;
        let bestDepth = Infinity;
        for (const r of this.robots) {
            if (!r.alive) continue;
            const proj = this.ray.project(cam, r.x, r.y);
            if (!proj || proj.depth > centerDepth || proj.depth > bestDepth) continue;
            const halfWidth = ((PROJ * 0.75) / proj.depth) * 0.35;
            if (Math.abs(proj.screenX - VIEW_W / 2) > halfWidth) continue;
            if (!this.world.lineOfSight(p.x, p.y, r.x, r.y)) continue;
            best = r;
            bestDepth = proj.depth;
        }
        if (!best) return;
        best.hp--;
        best.flash = 0.12;
        best.alerted = true;
        this.impacts.push({ x: best.x, y: best.y, t: 0.15 });
        if (best.hp <= 0) {
            best.alive = false;
            this.disabled++;
            this.sound.play("robotDown");
        } else {
            this.sound.play("hit");
        }
    }

    updateRobot(r, dt) {
        r.t += dt;
        r.flash = Math.max(0, r.flash - dt);
        r.fire = Math.max(0, r.fire - dt);
        if (!r.alive) return;
        const p = this.player;
        const dist = Math.hypot(p.x - r.x, p.y - r.y);
        const sees = dist < ROBOT_SIGHT && this.world.lineOfSight(r.x, r.y, p.x, p.y);
        if (sees) {
            if (!r.alerted) this.sound.play("alert");
            r.alerted = true;
            r.tx = p.x;
            r.ty = p.y;
        }
        if (!r.alerted) return;

        const toTarget = Math.hypot(r.tx - r.x, r.ty - r.y);
        const wantsCloser = sees ? dist > ROBOT_KEEP_DISTANCE : toTarget > 0.2;
        if (wantsCloser && toTarget > 0.01) {
            const step = Math.min(ROBOT_SPEED * dt, toTarget);
            this.world.move(r, ((r.tx - r.x) / toTarget) * step, ((r.ty - r.y) / toTarget) * step, ROBOT_RADIUS);
        }

        r.cool -= dt;
        if (sees && r.cool <= 0) {
            r.cool = 1.6 + Math.random() * 0.8;
            r.fire = 0.15;
            const dx = (p.x - r.x) / dist;
            const dy = (p.y - r.y) / dist;
            this.shots.push({ x: r.x + dx * 0.35, y: r.y + dy * 0.35, vx: dx * SHOT_SPEED, vy: dy * SHOT_SPEED, life: 4 });
            this.sound.play("robotShot");
        }
    }

    updateShots(dt) {
        const p = this.player;
        this.shots = this.shots.filter((s) => {
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            s.life -= dt;
            if (s.life <= 0 || this.world.opaque(Math.floor(s.x), Math.floor(s.y))) return false;
            if (Math.hypot(s.x - p.x, s.y - p.y) < 0.35) {
                p.health = Math.max(0, p.health - SHOT_DAMAGE);
                p.hurt = 0.3;
                this.sound.play("hurt");
                return false;
            }
            return true;
        });
    }

    // ---- drawing -------------------------------------------------------

    drawPixels(ctx) {
        if (this.state === "title" || this.state === "ending") {
            drawSpaceBackdrop(ctx, this.time);
            const bob = Math.round(Math.sin(this.time * 1.5) * 3);
            drawSprite(ctx, PORTRAIT, heroPalette("polo"), 44, 72 + bob, false, 6);
            return;
        }
        this.drawView(ctx);
    }

    drawView(ctx) {
        const p = this.player;
        const cam = camera(p.x, p.y, p.angle);
        const sprites = [];
        for (const r of this.robots) {
            const bob = r.alive ? Math.sin(r.t * 4) * 0.02 : 0;
            sprites.push({
                x: r.x,
                y: r.y,
                tex: r.alive ? (r.fire > 0 ? SPRITES.robotFire : SPRITES.robot) : SPRITES.wreck,
                size: 0.75,
                elev: bob,
                flash: r.flash > 0,
            });
        }
        for (const item of this.pickups) {
            if (item.taken) continue;
            const tex = item.type === "d" ? SPRITES.disk : item.type === "h" ? SPRITES.waffle : SPRITES.cell;
            const bob = 0.05 + Math.sin(this.time * 3 + item.x) * 0.03;
            sprites.push({ x: item.x, y: item.y, tex, size: 0.28, elev: bob });
        }
        for (const s of this.shots) sprites.push({ x: s.x, y: s.y, tex: SPRITES.spark, size: 0.14, elev: 0.38, fullbright: true });
        for (const i of this.impacts) sprites.push({ x: i.x, y: i.y, tex: SPRITES.zap, size: 0.3, elev: 0.3, fullbright: true });

        ctx.putImageData(this.ray.render(this.world, cam, sprites), 0, 0);

        // crosshair
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fillRect(VIEW_W / 2 - 4, VIEW_H / 2, 3, 1);
        ctx.fillRect(VIEW_W / 2 + 2, VIEW_H / 2, 3, 1);
        ctx.fillRect(VIEW_W / 2, VIEW_H / 2 - 4, 1, 3);
        ctx.fillRect(VIEW_W / 2, VIEW_H / 2 + 2, 1, 3);

        const bobX = Math.round(Math.sin(p.walk * 7) * 3);
        const bobY = Math.round(Math.abs(Math.cos(p.walk * 7)) * 3);
        const zx = VIEW_W / 2 - (ZAPPER[0]?.length ?? 0) * ZAPPER_SCALE / 2 + bobX + 40;
        const zy = VIEW_H - ZAPPER.length * ZAPPER_SCALE + 6 + bobY;
        if (p.muzzle > 0) {
            const tipX = zx + 10 * ZAPPER_SCALE;
            ctx.strokeStyle = "rgba(155, 227, 255, 0.9)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(tipX, zy);
            ctx.lineTo(VIEW_W / 2, VIEW_H / 2);
            ctx.stroke();
            ctx.fillStyle = "rgba(200, 240, 255, 0.6)";
            ctx.fillRect(tipX - 8, zy - 8, 16, 12);
        }
        drawSprite(ctx, ZAPPER, p.muzzle > 0 ? ZAPPER_FIRING : ZAPPER_PALETTE, zx, zy, false, ZAPPER_SCALE);

        if (p.hurt > 0) {
            ctx.fillStyle = `rgba(255, 40, 40, ${p.hurt})`;
            ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        }
        if (this.state === "dead") {
            ctx.fillStyle = "rgba(120, 0, 0, 0.45)";
            ctx.fillRect(0, 0, VIEW_W, VIEW_H);
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
                this.drawHud(c);
                break;
            case "dead":
                this.drawHud(c);
                drawPanel(c, ["Simulation failed", "", "The robots got the better of you.", "", "Press Enter to retry"]);
                break;
            case "complete":
                this.drawHud(c);
                this.drawComplete(c);
                break;
            case "ending":
                this.drawEndingText(c);
                break;
            default:
                throw new Error(`Unknown state "${this.state}"`);
        }
    }

    drawHud(c) {
        const p = this.player;
        c.fillStyle = "rgba(0,0,0,0.4)";
        c.fillRect(0, 0, VIEW_W, 16);
        drawText(c, this.map.title, 6, 5, 6, "#ffffff");
        const totalDisks = this.pickups.filter((i) => i.type === "d").length;
        drawText(c, `Robots ${this.disabled}/${this.robots.length}   Disks ${this.disks}/${totalDisks}`, VIEW_W - 6, 5, 6, "#ffffff", "right");

        // Top-left, clear of the on-screen touch controls at the bottom.
        const y0 = 20;
        c.fillStyle = "rgba(0,0,0,0.45)";
        c.fillRect(4, y0, 120, 26);
        drawText(c, "HEALTH", 10, y0 + 4, 5, "#cfe0f5");
        drawText(c, String(Math.ceil(p.health)), 118, y0 + 4, 5, p.health > 30 ? "#ffffff" : "#ff6b6b", "right");
        bar(c, 10, y0 + 11, 108, p.health / 100, p.health > 30 ? "#56d364" : "#ef3340");
        drawText(c, "ZAPPER", 10, y0 + 16, 5, "#cfe0f5");
        bar(c, 10, y0 + 23, 108, p.energy / 100, p.energy >= FIRE_COST ? "#3fb5ff" : "#8a939f");

        if (this.message) drawText(c, this.message.text, VIEW_W / 2, 24, 6, "#ffd23f", "center");
    }

    drawTitleText(c) {
        drawText(c, "FRIMOUT 3D", 300, 36, 18, "#ffd23f", "center");
        drawText(c, "Lab Lockdown", 300, 64, 8, "#ffffff", "center");
        drawText(c, "A fictional adventure in tribute to", 300, 88, 6, "#cfe0f5", "center");
        drawText(c, "Dirk Frimout, the first Belgian in space", 300, 98, 6, "#cfe0f5", "center");

        const hasContinue = this.progress > 0;
        const items = hasContinue ? ["New game", `Continue: ${MAPS[this.progress]?.title ?? ""}`] : ["Start"];
        drawMenu(c, items, hasContinue ? this.menuIndex : 0, 300, 126, this.time);

        drawText(c, "W/S or Up/Down move   A/D strafe", 300, 172, 6, "#8fa3bd", "center");
        drawText(c, "Left/Right or mouse turn", 300, 182, 6, "#8fa3bd", "center");
        drawText(c, "Space, Ctrl or click zap", 300, 192, 6, "#8fa3bd", "center");
        drawText(c, "P pause   M sound   Esc back", 300, 206, 6, "#8fa3bd", "center");
    }

    drawIntroText(c) {
        c.fillStyle = "rgba(4, 8, 20, 0.82)";
        c.fillRect(0, 0, VIEW_W, VIEW_H);
        drawText(c, `Deck ${this.mapIndex + 1} of ${MAPS.length}`, VIEW_W / 2, 44, 6, "#8fa3bd", "center");
        drawText(c, this.map.title, VIEW_W / 2, 60, 14, "#ffd23f", "center");
        let y = 100;
        for (const line of wrap(c, this.map.intro, 7, VIEW_W - 40)) {
            drawText(c, line, VIEW_W / 2, y, 7, "#e9f1fb", "center");
            y += 13;
        }
        drawText(c, "Click the screen to turn with the mouse", VIEW_W / 2, 200, 6, "#8fa3bd", "center");
        if (Math.floor(this.time * 2) % 2 === 0) drawText(c, "Press Enter or tap", VIEW_W / 2, 230, 7, "#ffd23f", "center");
    }

    drawComplete(c) {
        const r = this.results[this.mapIndex];
        if (!r) return;
        drawPanel(c, [
            "Deck cleared!",
            "",
            `Robots switched off: ${r.disabled}/${r.robots}`,
            `Data disks: ${r.disks}/${r.totalDisks}`,
            `Time: ${formatTime(r.time)}`,
            "",
            "Press Enter or tap",
        ]);
    }

    drawEndingText(c) {
        drawText(c, "Lockdown lifted", 300, 30, 10, "#ffd23f", "center");
        let y = 60;
        for (const line of wrap(c, ENDING, 6, 320)) {
            drawText(c, line, 300, y, 6, "#e9f1fb", "center");
            y += 11;
        }
        const done = this.results.filter((r) => r !== undefined);
        const disabled = done.reduce((n, r) => n + r.disabled, 0);
        const robots = done.reduce((n, r) => n + r.robots, 0);
        const disks = done.reduce((n, r) => n + r.disks, 0);
        const totalDisks = done.reduce((n, r) => n + r.totalDisks, 0);
        const time = done.reduce((n, r) => n + r.time, 0);
        y += 12;
        drawText(c, `Robots ${disabled}/${robots}   Disks ${disks}/${totalDisks}   Time ${formatTime(time)}`, 300, y, 6, "#ffffff", "center");
        if (this.stateTime > 1.5 && Math.floor(this.time * 2) % 2 === 0) {
            drawText(c, "Press Enter to play again", 300, 236, 7, "#ffd23f", "center");
        }
    }
}

function bar(c, x, y, w, fraction, color) {
    c.fillStyle = "rgba(255,255,255,0.15)";
    c.fillRect(x, y, w, 4);
    c.fillStyle = color;
    c.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, fraction))), 4);
}

function readProgress() {
    const v = Number.parseInt(readStorage(PROGRESS_KEY, "0"), 10);
    return Number.isFinite(v) ? Math.max(0, Math.min(v, MAPS.length - 1)) : 0;
}
