import { TILE, VENT_PERIOD, VENT_ACTIVE, VENT_HEIGHT } from "./world.js";
import { VIEW_W, VIEW_H } from "../../core/screen.js";

export const THEMES = {
    village: {
        sky: ["#78c3ee", "#d9f1ff"],
        ground: "#8a5a32",
        groundTop: "#5cae3c",
        groundDark: "#6c4426",
        block: "#a8442e",
        blockLine: "#e7d2b8",
        plank: "#9b6a35",
    },
    campus: {
        sky: ["#a9c4e0", "#eef3f8"],
        ground: "#77736c",
        groundTop: "#9c9890",
        groundDark: "#5c5953",
        block: "#7a4a26",
        blockLine: "#5b3519",
        plank: "#8c5a30",
    },
    lab: {
        sky: ["#1d2530", "#34404f"],
        ground: "#55606c",
        groundTop: "#8a96a3",
        groundDark: "#3b444e",
        block: "#3f6ea8",
        blockLine: "#cfe0f5",
        plank: "#7d8a98",
    },
    pad: {
        sky: ["#3c5f98", "#ffa86a"],
        ground: "#9a9792",
        groundTop: "#bdbab4",
        groundDark: "#77746f",
        block: "#b23a2b",
        blockLine: "#7c2419",
        plank: "#8e8b86",
    },
    space: {
        sky: ["#02030a", "#0b1230"],
        ground: "#c9ccd2",
        groundTop: "#eef0f3",
        groundDark: "#8e939c",
        block: "#d4a838",
        blockLine: "#8f6d17",
        plank: "#aeb4bd",
    },
};

export function themeOf(level) {
    const theme = THEMES[level.theme];
    if (!theme) throw new Error(`Unknown theme "${level.theme}"`);
    return theme;
}

// Deterministic pseudo-random so backgrounds don't flicker between frames.
function hash(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
}

export function drawBackground(ctx, level, camX, camY, time) {
    const t = themeOf(level);
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, t.sky[0]);
    g.addColorStop(1, t.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    switch (level.theme) {
        case "village":
            drawClouds(ctx, camX, time, "#ffffff");
            drawHopField(ctx, camX * 0.3, 175, "#4f8f3a", "#3d7a2c");
            drawHouses(ctx, camX * 0.55, 205);
            break;
        case "campus":
            drawClouds(ctx, camX, time, "#ffffff");
            drawTowers(ctx, camX * 0.3, 210);
            break;
        case "lab":
            drawLabWall(ctx, camX * 0.5);
            break;
        case "pad":
            drawStars(ctx, camX, camY, 0.05, 40, 0.5);
            drawOcean(ctx, camY);
            drawTowerLattice(ctx, camY);
            break;
        case "space":
            drawStars(ctx, camX, camY, 0.1, 140, 1);
            drawEarth(ctx, camX);
            break;
        default:
            throw new Error(`Unknown theme "${level.theme}"`);
    }
}

function drawClouds(ctx, camX, time, color) {
    ctx.fillStyle = color;
    for (let i = 0; i < 8; i++) {
        const span = VIEW_W + 160;
        const x = ((hash(i) * span - camX * 0.15 + time * 4) % span + span) % span - 80;
        const y = 20 + hash(i + 10) * 70;
        const w = 40 + hash(i + 20) * 40;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), 8);
        ctx.fillRect(Math.round(x + 8), Math.round(y - 6), Math.round(w - 20), 6);
        ctx.globalAlpha = 1;
    }
}

