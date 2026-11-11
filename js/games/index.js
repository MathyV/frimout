// Registry of mini-games shown in the selection menu.
//
// Each entry's create(shell, params) returns a game object with:
//   update(dt)            advance one fixed step
//   drawPixels(ctx)       draw onto the 480x270 pixel-art canvas
//   drawOverlay(ctx)      draw text/HUD onto the full-resolution canvas, which
//                         is already scaled to the same 480x270 units
//   pausable              true while gameplay runs; the shell then opens its
//                         pause menu on Esc, otherwise Esc returns to the menu
//   touchLayout           which on-screen buttons to show: "platform" | "fps" | "menu"
//   onPause() / onResume()
//   dispose()             release listeners, music, pointer lock
//
// shell provides: input, sound, canvas, exit() (back to the menu) and pause().
import { createJourney } from "./journey/index.js";
import { createLockdown } from "./lockdown/index.js";

export const GAMES = [
    {
        id: "journey",
        title: "Journey to the Stars",
        genre: "Platformer",
        description: [
            "Run and jump from Poperinge to orbit:",
            "five chapters from his life, up to the",
            "STS-45 flight aboard Atlantis in 1992.",
        ],
        create: createJourney,
    },
    {
        id: "lockdown",
        title: "Frimout 3D: Lab Lockdown",
        genre: "First-person action",
        description: [
            "A fictional training run gone wrong:",
            "switch off the glitching robots with",
            "your repair zapper and save the data.",
        ],
        create: createLockdown,
    },
];
