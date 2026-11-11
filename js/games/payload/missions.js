// Payload Swap missions. Tile types:
//   0 hop cone   1 waffle   2 Earth   3 Sun   4 floppy disk   5 helmet
// collect maps a tile type to how many must be cleared; target is the
// minimum score. stars = [target, 2-star score, 3-star score].
// Tuned with `npm run check` (tools/check-payload.js).

export const TILE_NAMES = ["Hop cones", "Waffles", "Earths", "Suns", "Floppies", "Helmets"];

export const MISSIONS = [
    {
        id: "countdown",
        title: "Countdown",
        note: "T-minus: load the payload bay.",
        moves: 18,
        target: 3000,
        collect: { 0: 18 },
        stars: [3000, 11000, 14000],
    },
    {
        id: "liftoff",
        title: "Liftoff",
        note: "24 March 1992, Atlantis lifts off from Pad 39A.",
        moves: 18,
        target: 4000,
        collect: { 1: 20 },
        stars: [4000, 13500, 17000],
    },
    {
        id: "orbit",
        title: "Reaching Orbit",
        note: "Dirk Frimout becomes the first Belgian in space.",
        moves: 20,
        target: 5000,
        collect: { 2: 22, 5: 14 },
        stars: [5000, 15000, 19000],
    },
    {
        id: "instruments",
        title: "Instruments On",
        note: "Twelve ATLAS-1 instruments from the U.S., Europe and Japan.",
        moves: 20,
        target: 6000,
        collect: { 4: 27 },
        stars: [6000, 16000, 22000],
    },
    {
        id: "ozone",
        title: "Ozone Watch",
        note: "ATLAS-1 studies the chemistry of the atmosphere.",
        moves: 22,
        target: 7000,
        collect: { 2: 28, 0: 19 },
        stars: [7000, 18000, 22500],
    },
    {
        id: "sun",
        title: "Solar Scan",
        note: "Instruments measure the energy coming from the Sun.",
        moves: 22,
        target: 8000,
        collect: { 3: 30 },
        stars: [8000, 19000, 22500],
    },
    {
        id: "science",
        title: "Extra Science",
        note: "The mission is extended by a day for more observations.",
        moves: 24,
        target: 9000,
        collect: { 3: 28, 4: 28, 2: 28 },
        stars: [9000, 23000, 27000],
    },
    {
        id: "landing",
        title: "Wheels Stop",
        note: "2 April 1992: Atlantis lands at Kennedy Space Center.",
        moves: 24,
        target: 10000,
        collect: { 1: 29, 5: 29 },
        stars: [10000, 22000, 26000],
    },
];