function drawHopField(ctx, offset, baseY, vine, dark) {
    const spacing = 26;
    const start = -((offset % spacing) + spacing);
    ctx.fillStyle = "#6b5236";
    ctx.fillRect(0, baseY - 70, VIEW_W, 1);
    for (let x = start; x < VIEW_W + spacing; x += spacing) {
        const px = Math.round(x);
        ctx.fillStyle = "#6b5236";
        ctx.fillRect(px, baseY - 72, 2, 90);
        ctx.fillStyle = vine;
        ctx.fillRect(px - 3, baseY - 64, 8, 70);
        ctx.fillStyle = dark;
        for (let y = baseY - 60; y < baseY + 6; y += 9) ctx.fillRect(px - 4 + ((y / 9) % 2) * 6, y, 3, 4);
    }
}

function drawHouses(ctx, offset, baseY) {
    const spacing = 70;
    const first = Math.floor(offset / spacing) - 1;
    for (let i = first; i < first + VIEW_W / spacing + 3; i++) {
        const x = Math.round(i * spacing - offset);
        const h = 34 + Math.floor(hash(i) * 22);
        const w = 44;
        // muted brick so the backdrop stays behind the playfield
        ctx.fillStyle = hash(i + 3) > 0.5 ? "#d6a08a" : "#cf9179";
        ctx.fillRect(x, baseY - h, w, VIEW_H - (baseY - h));
        // stepped gable
        ctx.fillRect(x + 6, baseY - h - 6, w - 12, 6);
        ctx.fillRect(x + 12, baseY - h - 12, w - 24, 6);
        ctx.fillRect(x + 18, baseY - h - 18, w - 36, 6);
        ctx.fillStyle = "#f6ead0";
        ctx.fillRect(x + 8, baseY - h + 10, 8, 10);
        ctx.fillRect(x + 28, baseY - h + 10, 8, 10);
        ctx.fillStyle = "#a9735d";
        ctx.fillRect(x + 18, baseY - 14, 8, 14);
    }
}

function drawTowers(ctx, offset, baseY) {
    const spacing = 150;
    const first = Math.floor(offset / spacing) - 1;
    for (let i = first; i < first + VIEW_W / spacing + 3; i++) {
        const x = Math.round(i * spacing - offset);
        ctx.fillStyle = "#8e9aa8";
        const h = 90 + Math.floor(hash(i) * 40);
        ctx.fillRect(x, baseY - h, 22, h + 60);
        ctx.fillRect(x - 6, baseY - h + 20, 34, 6);
        ctx.fillRect(x + 4, baseY - h - 16, 14, 16);
        ctx.fillRect(x + 8, baseY - h - 30, 6, 14);
        ctx.fillRect(x + 10, baseY - h - 38, 2, 8);
        ctx.fillStyle = "#6f7b89";
        ctx.fillRect(x + 8, baseY - h + 34, 6, 12);
        ctx.fillStyle = "#a3aebb";
        ctx.fillRect(x + 40, baseY - 40, 70, 100);
        ctx.fillStyle = "#7d8896";
        for (let wx = 0; wx < 5; wx++) ctx.fillRect(x + 46 + wx * 13, baseY - 32, 6, 10);
    }
}

function drawLabWall(ctx, offset) {
    const spacing = 64;
    const start = -(offset % spacing) - spacing;
    for (let x = start; x < VIEW_W + spacing; x += spacing) {
        const px = Math.round(x);
        ctx.fillStyle = "#2a3441";
        ctx.fillRect(px + 2, 30, spacing - 4, 150);
        ctx.fillStyle = "#3a4a5e";
        ctx.fillRect(px + 10, 50, spacing - 20, 40);
        ctx.fillStyle = "#86b7e8";
        ctx.globalAlpha = 0.35;
        ctx.fillRect(px + 12, 52, spacing - 24, 36);
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#56d364";
        ctx.fillRect(px + 14, 110, 4, 4);
        ctx.fillStyle = "#f0b429";
        ctx.fillRect(px + 22, 110, 4, 4);
    }
    ctx.fillStyle = "#003399";
    ctx.fillRect(0, 12, VIEW_W, 6);
}

