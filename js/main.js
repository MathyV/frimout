import { VIEW_W, VIEW_H } from "./core/screen.js";
import { Input } from "./core/input.js";
import { Sound } from "./core/audio.js";
import { MENU, PAUSE, MUTE } from "./core/bindings.js";
import { FONT, drawText, drawMenu, drawPanel } from "./core/text.js";
import { PORTRAIT, heroPalette, drawSprite } from "./core/sprites.js";
import { drawSpaceBackdrop } from "./core/backdrop.js";
import { readStorage, writeStorage } from "./core/storage.js";
import { GAMES } from "./games/index.js";

const DT = 1 / 60;
const LAST_GAME_KEY = "frimout.lastGame";

const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Canvas #game missing");
const screenCtx = requireContext(canvas);
const low = document.createElement("canvas");
low.width = VIEW_W;
low.height = VIEW_H;
const lowCtx = requireContext(low);

const input = new Input(canvas);
const sound = new Sound();
input.onGesture(() => sound.unlock());
input.bindTouchButtons(document);

class App {
    constructor() {
        this.time = 0;
        this.stateTime = 0;
        this.active = null;
        this.paused = false;
        this.pauseIndex = 0;
        this.pauseAge = 0;
        this.toast = null;
        const last = GAMES.findIndex((g) => g.id === readStorage(LAST_GAME_KEY, ""));
        this.menuIndex = Math.max(0, last);
        this.shell = {
            input,
            sound,
            canvas,
            exit: () => this.exitGame(),
            pause: () => this.pause(),
        };
    }

    launch(index, params = new URLSearchParams()) {
        const entry = GAMES[index];
        if (!entry) throw new Error(`No game at index ${index}`);
        this.menuIndex = index;
        writeStorage(LAST_GAME_KEY, entry.id);
        this.active = entry.create(this.shell, params);
        this.paused = false;
        this.stateTime = 0;
    }

    exitGame() {
        if (this.active) this.active.dispose();
        this.active = null;
        this.paused = false;
        this.stateTime = 0;
        sound.stopMusic();
    }

    pause() {
        if (!this.active || this.paused || !this.active.pausable) return;
        this.paused = true;
        this.pauseIndex = 0;
        this.pauseAge = 0;
        this.active.onPause();
    }

    resume() {
        if (!this.active || !this.paused) return;
        this.paused = false;
        this.active.onResume();
    }

    update(dt) {
        this.time += dt;
        this.stateTime += dt;
        if (input.pressed(MUTE)) {
            this.toast = { text: sound.toggleMute() ? "Sound off" : "Sound on", t: 1.5 };
        }
        if (this.toast) {
            this.toast.t -= dt;
            if (this.toast.t <= 0) this.toast = null;
        }

        if (!this.active) {
            this.updateMenu();
            return;
        }
        if (this.paused) {
            this.updatePauseMenu();
            return;
        }
        if (input.pressed(PAUSE)) {
            if (this.active.pausable) this.pause();
            else this.exitGame();
            return;
        }
        this.active.update(dt);
    }

    updateMenu() {
        if (input.pressed(MENU.up)) {
            this.menuIndex = (this.menuIndex + GAMES.length - 1) % GAMES.length;
            sound.play("select");
        }
        if (input.pressed(MENU.down)) {
            this.menuIndex = (this.menuIndex + 1) % GAMES.length;
            sound.play("select");
        }
        if (this.stateTime > 0.3 && input.pressed(MENU.confirm)) {
            sound.play("select");
            this.launch(this.menuIndex);
        }
    }

    updatePauseMenu() {
        this.pauseAge += DT;
        // Leaving pointer lock with Esc pauses the game; ignore that same Esc keypress.
        if (input.pressed(PAUSE) && this.pauseAge > 0.25) {
            this.resume();
            return;
        }
        if (input.pressed(MENU.up) || input.pressed(MENU.down)) {
            this.pauseIndex = 1 - this.pauseIndex;
            sound.play("select");
        }
        if (input.pressed(MENU.confirm)) {
            if (this.pauseIndex === 0) this.resume();
            else this.exitGame();
        }
    }

