// Turn rules shared by the game (which animates each step) and the checker
// (which plays whole turns instantly).
import { SCORE_PER_TILE, SPECIAL_BONUS, cellKey } from "./board.js";

// Performs the swap and returns the arguments for the first resolve step.
// A flare swapped with a tile wipes out that tile's type; two flares wipe the
// most common type.
export function prepareSwap(board, a, b) {
    board.swap(a, b);
    const forced = new Set();
    const flareTargets = new Map();
    for (const [cell, other] of [[a, b], [b, a]]) {
        const tile = board.get(cell.x, cell.y);
        const partner = board.get(other.x, other.y);
        if (!tile || tile.special !== "flare" || !partner) continue;
        const k = cellKey(cell.x, cell.y);
        forced.add(k);
        flareTargets.set(k, partner.special === "flare" ? board.mostCommonType() : partner.type);
    }
    return { pivots: [a, b], forced, flareTargets };
}

export function stepPoints(result, combo) {
    return (result.cleared.length * SCORE_PER_TILE + result.created.length * SPECIAL_BONUS) * combo;
}

export function tally(result, collected) {
    for (const c of result.cleared) if (c.tile.type >= 0) collected[c.tile.type] = (collected[c.tile.type] ?? 0) + 1;
}

// Plays a full turn without animation. Returns points, per-type counts and
// whether the board had to be reshuffled afterwards.
export function playTurn(board, a, b) {
    const collected = new Array(board.types).fill(0);
    let points = 0;
    let combo = 1;
    let args = prepareSwap(board, a, b);
    for (;;) {
        const result = board.resolve(args.pivots, args.forced, args.flareTargets);
        if (!result) break;
        points += stepPoints(result, combo);
        tally(result, collected);
        board.collapse();
        combo++;
        args = { pivots: [], forced: new Set(), flareTargets: new Map() };
    }
    let reshuffled = false;
    if (!board.findMove()) {
        board.shuffle();
        reshuffled = true;
    }
    return { points, collected, cascades: combo - 1, reshuffled };
}

export function goalsMet(mission, score, collected) {
    if (score < mission.target) return false;
    return Object.entries(mission.collect).every(([type, need]) => (collected[Number(type)] ?? 0) >= need);
}

export function starsFor(mission, score) {
    return mission.stars.filter((s) => score >= s).length;
}