function drawStars(ctx, camX, camY, parallax, count, alpha) {
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < count; i++) {
        const x = ((hash(i) * VIEW_W * 2 - camX * parallax) % VIEW_W + VIEW_W) % VIEW_W;
        const y = ((hash(i + 500) * VIEW_H * 2 - camY * parallax) % VIEW_H + VIEW_H) % VIEW_H;
        ctx.globalAlpha = alpha * (0.4 + hash(i + 900) * 0.6);
        ctx.fillRect(Math.round(x), Math.round(y), hash(i + 77) > 0.9 ? 2 : 1, 1);
    }
    ctx.globalAlpha = 1;
}

function drawOcean(ctx, camY) {
    const horizon = Math.round(200 - camY * 0.05 + 30);
    ctx.fillStyle = "#2f5f8f";
    ctx.fillRect(0, horizon, VIEW_W, VIEW_H - horizon);
    ctx.fillStyle = "#4d7fb0";
    for (let i = 0; i < 20; i++) ctx.fillRect(Math.round(hash(i) * VIEW_W), horizon + 3 + Math.round(hash(i + 3) * 30), 12, 1);
}

function drawTowerLattice(ctx, camY) {
    const off = Math.round(-camY * 0.6);
    ctx.strokeStyle = "rgba(120, 40, 30, 0.45)";
    ctx.lineWidth = 1;
    for (let y = (off % 32) - 32; y < VIEW_H + 32; y += 32) {
        ctx.beginPath();
        ctx.moveTo(40, y);
        ctx.lineTo(440, y);
        ctx.moveTo(40, y);
        ctx.lineTo(80, y + 32);
        ctx.moveTo(440, y);
        ctx.lineTo(400, y + 32);
        ctx.stroke();
    }
}

function drawEarth(ctx, camX) {
    const cx = VIEW_W / 2 - camX * 0.02;
    const r = 520;
    const cy = VIEW_H + r - 70;
    ctx.fillStyle = "#3d7fd0";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4f9a4a";
    for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (hash(i) - 0.5) * 0.9 - camX * 0.00004;
        const x = cx + Math.cos(a) * (r - 10);
        const y = cy + Math.sin(a) * (r - 10);
        ctx.fillRect(Math.round(x), Math.round(y), 30 + Math.round(hash(i + 4) * 40), 6);
    }
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    for (let i = 0; i < 14; i++) {
        const a = -Math.PI / 2 + (hash(i + 40) - 0.5) * 0.9 - camX * 0.00008;
        const x = cx + Math.cos(a) * (r - 4);
        const y = cy + Math.sin(a) * (r - 4);
        ctx.fillRect(Math.round(x), Math.round(y), 20 + Math.round(hash(i + 8) * 30), 3);
    }
    ctx.strokeStyle = "rgba(140, 200, 255, 0.6)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2, Math.PI, Math.PI * 2);
    ctx.stroke();
}

export function drawTiles(ctx, world, camX, camY, time) {
    const t = themeOf(world.level);
    const x0 = Math.max(0, Math.floor(camX / TILE));
    const x1 = Math.min(world.width - 1, Math.floor((camX + VIEW_W) / TILE));
    const y0 = Math.max(0, Math.floor(camY / TILE));
    const y1 = Math.min(world.height - 1, Math.floor((camY + VIEW_H) / TILE));
    for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
            const ch = world.tileAt(tx, ty);
            if (ch === ".") continue;
            const x = tx * TILE - camX;
            const y = ty * TILE - camY;
            switch (ch) {
                case "#":
                    drawGround(ctx, t, x, y, world.tileAt(tx, ty - 1) !== "#" && world.tileAt(tx, ty - 1) !== "^", tx, ty);
                    break;
                case "=":
                    drawBlock(ctx, world.level.theme, t, x, y, tx);
                    break;
                case "-":
                    drawOneWay(ctx, t, x, y);
                    break;
                case "^":
                    drawSpikes(ctx, world.level.theme, x, y);
                    break;
                case "B":
                    drawSpring(ctx, x, y);
                    break;
                case "V":
                    drawVentBase(ctx, x, y);
                    break;
                default:
                    throw new Error(`Unknown tile "${ch}"`);
            }
        }
    }
    for (const vent of world.vents) drawSteam(ctx, world, vent, camX, camY, time);
}

