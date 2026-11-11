// Pixel sprites. Each sprite is a list of rows; every character is a palette key
// and "." is transparent.
//
// The hero is modelled on Dirk Frimout's 1992 NASA STS-45 crew portrait: bald
// crown, a fluffy ring of grey hair at the sides and back, a dark moustache, and
// (for launch day) the orange launch-and-entry suit with a Belgian flag patch.

const HEAD = [
    "....ssss....",
    "...hsssss...",
    "..hhssssss..",
    ".Hhhsssses..",
    ".hhhSssssss.",
    "..hhssmmmms.",
    "...sssssss..",
    "..aaaaaaaa..",
];

const TORSO = [
    "..cccccccc..",
    ".cccfyrcccc.",
    ".cCccccccCc.",
    ".kCccccccCk.",
    "..cccccccc..",
];

const LEGS = {
    idle: ["..ppp..ppp..", "..ppp..ppp..", ".bbbb..bbbb."],
    run1: ["..ppp..ppp..", ".ppp....ppp.", "bbb......bbb"],
    run2: ["...pppppp...", "....pppp....", "....bbbbb..."],
    jump: ["..ppp..ppp..", "..ppp...ppp.", "..bbb....bbb"],
};

// Front-facing bust for the title and ending screens.
export const PORTRAIT = [
    "......ssss......",
    "....ssssssss....",
    "...ssssssssss...",
    "..hssssssssssh..",
    ".hhsssssssssshh.",
    "HhhssessssesshhH",
    "HhhSsssSSsssShhH",
    ".hhssmmmmmmsshh.",
    "..hssswwwwsssh..",
    "...ssssssssss...",
    "....ssssssss....",
    "...aaaaaaaaaa...",
    "..aaccccccccaa..",
    ".cccccccccccccc.",
    "ccccccccccfyrccc",
    "cccccccccccccccc",
    "cCcccccwcccccCcc",
    "cCcccccwcccccCcc",
    "cCccccccccccccCc",
];

export const HERO_W = 12;
export const HERO_H = 16;

export const HERO_FRAMES = Object.fromEntries(
    Object.entries(LEGS).map(([name, legs]) => [name, [...HEAD, ...TORSO, ...legs]]),
);

const SKIN = {
    s: "#f1c3a2",
    S: "#d08a6e",
    k: "#f1c3a2",
    h: "#cfc6ba",
    H: "#a59c90",
    m: "#5b3a26",
    e: "#1d1d28",
    w: "#ffffff",
};

const BELGIAN_FLAG = { f: "#1a1a1a", y: "#fdda24", r: "#ef3340" };

export const OUTFITS = {
    sweater: { c: "#2f5d8a", C: "#244a6e", a: "#ecebe6", p: "#3b3b4c", b: "#4a3222", flag: false },
    labcoat: { c: "#f4f4f2", C: "#c9cad3", a: "#7393ba", p: "#3b3b4c", b: "#2c2c34", flag: false },
    pumpkin: { c: "#f47b20", C: "#c95d12", a: "#1b1b1f", p: "#e06d18", b: "#1b1b1f", k: "#f0f0f0", flag: true },
    polo: { c: "#2c55a8", C: "#1e3e7e", a: "#2c55a8", p: "#6e5c3f", b: "#e2e2e2", flag: true },
};

export function heroPalette(outfitName) {
    const outfit = OUTFITS[outfitName] ?? OUTFITS.sweater;
    const palette = { ...SKIN, ...outfit };
    if (outfit.flag) Object.assign(palette, BELGIAN_FLAG);
    else Object.assign(palette, { f: outfit.c, y: outfit.c, r: outfit.c });
    return palette;
}

// Draws a sprite with its top-left at (x, y). Mirrors horizontally when flip is set.
export function drawSprite(ctx, rows, palette, x, y, flip = false, scale = 1) {
    const w = rows[0]?.length ?? 0;
    rows.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
            const key = row[rx];
            if (key === "." || key === undefined) continue;
            const color = palette[key];
            if (typeof color !== "string") continue;
            const px = flip ? w - 1 - rx : rx;
            ctx.fillStyle = color;
            ctx.fillRect(x + px * scale, y + ry * scale, scale, scale);
        }
    });
}
