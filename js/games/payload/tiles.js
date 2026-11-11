// Tile art for Payload Swap: 12x12 pixel sprites, pre-rendered at 2x.
import { drawSprite } from "../../core/sprites.js";

export const TILE_PX = 24;

const ART = [
    {
        // 0 hop cone
        color: "#6fbf3f",
        palette: { g: "#8bd14f", G: "#4f8f2f", s: "#6b4a2a" },
        rows: [
            ".....ss.....",
            ".....s......",
            "....gggg....",
            "...gGgGgg...",
            "..ggGggGgg..",
            "..gGggGggg..",
            "..ggGggGgg..",
            "..gGggGggg..",
            "...ggGggg...",
            "...gGggGg...",
            "....gggg....",
            ".....gg.....",
        ],
    },
    {
        // 1 Belgian waffle
        color: "#e6a93a",
        palette: { Y: "#f2c25a", y: "#b8782a", h: "#8a5418" },
        rows: [
            "............",
            ".YYYYYYYYYY.",
            ".YhyYhyYhyY.",
            ".YyyYyyYyyY.",
            ".YYYYYYYYYY.",
            ".YhyYhyYhyY.",
            ".YyyYyyYyyY.",
            ".YYYYYYYYYY.",
            ".YhyYhyYhyY.",
            ".YyyYyyYyyY.",
            ".YYYYYYYYYY.",
            "............",
        ],
    },
    {
        // 2 Earth
        color: "#3d7fd0",
        palette: { b: "#3d7fd0", B: "#2a5ea8", l: "#4fae4a", w: "#ffffff" },
        rows: [
            "....bbbb....",
            "..bbllbbbb..",
            ".bblllbbwwb.",
            ".blllbbbbbb.",
            "bbllbbbbllbb",
            "bbbbbbblllbb",
            "bwwbbbbllbbB",
            "bbbbllbbbbbB",
            ".bbblllbbbB.",
            ".bbbbllbbBB.",
            "..bbbbbbBB..",
            "....BBBB....",
        ],
    },
    {
        // 3 Sun
        color: "#ff8a1f",
        palette: { o: "#ff8a1f", y: "#ffd23f", r: "#ffb347" },
        rows: [
            ".....rr.....",
            ".r...rr...r.",
            "..r.oooo.r..",
            "...oyyyyo...",
            "..oyyyyyyo..",
            "rroyyyyyyorr",
            "rroyyyyyyorr",
            "..oyyyyyyo..",
            "...oyyyyo...",
            "..r.oooo.r..",
            ".r...rr...r.",
            ".....rr.....",
        ],
    },
    {
        // 4 floppy disk
        color: "#8e5bd6",
        palette: { P: "#5d3a9a", p: "#8e5bd6", s: "#c9ced6", w: "#f4f4f4" },
        rows: [
            "PPPPPPPPPPP.",
            "PppsssssppPP",
            "PppsPsssppPP",
            "PppsssssppPP",
            "PppppppppppP",
            "PpwwwwwwwwpP",
            "PpwwwwwwwwpP",
            "PpwPPPPPPwpP",
            "PpwwwwwwwwpP",
            "PpwwwwwwwwpP",
            "PppppppppppP",
            "PPPPPPPPPPPP",
        ],
    },
    {
        // 5 astronaut helmet
        color: "#e9edf2",
        palette: { w: "#f4f4f4", W: "#c9ced6", v: "#2b3550", V: "#6d8fd6", k: "#7d838c" },
        rows: [
            "...wwwwww...",
            "..wwwwwwww..",
            ".wwvvvvvvww.",
            ".wvVVvvvvvw.",
            "wwvVvvvvvvww",
            "wwvvvvvvvvww",
            "wwvvvvvvvvww",
            "Wwwvvvvvvwww",
            "WWwwwwwwwwwW",
            ".WWWWWWWWWW.",
            ".kkWWWWWWkk.",
            "..kkkkkkkk..",
        ],
    },
];

export const TILE_COLORS = ART.map((a) => a.color);

let rendered = null;

// Offscreen 24x24 canvas per tile type, built on first use.
export function tileCanvases() {
    if (rendered) return rendered;
    rendered = ART.map((a) => {
        const c = document.createElement("canvas");
        c.width = TILE_PX;
        c.height = TILE_PX;
        const ctx = c.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context unavailable");
        drawSprite(ctx, a.rows, a.palette, 0, 0, false, 2);
        return c;
    });
    return rendered;
}

// Rocket marking: arrows on the cleared axis and a bright stripe.
export function drawRocketOverlay(ctx, special, cx, cy, size, time) {
    const pulse = 0.6 + Math.sin(time * 8) * 0.4;
    ctx.fillStyle = `rgba(255,255,255,${0.55 * pulse})`;
    const h = Math.max(1, Math.round(size / 8));
    if (special === "row") {
        ctx.fillRect(Math.round(cx - size / 2), Math.round(cy - h / 2), Math.round(size), h);
        arrow(ctx, cx - size / 2 + 1, cy, -1, 0, size);
        arrow(ctx, cx + size / 2 - 1, cy, 1, 0, size);
    } else {
        ctx.fillRect(Math.round(cx - h / 2), Math.round(cy - size / 2), h, Math.round(size));
        arrow(ctx, cx, cy - size / 2 + 1, 0, -1, size);
        arrow(ctx, cx, cy + size / 2 - 1, 0, 1, size);
    }
}

function arrow(ctx, x, y, dx, dy, size) {
    const s = Math.max(2, Math.round(size / 8));
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < s; i++) {
        const w = (s - i) * 2 - 1;
        if (dx !== 0) ctx.fillRect(Math.round(x + dx * i), Math.round(y - w / 2), 1, w);
        else ctx.fillRect(Math.round(x - w / 2), Math.round(y + dy * i), w, 1);
    }
}

// Solar flare: a pulsing white-hot core with flickering rays.
export function drawFlare(ctx, cx, cy, size, time) {
    const r = size / 2;
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + time * 1.5;
        const len = r * (0.75 + 0.25 * Math.sin(time * 9 + i));
        ctx.strokeStyle = i % 2 === 0 ? "#ff6a3d" : "#ffd23f";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
        ctx.stroke();
    }
    ctx.fillStyle = "#ffd23f";
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx, cy, r * (0.25 + 0.05 * Math.sin(time * 10)), 0, Math.PI * 2);
    ctx.fill();
}