function drawGround(ctx, t, x, y, top, tx, ty) {
    ctx.fillStyle = t.ground;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = t.groundDark;
    if (hash(tx * 31 + ty) > 0.5) ctx.fillRect(x + 3, y + 8, 3, 2);
    if (hash(tx * 17 + ty * 5) > 0.6) ctx.fillRect(x + 10, y + 12, 2, 2);
    if (top) {
        ctx.fillStyle = t.groundTop;
        ctx.fillRect(x, y, TILE, 4);
        ctx.fillStyle = t.groundDark;
        ctx.fillRect(x, y + 4, TILE, 1);
    }
}

function drawBlock(ctx, theme, t, x, y, tx) {
    ctx.fillStyle = t.block;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = t.blockLine;
    if (theme === "campus") {
        // bookshelf
        const colors = ["#c0392b", "#2e86c1", "#27ae60", "#f1c40f", "#8e44ad"];
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = colors[(tx + i) % colors.length] ?? "#c0392b";
            ctx.fillRect(x + 1 + i * 4, y + 2, 3, 12);
        }
        ctx.fillStyle = t.blockLine;
        ctx.fillRect(x, y + 14, TILE, 2);
    } else if (theme === "pad") {
        // steel girder with lattice
        ctx.fillRect(x, y, TILE, 2);
        ctx.fillRect(x, y + 14, TILE, 2);
        for (let i = 0; i < TILE; i++) {
            ctx.fillRect(x + i, y + 2 + Math.round((i / TILE) * 12), 1, 1);
            ctx.fillRect(x + i, y + 13 - Math.round((i / TILE) * 12), 1, 1);
        }
    } else if (theme === "space") {
        // gold foil instrument box
        ctx.fillRect(x, y, TILE, 1);
        ctx.fillRect(x, y, 1, TILE);
        ctx.fillStyle = "#f3d36b";
        ctx.fillRect(x + 3, y + 3, 4, 2);
        ctx.fillRect(x + 9, y + 9, 3, 2);
    } else {
        ctx.fillRect(x, y + 7, TILE, 1);
        ctx.fillRect(x + 7, y, 1, 7);
        ctx.fillRect(x + 2, y + 8, 1, 8);
        ctx.fillRect(x + 12, y + 8, 1, 8);
    }
}

function drawOneWay(ctx, t, x, y) {
    ctx.fillStyle = t.plank;
    ctx.fillRect(x, y, TILE, 5);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(x, y + 4, TILE, 1);
    ctx.fillRect(x + 7, y, 1, 4);
}

function drawSpikes(ctx, theme, x, y) {
    const base = theme === "space" ? "#ff6a3d" : "#c9ced6";
    const shade = theme === "space" ? "#b8361a" : "#7f8792";
    for (let i = 0; i < 4; i++) {
        const sx = x + i * 4;
        ctx.fillStyle = shade;
        ctx.fillRect(sx, y + 12, 4, 4);
        ctx.fillStyle = base;
        ctx.fillRect(sx + 1, y + 8, 2, 4);
        ctx.fillRect(sx + 1, y + 6, 1, 2);
    }
}

function drawSpring(ctx, x, y) {
    ctx.fillStyle = "#555b66";
    ctx.fillRect(x, y + 10, TILE, 6);
    ctx.fillStyle = "#e5e9ef";
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 3, y + 4 + i * 2, 10, 1);
    ctx.fillStyle = "#e23b3b";
    ctx.fillRect(x + 1, y, TILE - 2, 4);
}

