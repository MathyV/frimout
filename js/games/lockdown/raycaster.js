// Software raycaster: textured walls with sliding doors, floor/ceiling
// casting, distance shading and depth-sorted billboard sprites.
import { VIEW_W as W, VIEW_H as H } from "../../core/screen.js";
import { TEX, WALL_TEXTURES, FLOOR, CEILING } from "./textures.js";
import { WALLS, DOOR } from "./world.js";

export const PLANE = 0.66;
export const PROJ = W / 2 / PLANE;
const HALF = H / 2;
const FOG = 11;
const MAX_STEPS = 96;

// Camera from position and angle. The plane points to the camera's right.
export function camera(x, y, angle) {
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    return { x, y, dirX, dirY, planeX: -dirY * PLANE, planeY: dirX * PLANE };
}

function shadeOf(dist) {
    return Math.max(48, Math.min(256, Math.round(256 * (1.15 - dist / FOG))));
}

function shade(c, s) {
    const r = ((c & 255) * s) >> 8;
    const g = (((c >> 8) & 255) * s) >> 8;
    const b = (((c >> 16) & 255) * s) >> 8;
    return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
}

export class Raycaster {
    constructor() {
        this.image = new ImageData(W, H);
        this.buf = new Uint32Array(this.image.data.buffer);
        this.zbuf = new Float64Array(W);
    }

    // sprites: { x, y, tex, size, elev, flash?, fullbright? }
    render(world, cam, sprites) {
        this.castFloor(cam);
        this.castWalls(world, cam);
        this.drawSprites(cam, sprites);
        return this.image;
    }

    castFloor(cam) {
        const buf = this.buf;
        const r0x = cam.dirX - cam.planeX;
        const r0y = cam.dirY - cam.planeY;
        const r1x = cam.dirX + cam.planeX;
        const r1y = cam.dirY + cam.planeY;
        // Floor rows HALF..H-1 mirror onto ceiling rows HALF-1..0, covering every row.
        for (let y = Math.floor(HALF); y < H; y++) {
            const p = y - HALF + 0.5;
            const rowDist = (0.5 * PROJ) / p;
            const s = shadeOf(rowDist);
            const stepX = (rowDist * (r1x - r0x)) / W;
            const stepY = (rowDist * (r1y - r0y)) / W;
            let fx = cam.x + rowDist * r0x;
            let fy = cam.y + rowDist * r0y;
            const floorRow = y * W;
            const ceilRow = (H - 1 - y) * W;
            for (let x = 0; x < W; x++) {
                const tx = Math.floor(TEX * (fx - Math.floor(fx))) & (TEX - 1);
                const ty = Math.floor(TEX * (fy - Math.floor(fy))) & (TEX - 1);
                const t = ty * TEX + tx;
                buf[floorRow + x] = shade(FLOOR.data[t] ?? 0, s);
                buf[ceilRow + x] = shade(CEILING.data[t] ?? 0, s);
                fx += stepX;
                fy += stepY;
            }
        }
    }