    draw() {
        lowCtx.imageSmoothingEnabled = false;
        const s = canvas.width / VIEW_W;
        if (this.active) {
            this.active.drawPixels(lowCtx);
            this.blit();
            screenCtx.setTransform(s, 0, 0, s, 0, 0);
            this.active.drawOverlay(screenCtx);
            if (this.paused) {
                drawPanel(screenCtx, ["Paused", "", "", "", "Esc to resume"]);
                drawMenu(screenCtx, ["Resume", "Quit to menu"], this.pauseIndex, VIEW_W / 2, VIEW_H / 2 - 10, this.time);
            }
        } else {
            this.drawMenuBackdrop();
            this.blit();
            screenCtx.setTransform(s, 0, 0, s, 0, 0);
            this.drawMenuText();
        }
        if (this.toast) drawText(screenCtx, this.toast.text, VIEW_W - 8, VIEW_H - 16, 6, "#ffffff", "right");
        document.body.dataset.touch = this.paused || !this.active ? "menu" : this.active.touchLayout;
    }

    blit() {
        screenCtx.setTransform(1, 0, 0, 1, 0, 0);
        screenCtx.imageSmoothingEnabled = false;
        screenCtx.drawImage(low, 0, 0, canvas.width, canvas.height);
    }

    drawMenuBackdrop() {
        drawSpaceBackdrop(lowCtx, this.time);
        const bob = Math.round(Math.sin(this.time * 1.5) * 3);
        drawSprite(lowCtx, PORTRAIT, heroPalette("pumpkin"), 44, 72 + bob, false, 6);
    }

    drawMenuText() {
        const c = screenCtx;
        drawText(c, "FRIMOUT ARCADE", 300, 28, 16, "#ffd23f", "center");
        drawText(c, "A tribute to Dirk Frimout,", 300, 54, 6, "#cfe0f5", "center");
        drawText(c, "the first Belgian in space", 300, 64, 6, "#cfe0f5", "center");
        drawMenu(
            c,
            GAMES.map((g) => g.title),
            this.menuIndex,
            300,
            88,
            this.time,
            7,
            16,
        );
        const sel = GAMES[this.menuIndex];
        if (sel) {
            const y0 = 96 + GAMES.length * 16;
            drawText(c, sel.genre, 300, y0, 6, "#ffd23f", "center");
            sel.description.forEach((line, i) => drawText(c, line, 300, y0 + 14 + i * 11, 6, "#e9f1fb", "center"));
        }
        drawText(c, "Up/Down choose   Enter or tap play", 300, 222, 6, "#8fa3bd", "center");
        drawText(c, "Esc back   M sound", 300, 232, 6, "#8fa3bd", "center");
    }
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

export const app = new App();

// ?game=<id> opens a game directly; other parameters are passed to it
// (e.g. ?game=journey&chapter=3). ?chapter=N alone is kept for old links.
const params = new URLSearchParams(window.location.search);
const gameParam = params.get("game") ?? (params.has("chapter") ? "journey" : null);
const gameIndex = GAMES.findIndex((g) => g.id === gameParam);
if (gameIndex >= 0) app.launch(gameIndex, params);

window.addEventListener("resize", resize);
resize();

document.addEventListener("visibilitychange", () => {
    if (document.hidden) app.pause();
});

let last = performance.now();
let acc = 0;
function frame(now) {
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    while (acc >= DT) {
        input.update();
        app.update(DT);
        acc -= DT;
    }
    app.draw();
    requestAnimationFrame(frame);
}

// Start drawing once the pixel font is ready so the first frames aren't in a fallback font.
void document.fonts.load(`8px ${FONT}`).finally(() => requestAnimationFrame(frame));