function drawVentBase(ctx, x, y) {
    ctx.fillStyle = "#4a525c";
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = "#1e2329";
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 2 + i * 3, y + 2, 2, 5);
    ctx.fillStyle = "#f0b429";
    ctx.fillRect(x, y + 10, TILE, 2);
}

function drawSteam(ctx, world, vent, camX, camY, time) {
    const box = world.ventBox(vent);
    const x = box.x - camX;
    const y = box.y - camY;
    if (x < -TILE || x > VIEW_W + TILE || y > VIEW_H || y + box.h < 0) return;
    if (world.ventActive(vent, time)) {
        for (let i = 0; i < 9; i++) {
            const py = y + box.h - ((time * 90 + i * 17) % box.h);
            const wob = Math.sin(time * 10 + i) * 2;
            ctx.fillStyle = `rgba(240,245,250,${0.55 + (i % 3) * 0.1})`;
            ctx.fillRect(Math.round(x - 2 + wob), Math.round(py), box.w + 4, 6);
        }
    } else {
        // brief warning puffs shortly before the vent fires
        const phase = ((vent.tx * 0.37) % 1) * VENT_PERIOD;
        const t = (time + phase) % VENT_PERIOD;
        if (t > VENT_PERIOD - 0.5 || t < VENT_ACTIVE) {
            ctx.fillStyle = "rgba(240,245,250,0.5)";
            ctx.fillRect(Math.round(x + 2), Math.round(y + VENT_HEIGHT * TILE - 6 - (t % 0.25) * 16), 4, 3);
        }
    }
}

export function drawCollectible(ctx, kind, x, y, t) {
    const bob = Math.round(Math.sin(t * 4) * 1.5);
    const py = y + bob;
    switch (kind) {
        case "star":
            ctx.fillStyle = "#ffd23f";
            ctx.fillRect(x + 4, py, 2, 10);
            ctx.fillRect(x, py + 3, 10, 2);
            ctx.fillRect(x + 2, py + 2, 6, 5);
            ctx.fillRect(x + 1, py + 7, 2, 2);
            ctx.fillRect(x + 7, py + 7, 2, 2);
            ctx.fillStyle = "#fff6c2";
            ctx.fillRect(x + 4, py + 3, 1, 2);
            break;
        case "book":
            ctx.fillStyle = "#b03030";
            ctx.fillRect(x, py, 10, 10);
            ctx.fillStyle = "#f4ecd8";
            ctx.fillRect(x + 8, py + 1, 2, 8);
            ctx.fillStyle = "#ffd23f";
            ctx.fillRect(x + 2, py + 3, 4, 1);
            break;
        case "patch":
            ctx.fillStyle = "#003399";
            ctx.fillRect(x + 2, py, 6, 10);
            ctx.fillRect(x, py + 2, 10, 6);
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(x + 4, py + 2, 2, 6);
            ctx.fillRect(x + 2, py + 4, 6, 2);
            break;
        case "bolt":
            ctx.fillStyle = "#c9ced6";
            ctx.fillRect(x + 2, py, 6, 10);
            ctx.fillRect(x, py + 2, 10, 6);
            ctx.fillStyle = "#5c636e";
            ctx.fillRect(x + 3, py + 3, 4, 4);
            break;
        case "data":
            // 3.5" floppy disk
            ctx.fillStyle = "#2b2f36";
            ctx.fillRect(x, py, 10, 10);
            ctx.fillStyle = "#c9ced6";
            ctx.fillRect(x + 2, py, 5, 3);
            ctx.fillStyle = "#f4f4f4";
            ctx.fillRect(x + 2, py + 5, 6, 5);
            break;
        default:
            throw new Error(`Unknown collectible "${kind}"`);
    }
}

