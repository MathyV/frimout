// Verifies every Lab Lockdown map: rows, doors and tiles parse, and the exit,
// every pickup and every robot are reachable from the start on foot (doors
// count as passable, since they open when approached).
import { MAPS } from "../js/games/lockdown/maps.js";
import { LabWorld, WALLS } from "../js/games/lockdown/world.js";

function checkMap(map) {
    const world = new LabWorld(map);
    const start = { x: Math.floor(world.start.x), y: Math.floor(world.start.y) };
    const seen = new Set([`${start.x},${start.y}`]);
    const queue = [start];
    while (queue.length > 0) {
        const c = queue.shift();
        if (!c) break;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = c.x + dx;
            const ny = c.y + dy;
            const key = `${nx},${ny}`;
            if (seen.has(key) || WALLS.has(world.cell(nx, ny))) continue;
            seen.add(key);
            queue.push({ x: nx, y: ny });
        }
    }
    const missing = world.spawns
        .filter((s) => !seen.has(`${Math.floor(s.x)},${Math.floor(s.y)}`))
        .map((s) => `"${s.type}" at (${Math.floor(s.x)}, ${Math.floor(s.y)})`);
    const exitReachable = world.exits.some((e) =>
        [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(`${e.x + dx},${e.y + dy}`)),
    );
    return { exitReachable, missing, doors: world.doors.size, robots: world.spawns.filter((s) => s.type === "r").length };
}

let failed = false;
for (const map of MAPS) {
    let result;
    try {
        result = checkMap(map);
    } catch (err) {
        failed = true;
        console.log(`FAIL ${map.id}: ${err instanceof Error ? err.message : String(err)}`);
        continue;
    }
    const ok = result.exitReachable && result.missing.length === 0;
    if (!ok) failed = true;
    console.log(
        `${ok ? "ok  " : "FAIL"} ${map.id}: exit ${result.exitReachable ? "reachable" : "UNREACHABLE"}, ${result.robots} robots, ${result.doors} doors`,
    );
    for (const m of result.missing) console.log(`       unreachable ${m}`);
}
process.exit(failed ? 1 : 0);
