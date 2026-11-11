import { VIEW_W, VIEW_H } from "./screen.js";

// Twinkling starfield above the curve of the Earth, used by menus and title screens.
export function drawSpaceBackdrop(ctx, time) {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, "#02030a");
    g.addColorStop(1, "#0d1838");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 120; i++) {
        const x = (Math.sin(i * 91.7) * 0.5 + 0.5) * VIEW_W;
        const y = (Math.sin(i * 47.3 + 1) * 0.5 + 0.5) * VIEW_H;
        ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(time * 0.8 + i));
        ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#3d7fd0";
    ctx.beginPath();
    ctx.arc(VIEW_W / 2, VIEW_H + 420, 470, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(140, 200, 255, 0.6)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(VIEW_W / 2, VIEW_H + 420, 472, Math.PI, Math.PI * 2);
    ctx.stroke();
}