export function drawCheckpoint(ctx, cp, camX, camY, t) {
    const x = Math.round(cp.tileX - camX);
    const y = Math.round(cp.tileY - camY);
    ctx.fillStyle = "#d9dde3";
    ctx.fillRect(x + 7, y - 14, 2, 30);
    if (cp.active) {
        const wave = Math.round(Math.sin(t * 6));
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(x + 9, y - 14 + wave, 3, 9);
        ctx.fillStyle = "#fdda24";
        ctx.fillRect(x + 12, y - 14, 3, 9);
        ctx.fillStyle = "#ef3340";
        ctx.fillRect(x + 15, y - 14 - wave, 3, 9);
    } else {
        ctx.fillStyle = "#8a9099";
        ctx.fillRect(x + 9, y - 14, 8, 7);
    }
}

export function drawGoal(ctx, level, world, camX, camY, t) {
    const x = Math.round(world.goal.x - camX);
    const y = Math.round(world.goal.y - camY);
    const glow = 0.25 + Math.sin(t * 3) * 0.15;
    ctx.fillStyle = `rgba(255, 240, 160, ${glow})`;
    ctx.fillRect(x - 4, y - 20, TILE + 8, TILE + 20);
    switch (level.theme) {
        case "village":
            // telescope on a tripod
            ctx.fillStyle = "#5a3a22";
            ctx.fillRect(x + 7, y + 6, 2, 10);
            ctx.fillRect(x + 3, y + 12, 2, 4);
            ctx.fillRect(x + 11, y + 12, 2, 4);
            ctx.fillStyle = "#c08a3e";
            for (let i = 0; i < 12; i++) ctx.fillRect(x + 1 + i, y + 6 - Math.round(i * 0.6), 4, 4);
            ctx.fillStyle = "#88c8ff";
            ctx.fillRect(x + 13, y - 3, 2, 4);
            break;
        case "campus":
            // diploma scroll
            ctx.fillStyle = "#f4ecd8";
            ctx.fillRect(x, y + 4, 16, 9);
            ctx.fillStyle = "#d8ccb0";
            ctx.fillRect(x, y + 4, 2, 9);
            ctx.fillRect(x + 14, y + 4, 2, 9);
            ctx.fillStyle = "#b03030";
            ctx.fillRect(x + 7, y + 4, 2, 9);
            ctx.fillRect(x + 6, y + 13, 4, 3);
            break;
        case "lab":
            // selection letter with ESA-blue seal
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(x, y + 3, 16, 12);
            ctx.fillStyle = "#c9cad3";
            for (let i = 0; i < 6; i++) ctx.fillRect(x + i + 1, y + 3 + Math.floor(i / 1.2), 1, 1);
            for (let i = 0; i < 6; i++) ctx.fillRect(x + 14 - i, y + 3 + Math.floor(i / 1.2), 1, 1);
            ctx.fillStyle = "#003399";
            ctx.fillRect(x + 6, y + 8, 4, 4);
            break;
        case "pad":
            // orbiter side hatch
            ctx.fillStyle = "#f4f4f2";
            ctx.fillRect(x - 2, y - 14, 20, 30);
            ctx.fillStyle = "#1d1d22";
            ctx.fillRect(x + 2, y - 6, 12, 14);
            ctx.fillRect(x + 4, y - 8, 8, 18);
            ctx.fillStyle = "#3a6fb0";
            ctx.fillRect(x + 6, y - 4, 4, 4);
            break;
        case "space":
            // Belgian flag
            ctx.fillStyle = "#d9dde3";
            ctx.fillRect(x + 1, y - 14, 2, 30);
            ctx.fillStyle = "#1a1a1a";
            ctx.fillRect(x + 3, y - 14, 4, 12);
            ctx.fillStyle = "#fdda24";
            ctx.fillRect(x + 7, y - 14, 4, 12);
            ctx.fillStyle = "#ef3340";
            ctx.fillRect(x + 11, y - 14, 4, 12);
            break;
        default:
            throw new Error(`Unknown theme "${level.theme}"`);
    }
}

