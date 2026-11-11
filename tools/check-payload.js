// Plays every Payload Swap mission many times with a one-move look-ahead bot
// and reports how often it wins. The bot is weaker than a careful human, so a
// mission it rarely wins is too hard. Fails when a mission's config is invalid
// or the bot's win rate drops below MIN_WIN_RATE.
import { Board, makeRng } from "../js/games/payload/board.js";
import { playTurn, goalsMet, starsFor } from "../js/games/payload/rules.js";
import { MISSIONS, TILE_NAMES } from "../js/games/payload/missions.js";
import { BOARD_SIZE, TILE_TYPES } from "../js/games/payload/config.js";

const RUNS = Number.parseInt(process.argv[2] ?? "200", 10);
const MIN_WIN_RATE = 0.35;

function validate(m) {
    if (!(m.moves > 0)) throw new Error("moves must be positive");
    if (m.stars.length !== 3 || m.stars[0] !== m.target) throw new Error("stars must be [target, two, three]");
    for (const t of Object.keys(m.collect)) {
        if (TILE_NAMES[Number(t)] === undefined) throw new Error(`unknown tile type ${t}`);
    }
}

function value(mission, outcome, collected) {
    let v = outcome.points / 50;
    for (const [type, need] of Object.entries(mission.collect)) {
        const t = Number(type);
        const remaining = Math.max(0, need - (collected[t] ?? 0));
        v += Math.min(remaining, outcome.collected[t] ?? 0) * 30;
    }
    return v;
}

function playMission(mission, seed) {
    const rng = makeRng(seed);
    const board = new Board(BOARD_SIZE, BOARD_SIZE, TILE_TYPES, rng);
    const lookRng = makeRng(seed ^ 0x9e3779b9);
    const collected = new Array(TILE_TYPES).fill(0);
    let score = 0;
    for (let move = 0; move < mission.moves; move++) {
        let best = null;
        let bestValue = -1;
        for (const m of board.allMoves()) {
            const v = value(mission, playTurn(board.clone(lookRng), m.a, m.b), collected);
            if (v > bestValue) {
                bestValue = v;
                best = m;
            }
        }
        if (!best) throw new Error("board without moves after a turn");
        const out = playTurn(board, best.a, best.b);
        score += out.points;
        out.collected.forEach((n, t) => (collected[t] = (collected[t] ?? 0) + n));
        if (goalsMet(mission, score, collected)) return { won: true, score, movesLeft: mission.moves - move - 1 };
    }
    return { won: false, score, movesLeft: 0 };
}

let failed = false;
for (const mission of MISSIONS) {
    try {
        validate(mission);
    } catch (err) {
        failed = true;
        console.log(`FAIL ${mission.id}: ${err instanceof Error ? err.message : String(err)}`);
        continue;
    }
    const winScores = [];
    const stars = [0, 0, 0, 0];
    for (let i = 0; i < RUNS; i++) {
        const r = playMission(mission, 1000 + i);
        if (r.won) {
            winScores.push(r.score);
            stars[starsFor(mission, r.score)]++;
        }
    }
    winScores.sort((x, y) => x - y);
    const pct = (p) => winScores[Math.min(winScores.length - 1, Math.floor(p * winScores.length))] ?? 0;
    const rate = winScores.length / RUNS;
    const ok = rate >= MIN_WIN_RATE;
    if (!ok) failed = true;
    console.log(
        `${ok ? "ok  " : "FAIL"} ${mission.id.padEnd(12)} bot wins ${(rate * 100).toFixed(0).padStart(3)}%  ` +
            `winning score p10/p50/p80 ${pct(0.1)}/${pct(0.5)}/${pct(0.8)}  stars 1/2/3 ${stars[1]}/${stars[2]}/${stars[3]}`,
    );
}
process.exit(failed ? 1 : 0);
