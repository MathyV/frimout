// Verifies every level is completable using the real player physics.
// Explores standing positions breadth-first, simulating a fan of jump and
// steering inputs from each. Enemies are ignored and vents are treated as
// passable, because both are timing-dependent and can be waited out.
import { LEVELS } from "../js/levels.js";
import { World, TILE, overlaps } from "../js/world.js";
import { Player, physicsFor, PLAYER_W, PLAYER_H } from "../js/player.js";
import { spawnEntities } from "../js/entities.js";

const DT = 1 / 60;
const MAX_FRAMES = 300;
const JUMP_HOLDS = [0, 1, 4, 8, 14, 22, 60];
const SWITCH_FRAMES = [null, 8, 16, 28, 45];

function canStand(world, tx, ty) {
    return !world.isSolid(tx, ty) && (world.isSolid(tx, ty + 1) || world.isOneWay(tx, ty + 1));
}

function placePlayer(world, physics, tx, ty, vx) {
    const p = new Player(tx * TILE, ty * TILE, physics);
    p.vx = vx;
    p.step(world, { left: false, right: false, jumpPressed: false, jumpHeld: false }, DT);
    p.vx = vx;
    return p;
}

function simulate(world, physics, node, plan, items, touched) {
    const p = placePlayer(world, physics, node.tx, node.ty, plan.vx0);
    const goal = world.goalBox();
    let reachedGoal = false;
    for (let f = 0; f < MAX_FRAMES; f++) {
        const dir = plan.switchAt !== null && f >= plan.switchAt ? plan.dir2 : plan.dir;
        const input = {
            left: dir < 0,
            right: dir > 0,
            jumpPressed: plan.hold > 0 && f === 0,
            jumpHeld: f < plan.hold,
        };
        p.step(world, input, DT);

        items.forEach((box, i) => {
            if (overlaps(p.x, p.y, PLAYER_W, PLAYER_H, box.x, box.y, box.w, box.h)) touched.add(i);
        });
        if (overlaps(p.x, p.y, PLAYER_W, PLAYER_H, goal.x, goal.y, goal.w, goal.h)) reachedGoal = true;
        if (world.touchesSpikes(p.x, p.y, PLAYER_W, PLAYER_H) || p.y > world.pixelHeight) {
            return { landed: null, reachedGoal };
        }

        const tx = Math.floor((p.x + PLAYER_W / 2) / TILE);
        const ty = Math.floor((p.y + PLAYER_H - 1) / TILE);
        const moved = tx !== node.tx || ty !== node.ty;
        if (p.onGround && f > 1 && (plan.hold > 0 || moved)) {
            return { landed: canStand(world, tx, ty) ? { tx, ty } : null, reachedGoal };
        }
    }
    return { landed: null, reachedGoal };
}

function plansFor(world, physics, node) {
    const plans = [];
    for (const dir of [-1, 0, 1]) {
        const runup = dir !== 0 && canStand(world, node.tx - dir, node.ty);
        const starts = runup ? [0, dir * physics.runSpeed] : [0];
        for (const vx0 of starts) {
            for (const hold of JUMP_HOLDS) {
                for (const switchAt of SWITCH_FRAMES) {
                    const dir2s = switchAt === null ? [dir] : [0, -dir, dir === 0 ? 1 : dir, dir === 0 ? -1 : dir];
                    for (const dir2 of new Set(dir2s)) {
                        if (hold === 0 && (dir === 0 || switchAt !== null)) continue;
                        plans.push({ dir, dir2, switchAt, hold, vx0 });
                    }
                }
            }
        }
    }
    return plans;
}

function checkLevel(level) {
    const world = new World(level);
    const physics = physicsFor(level);
    const { pickups, checkpoints } = spawnEntities(world);
    const items = [
        ...pickups.map((p) => ({ ...p, label: `collectible at tile (${(p.x - 3) / TILE}, ${(p.y - 3) / TILE})` })),
        ...checkpoints.map((c) => ({ ...c, label: `checkpoint at tile (${c.tileX / TILE}, ${c.tileY / TILE})` })),
    ];
    const touched = new Set();

    const start = { tx: Math.floor(world.start.x / TILE), ty: Math.floor(world.start.y / TILE) };
    const seen = new Set([`${start.tx},${start.ty}`]);
    const queue = [start];
    let goalReached = false;

    while (queue.length > 0) {
        const node = queue.shift();
        for (const plan of plansFor(world, physics, node)) {
            const result = simulate(world, physics, node, plan, items, touched);
            if (result.reachedGoal) goalReached = true;
            if (!result.landed) continue;
            const key = `${result.landed.tx},${result.landed.ty}`;
            if (seen.has(key)) continue;
            seen.add(key);
            queue.push(result.landed);
        }
    }

    const missing = items.filter((_, i) => !touched.has(i)).map((item) => item.label);

    const overlay = level.map.map((row, ty) =>
        [...row].map((ch, tx) => (seen.has(`${tx},${ty}`) && ch === "." ? "*" : ch)).join(""),
    );

    return { goalReached, missing, standable: seen.size, overlay };
}

const verbose = process.argv.includes("--map");

let failed = false;
for (const level of LEVELS) {
    let result;
    try {
        result = checkLevel(level);
    } catch (err) {
        failed = true;
        console.log(`FAIL ${level.id}: ${err.message}`);
        continue;
    }
    const ok = result.goalReached && result.missing.length === 0;
    if (!ok) failed = true;
    console.log(`${ok ? "ok  " : "FAIL"} ${level.id}: goal ${result.goalReached ? "reachable" : "UNREACHABLE"}, ${result.standable} standing spots`);
    for (const m of result.missing) console.log(`       unreachable ${m}`);
    if (verbose && !ok) {
        console.log("       reachable standing spots marked *");
        result.overlay.forEach((row, ty) => console.log(`  ${String(ty).padStart(3)} ${row}`));
    }
}
process.exit(failed ? 1 : 0);