export function drawEnemy(ctx, theme, e, camX, camY) {
    const x = Math.round(e.x - camX);
    const y = Math.round(e.y - camY);
    if (!e.alive) {
        ctx.globalAlpha = Math.max(0, 1 - e.squash * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x, y + e.h - 4, e.w, 4);
        ctx.globalAlpha = 1;
        return;
    }
    if (e.kind === "walker") {
        if (theme === "village" || theme === "campus") drawPigeon(ctx, x, y, e.vx > 0, e.t);
        else drawRobot(ctx, x, y, e.vx > 0, e.t);
    } else if (theme === "space") {
        drawDebris(ctx, x, y, e.t);
    } else if (theme === "lab") {
        drawDrone(ctx, x, y, e.t);
    } else {
        drawBird(ctx, x, y, e.facing > 0, e.t, theme === "pad" ? "#f4f4f4" : "#24242b");
    }
}

function drawPigeon(ctx, x, y, right, t) {
    const f = right ? (dx) => x + dx : (dx) => x + 13 - dx;
    const step = Math.floor(t * 8) % 2;
    ctx.fillStyle = "#8d93a0";
    ctx.fillRect(Math.min(f(1), f(10)), y + 4, 10, 6);
    ctx.fillStyle = "#6f7480";
    ctx.fillRect(Math.min(f(9), f(12)), y + 1, 4, 5);
    ctx.fillStyle = "#4fa58c";
    ctx.fillRect(Math.min(f(9), f(10)), y + 5, 2, 2);
    ctx.fillStyle = "#f0a030";
    ctx.fillRect(f(13), y + 3, 1, 1);
    ctx.fillStyle = "#111111";
    ctx.fillRect(f(11), y + 2, 1, 1);
    ctx.fillStyle = "#e07a5f";
    ctx.fillRect(f(4 + step), y + 10, 1, 2);
    ctx.fillRect(f(7 - step), y + 10, 1, 2);
}

function drawRobot(ctx, x, y, right, t) {
    ctx.fillStyle = "#c9ced6";
    ctx.fillRect(x + 1, y + 2, 12, 8);
    ctx.fillStyle = "#5c636e";
    ctx.fillRect(x + 1, y + 10, 12, 2);
    ctx.fillStyle = "#ff4d4d";
    ctx.fillRect(x + (right ? 9 : 3), y + 4, 2, 2);
    ctx.fillStyle = "#ffd23f";
    if (Math.floor(t * 3) % 2 === 0) ctx.fillRect(x + 6, y, 2, 2);
}

function drawDrone(ctx, x, y, t) {
    ctx.fillStyle = "#c9ced6";
    ctx.fillRect(x + 3, y + 3, 8, 5);
    ctx.fillStyle = "#5c636e";
    const spin = Math.floor(t * 20) % 2 === 0 ? 6 : 3;
    ctx.fillRect(x, y, spin, 1);
    ctx.fillRect(x + 14 - spin, y, spin, 1);
    ctx.fillRect(x + 2, y + 1, 1, 2);
    ctx.fillRect(x + 11, y + 1, 1, 2);
    ctx.fillStyle = "#56d364";
    ctx.fillRect(x + 6, y + 5, 2, 2);
}

function drawBird(ctx, x, y, right, t, color) {
    const flap = Math.floor(t * 8) % 2;
    ctx.fillStyle = color;
    ctx.fillRect(x + 3, y + 4, 8, 4);
    ctx.fillRect(x + (right ? 10 : 1), y + 3, 3, 3);
    if (flap) {
        ctx.fillRect(x + 1, y + 1, 5, 3);
        ctx.fillRect(x + 8, y + 1, 5, 3);
    } else {
        ctx.fillRect(x, y + 6, 5, 2);
        ctx.fillRect(x + 9, y + 6, 5, 2);
    }
    ctx.fillStyle = "#f0a030";
    ctx.fillRect(x + (right ? 13 : 0), y + 4, 1, 1);
}