    castWalls(world, cam) {
        const buf = this.buf;
        for (let x = 0; x < W; x++) {
            const cameraX = (2 * x) / W - 1;
            const rdx = cam.dirX + cam.planeX * cameraX;
            const rdy = cam.dirY + cam.planeY * cameraX;
            let mapX = Math.floor(cam.x);
            let mapY = Math.floor(cam.y);
            const deltaX = rdx === 0 ? 1e30 : Math.abs(1 / rdx);
            const deltaY = rdy === 0 ? 1e30 : Math.abs(1 / rdy);
            const stepX = rdx < 0 ? -1 : 1;
            const stepY = rdy < 0 ? -1 : 1;
            let sideX = rdx < 0 ? (cam.x - mapX) * deltaX : (mapX + 1 - cam.x) * deltaX;
            let sideY = rdy < 0 ? (cam.y - mapY) * deltaY : (mapY + 1 - cam.y) * deltaY;

            let perp = FOG * 2;
            let u = 0;
            let side = 0;
            let tex = null;
            let isDoor = false;

            for (let i = 0; i < MAX_STEPS; i++) {
                if (sideX < sideY) {
                    sideX += deltaX;
                    mapX += stepX;
                    side = 0;
                } else {
                    sideY += deltaY;
                    mapY += stepY;
                    side = 1;
                }
                const ch = world.cell(mapX, mapY);
                if (ch === DOOR) {
                    const door = world.door(mapX, mapY);
                    if (!door) continue;
                    // Door slab sits in the middle of its cell, perpendicular to the passage.
                    if (door.axis === "x" && side === 0) {
                        const mid = sideX - deltaX + deltaX / 2;
                        if (mid < sideY) {
                            const hit = cam.y + mid * rdy;
                            const wallX = hit - Math.floor(hit);
                            if (wallX >= door.open) {
                                perp = mid;
                                u = wallX - door.open;
                                tex = WALL_TEXTURES.get(DOOR) ?? null;
                                isDoor = true;
                                break;
                            }
                        }
                    } else if (door.axis === "y" && side === 1) {
                        const mid = sideY - deltaY + deltaY / 2;
                        if (mid < sideX) {
                            const hit = cam.x + mid * rdx;
                            const wallX = hit - Math.floor(hit);
                            if (wallX >= door.open) {
                                perp = mid;
                                u = wallX - door.open;
                                tex = WALL_TEXTURES.get(DOOR) ?? null;
                                isDoor = true;
                                break;
                            }
                        }
                    }
                    continue;
                }
                if (WALLS.has(ch)) {
                    perp = side === 0 ? sideX - deltaX : sideY - deltaY;
                    const hit = side === 0 ? cam.y + perp * rdy : cam.x + perp * rdx;
                    u = hit - Math.floor(hit);
                    tex = WALL_TEXTURES.get(ch) ?? null;
                    break;
                }
            }

            this.zbuf[x] = perp;
            if (!tex) continue;
            let texX = Math.floor(u * TEX);
            if (!isDoor && ((side === 0 && rdx > 0) || (side === 1 && rdy < 0))) texX = TEX - 1 - texX;
            texX = Math.max(0, Math.min(TEX - 1, texX));

            const lineH = PROJ / perp;
            const top = HALF - lineH / 2;
            const y0 = Math.max(0, Math.floor(top));
            const y1 = Math.min(H, Math.ceil(top + lineH));
            const s = Math.round(shadeOf(perp) * (side === 1 ? 0.8 : 1));
            for (let y = y0; y < y1; y++) {
                const texY = Math.max(0, Math.min(TEX - 1, Math.floor(((y - top) / lineH) * TEX)));
                buf[y * W + x] = shade(tex.data[texY * TEX + texX] ?? 0, s);
            }
        }
    }

    // Screen projection of a world point; null when behind the camera.
    project(cam, x, y) {
        const sx = x - cam.x;
        const sy = y - cam.y;
        const invDet = 1 / (cam.planeX * cam.dirY - cam.dirX * cam.planeY);
        const tx = invDet * (cam.dirY * sx - cam.dirX * sy);
        const depth = invDet * (-cam.planeY * sx + cam.planeX * sy);
        if (depth <= 0.05) return null;
        return { screenX: (W / 2) * (1 + tx / depth), depth };
    }

    drawSprites(cam, sprites) {
        const buf = this.buf;
        const projected = [];
        for (const s of sprites) {
            const p = this.project(cam, s.x, s.y);
            if (p) projected.push({ s, p });
        }
        projected.sort((a, b) => b.p.depth - a.p.depth);

        for (const { s, p } of projected) {
            const tex = s.tex;
            const hPx = (PROJ * s.size) / p.depth;
            const wPx = (hPx * tex.w) / tex.h;
            const bottom = HALF + (PROJ * (0.5 - s.elev)) / p.depth;
            const top = bottom - hPx;
            const left = p.screenX - wPx / 2;
            const x0 = Math.max(0, Math.floor(left));
            const x1 = Math.min(W, Math.ceil(left + wPx));
            const y0 = Math.max(0, Math.floor(top));
            const y1 = Math.min(H, Math.ceil(bottom));
            const sh = s.fullbright ? 256 : shadeOf(p.depth);
            for (let x = x0; x < x1; x++) {
                if (p.depth >= (this.zbuf[x] ?? 0)) continue;
                const u = Math.min(tex.w - 1, Math.floor(((x - left) / wPx) * tex.w));
                for (let y = y0; y < y1; y++) {
                    const v = Math.min(tex.h - 1, Math.floor(((y - top) / hPx) * tex.h));
                    const c = tex.data[v * tex.w + u] ?? 0;
                    if (c === 0) continue;
                    buf[y * W + x] = s.flash ? 0xffffffff : shade(c, sh);
                }
            }
        }
    }
}
