import { VIEW_W, VIEW_H } from "./screen.js";

export const FONT = '"Press Start 2P", ui-monospace, monospace';

export function drawText(ctx, text, x, y, size, color, align = "left") {
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillText(text, x + 1, y + 1);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
}

// Word-wraps lines to maxWidth at the given font size. Empty lines are kept.
export function wrap(ctx, lines, size, maxWidth) {
    ctx.font = `${size}px ${FONT}`;
    const out = [];
    for (const line of lines) {
        if (line === "") {
            out.push("");
            continue;
        }
        let current = "";
        for (const word of line.split(" ")) {
            const next = current ? `${current} ${word}` : word;
            if (ctx.measureText(next).width > maxWidth && current) {
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

// Centered framed panel. The first line is the heading.
export function drawPanel(ctx, lines) {
    const h = lines.length * 14 + 24;
    const y0 = Math.round((VIEW_H - h) / 2);
    ctx.fillStyle = "rgba(4, 8, 20, 0.82)";
    ctx.fillRect(70, y0, VIEW_W - 140, h);
    ctx.strokeStyle = "#ffd23f";
    ctx.lineWidth = 1;
    ctx.strokeRect(70.5, y0 + 0.5, VIEW_W - 141, h - 1);
    lines.forEach((line, i) =>
        drawText(ctx, line, VIEW_W / 2, y0 + 14 + i * 14, i === 0 ? 8 : 7, i === 0 ? "#ffd23f" : "#ffffff", "center"),
    );
}

// Vertical menu with a blinking cursor on the selected item.
export function drawMenu(ctx, items, selected, x, y, time, size = 8, spacing = 14) {
    items.forEach((label, i) => {
        const isSel = i === selected;
        const blink = isSel && Math.floor(time * 2.5) % 2 === 0;
        const color = isSel ? (blink ? "#ffffff" : "#ffd23f") : "#8fa3bd";
        drawText(ctx, `${isSel ? ">" : " "} ${label}`, x, y + i * spacing, size, color, "center");
    });
}

export function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
}