function drawDebris(ctx, x, y, t) {
    ctx.save();
    ctx.translate(x + 7, y + 5);
    ctx.rotate(t * 1.5);
    ctx.fillStyle = "#9aa1ab";
    ctx.fillRect(-6, -3, 12, 6);
    ctx.fillStyle = "#2c55a8";
    ctx.fillRect(-5, -2, 4, 4);
    ctx.fillRect(1, -2, 4, 4);
    ctx.restore();
}

// Shuttle stack (side view) for the launch cutscene; (x, y) is the base centre.
export function drawShuttleStack(ctx, x, y, flame) {
    // external tank
    ctx.fillStyle = "#d9742b";
    ctx.fillRect(x - 8, y - 120, 16, 112);
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 120);
    ctx.lineTo(x, y - 140);
    ctx.lineTo(x + 8, y - 120);
    ctx.fill();
    // solid rocket boosters
    ctx.fillStyle = "#f2f2f2";
    ctx.fillRect(x - 15, y - 106, 6, 104);
    ctx.fillRect(x + 9, y - 106, 6, 104);
    ctx.fillRect(x - 14, y - 112, 4, 6);
    ctx.fillRect(x + 10, y - 112, 4, 6);
    // orbiter, mounted belly-to-tank with the tail fin pointing away
    ctx.fillStyle = "#f7f7f5";
    ctx.fillRect(x + 15, y - 84, 12, 74);
    ctx.beginPath();
    ctx.moveTo(x + 15, y - 84);
    ctx.lineTo(x + 17, y - 98);
    ctx.lineTo(x + 27, y - 84);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 27, y - 36);
    ctx.lineTo(x + 39, y - 14);
    ctx.lineTo(x + 27, y - 14);
    ctx.fill();
    ctx.fillStyle = "#1d1d22";
    ctx.fillRect(x + 15, y - 96, 3, 86);
    ctx.fillRect(x + 22, y - 80, 3, 3);
    ctx.fillStyle = "#f7f7f5";
    ctx.fillRect(x + 18, y - 22, 4, 14);
    if (flame) {
        const f = 16 + Math.random() * 14;
        ctx.fillStyle = "#fff2a8";
        ctx.fillRect(x - 15, y - 2, 6, f);
        ctx.fillRect(x + 9, y - 2, 6, f);
        ctx.fillRect(x + 17, y - 10, 6, f * 0.6);
        ctx.fillStyle = "#ff9a3c";
        ctx.fillRect(x - 14, y + f - 2, 4, 8);
        ctx.fillRect(x + 10, y + f - 2, 4, 8);
    }
}

// Orbiter alone (side view, facing right) for the landing cutscene.
export function drawOrbiter(ctx, x, y) {
    ctx.fillStyle = "#f7f7f5";
    ctx.fillRect(x - 40, y - 6, 70, 10);
    ctx.beginPath();
    ctx.moveTo(x + 30, y - 6);
    ctx.lineTo(x + 44, y + 1);
    ctx.lineTo(x + 30, y + 4);
    ctx.fill();
    ctx.fillStyle = "#1d1d22";
    ctx.fillRect(x - 40, y + 2, 82, 3);
    ctx.fillRect(x + 28, y - 4, 6, 3);
    ctx.fillStyle = "#e5e5e2";
    ctx.beginPath();
    ctx.moveTo(x - 30, y - 6);
    ctx.lineTo(x - 42, y - 24);
    ctx.lineTo(x - 34, y - 24);
    ctx.lineTo(x - 18, y - 6);
    ctx.fill();
    ctx.fillStyle = "#1d1d22";
    ctx.beginPath();
    ctx.moveTo(x - 20, y + 4);
    ctx.lineTo(x + 6, y + 4);
    ctx.lineTo(x - 26, y + 10);
    ctx.fill();
}
