// Procedural textures and sprite art for Lab Lockdown. Textures are packed
// RGBA in a Uint32Array (little-endian ABGR); 0 is transparent.

export const TEX = 32;

export function rgb(r, g, b) {
    return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

function hex(color) {
    const n = Number.parseInt(color.slice(1), 16);
    return rgb((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

function noise(x, y, seed) {
    const s = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
    return s - Math.floor(s);
}

function make(fn) {
    const data = new Uint32Array(TEX * TEX);
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) data[y * TEX + x] = fn(x, y);
    return { w: TEX, h: TEX, data };
}

function vary(r, g, b, x, y, seed, amount) {
    const n = (noise(x, y, seed) - 0.5) * amount;
    return rgb(clamp8(r + n), clamp8(g + n), clamp8(b + n));
}

function clamp8(v) {
    return Math.max(0, Math.min(255, Math.round(v)));
}

function panel(x, y) {
    if (x % 16 === 0 || y % 16 === 0) return rgb(92, 100, 112);
    if (x % 16 === 15 || y % 16 === 15) return rgb(170, 178, 190);
    if ((x % 16 === 3 || x % 16 === 12) && (y % 16 === 3 || y % 16 === 12)) return rgb(70, 76, 86);
    return vary(138, 147, 160, x, y, 1, 10);
}

function rack(x, y) {
    if (x < 2 || x > 29) return rgb(60, 66, 76);
    if (y % 8 === 0) return rgb(20, 22, 28);
    const row = Math.floor(y / 8);
    if (y % 8 === 3 && x % 4 === 1 && x > 3 && x < 20) {
        const leds = [rgb(86, 211, 100), rgb(240, 180, 41), rgb(86, 211, 100), rgb(239, 51, 64)];
        return leds[(row + Math.floor(x / 4)) % leds.length] ?? rgb(86, 211, 100);
    }
    if (y % 8 >= 2 && y % 8 <= 5 && x >= 22 && x <= 27 && x % 2 === 0) return rgb(14, 16, 20);
    return vary(42, 47, 56, x, y, 2, 8);
}

function windowTex(x, y) {
    if (x < 3 || x > 28 || y < 3 || y > 28) return x < 2 || x > 29 || y < 2 || y > 29 ? rgb(92, 100, 112) : rgb(200, 205, 212);
    const ex = x - 16;
    const ey = y - 60;
    const d = Math.sqrt(ex * ex + ey * ey);
    if (d < 36) return d > 34.5 ? rgb(140, 200, 255) : noise(x, y, 9) > 0.8 ? rgb(240, 245, 250) : rgb(61, 127, 208);
    if (noise(x, y, 4) > 0.94) return rgb(255, 255, 255);
    return rgb(4, 8, 24);
}

function pipes(x, y) {
    const band = x % 11;
    if (band >= 2 && band <= 5) {
        const shade = band === 2 ? 0.7 : band === 5 ? 0.8 : 1;
        const base = Math.floor(x / 11) % 2 === 0 ? [214, 110, 40] : [70, 120, 190];
        if (y % 16 === 8) return rgb(60, 60, 64);
        return rgb(clamp8((base[0] ?? 0) * shade), clamp8((base[1] ?? 0) * shade), clamp8((base[2] ?? 0) * shade));
    }
    return vary(100, 108, 120, x, y, 3, 10);
}

function flagWall(x, y) {
    if (x >= 7 && x <= 24 && y >= 6 && y <= 20) {
        if (x < 13) return rgb(26, 26, 26);
        if (x < 19) return rgb(253, 218, 36);
        return rgb(239, 51, 64);
    }
    if (x >= 6 && x <= 25 && y >= 5 && y <= 21) return rgb(60, 60, 64);
    return panel(x, y);
}

function door(x, y) {
    if (y < 3 || y > 28) return (x + y) % 8 < 4 ? rgb(20, 20, 22) : rgb(240, 180, 41);
    if (x < 1 || x > 30) return rgb(120, 92, 20);
    if (x >= 11 && x <= 20 && y >= 8 && y <= 14) return rgb(110, 170, 220);
    if (y === 16) return rgb(150, 112, 20);
    return vary(217, 165, 33, x, y, 5, 14);
}

function exitHatch(x, y) {
    const cx = x - 15.5;
    const cy = y - 15.5;
    const r = Math.sqrt(cx * cx + cy * cy);
    if (r > 13 && r < 15) return rgb(220, 230, 225);
    if (r <= 13) {
        const chevron = (Math.abs(cx) + (y % 10)) % 10 < 3 && Math.abs(cx) < 8 && y > 6 && y < 26;
        return chevron ? rgb(240, 255, 245) : rgb(46, 139, 87);
    }
    return vary(60, 70, 66, x, y, 6, 10);
}

export const FLOOR = make((x, y) => {
    if (x % 16 === 0 || y % 16 === 0) return rgb(50, 54, 60);
    return vary(84, 90, 98, x, y, 7, 12);
});

export const CEILING = make((x, y) => {
    if (x >= 4 && x <= 27 && y >= 12 && y <= 19) return rgb(230, 236, 242);
    if (x % 32 === 0 || y % 32 === 0) return rgb(30, 34, 42);
    return vary(54, 60, 70, x, y, 8, 8);
});

export const WALL_TEXTURES = new Map([
    ["#", make(panel)],
    ["R", make(rack)],
    ["W", make(windowTex)],
    ["P", make(pipes)],
    ["F", make(flagWall)],
    ["D", make(door)],
    ["X", make(exitHatch)],
]);

// Sprite art: 16x16, "." is transparent.
const ROBOT = [
    "......oooo......",
    ".....kkkkkk.....",
    "....kmmmmmmk....",
    "...kmmeeeemmk...",
    "...kmmeEEemmk...",
    "...kmmmmmmmmk...",
    "....kkkkkkkk....",
    "..kkMMMMMMMMkk..",
    ".kMMMyMMMMyMMMk.",
    ".kMMMMMMMMMMMMk.",
    ".kMMMMlMMlMMMMk.",
    "..kkMMMMMMMMkk..",
    "...k.kkkkkk.k...",
    "..ttttt..ttttt..",
    "..tTtTt..tTtTt..",
    "..ttttt..ttttt..",
];

const WRECK = [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "......kkkk......",
    "....kmmmmmk.....",
    "...kmmddmmmk....",
    "..kkMMMMMMMMkk..",
    ".kMMMyMMMMyMMMk.",
    ".kMMMMMMMMMMMMk.",
    "..ttttt..ttttt..",
    "..tTtTt..tTtTt..",
    "..ttttt..ttttt..",
];

const DISK = [
    "..kkkkkkkkkkkk..",
    "..kkkssssskkkk..",
    "..kkkssksskkkk..",
    "..kkkssssskkkk..",
    "..kkkkkkkkkkkk..",
    "..kkwwwwwwwwkk..",
    "..kkwwwwwwwwkk..",
    "..kkwbbbbbbwkk..",
    "..kkwwwwwwwwkk..",
    "..kkkkkkkkkkkk..",
];

const WAFFLE = [
    "..gggggggggggg..",
    ".gGgGgGgGgGgGGg.",
    ".ggggggggggggggg",
    ".gGgGgGgGgGgGGg.",
    ".ggggggggggggggg",
    ".gGgGgGgGgGgGGg.",
    ".ggggggggggggggg",
    ".gGgGgGgGgGgGGg.",
    "..gggggggggggg..",
];

const CELL = [
    "......kkkk......",
    ".....kkkkkk.....",
    "....kNNNNNNk....",
    "....kNNNNNNk....",
    "....kNNwwNNk....",
    "....kNwwNNNk....",
    "....kNNwwNNk....",
    "....kNNNwwNk....",
    "....kNNwwNNk....",
    "....kNNNNNNk....",
    "....kNNNNNNk....",
    ".....kkkkkk.....",
];

const SPARK = [
    "......cc......",
    "....cCCCCc....",
    "...cCWWWWCc...",
    "..cCWWWWWWCc..",
    "..cCWWWWWWCc..",
    "...cCWWWWCc...",
    "....cCCCCc....",
    "......cc......",
];

const PALETTE = {
    o: "#ff8a1f",
    k: "#2b2f36",
    m: "#c9ced6",
    M: "#9aa1ab",
    e: "#7a1010",
    E: "#ff3b3b",
    d: "#3a1515",
    y: "#f0b429",
    l: "#56d364",
    t: "#3b3f46",
    T: "#7d838c",
    s: "#c9ced6",
    w: "#f4f4f4",
    b: "#2e86c1",
    g: "#c98a2b",
    G: "#8a5716",
    N: "#3fae5a",
    c: "#3fb5ff",
    C: "#9be3ff",
    W: "#ffffff",
};

function spriteTexture(rows, palette) {
    const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
    const h = rows.length;
    const data = new Uint32Array(w * h);
    rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
            const key = row[x];
            const color = key === undefined ? undefined : palette[key];
            if (key === "." || color === undefined) continue;
            data[y * w + x] = hex(color);
        }
    });
    return { w, h, data };
}

export const SPRITES = {
    robot: spriteTexture(ROBOT, PALETTE),
    robotFire: spriteTexture(ROBOT, { ...PALETTE, E: "#ffffff", e: "#ff3b3b" }),
    wreck: spriteTexture(WRECK, PALETTE),
    disk: spriteTexture(DISK, PALETTE),
    waffle: spriteTexture(WAFFLE, PALETTE),
    cell: spriteTexture(CELL, PALETTE),
    spark: spriteTexture(SPARK, PALETTE),
    zap: spriteTexture(SPARK, { ...PALETTE, c: "#ffd23f", C: "#fff2a8" }),
};
