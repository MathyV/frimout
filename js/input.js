// Keyboard, touch and gamepad input merged into one set of actions.

const KEYMAP = {
    ArrowLeft: "left",
    KeyA: "left",
    ArrowRight: "right",
    KeyD: "right",
    ArrowUp: "jump",
    KeyW: "jump",
    Space: "jump",
    KeyZ: "jump",
    KeyK: "jump",
    Enter: "confirm",
    NumpadEnter: "confirm",
    Escape: "pause",
    KeyP: "pause",
    KeyM: "mute",
};

const ACTIONS = ["left", "right", "jump", "confirm", "pause", "mute"];

export class Input {
    constructor() {
        this.keys = new Set();
        this.touch = new Set();
        this.latched = new Set();
        this.prev = new Set();
        this.held = new Set();
        this.pressedNow = new Set();
        this.anyGesture = null;

        window.addEventListener("keydown", (e) => {
            const action = KEYMAP[e.code];
            if (!action) return;
            e.preventDefault();
            if (!e.repeat) this.latched.add(action);
            this.keys.add(action);
            this.gesture();
        });
        window.addEventListener("keyup", (e) => {
            const action = KEYMAP[e.code];
            if (action) this.keys.delete(action);
        });
        window.addEventListener("blur", () => this.keys.clear());
    }

    onGesture(fn) {
        this.anyGesture = fn;
    }

    gesture() {
        if (this.anyGesture) this.anyGesture();
    }

    // Wires on-screen buttons. Each element needs a data-action attribute.
    bindTouchButtons(root) {
        root.querySelectorAll("[data-action]").forEach((el) => {
            const action = el.getAttribute("data-action");
            if (!action || !ACTIONS.includes(action)) return;
            const down = (e) => {
                e.preventDefault();
                this.touch.add(action);
                this.latched.add(action);
                el.classList.add("active");
                this.gesture();
            };
            const up = (e) => {
                e.preventDefault();
                this.touch.delete(action);
                el.classList.remove("active");
            };
            el.addEventListener("pointerdown", down);
            el.addEventListener("pointerup", up);
            el.addEventListener("pointercancel", up);
            el.addEventListener("pointerleave", up);
        });
    }

    // Tapping the game canvas counts as confirm (menus) and jump.
    bindTap(el) {
        el.addEventListener("pointerdown", () => {
            this.latched.add("confirm");
            this.gesture();
        });
    }

    readGamepad() {
        const result = new Set();
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const pad of pads) {
            if (!pad) continue;
            const axis = pad.axes[0] ?? 0;
            const b = (i) => pad.buttons[i]?.pressed === true;
            if (axis < -0.4 || b(14)) result.add("left");
            if (axis > 0.4 || b(15)) result.add("right");
            if (b(0) || b(1) || b(12)) result.add("jump");
            if (b(0) || b(9)) result.add("confirm");
            if (b(9)) result.add("pause");
        }
        return result;
    }

    // Call once per fixed simulation step.
    update() {
        const pad = this.readGamepad();
        this.held = new Set([...this.keys, ...this.touch, ...pad]);
        this.pressedNow = new Set();
        for (const action of ACTIONS) {
            const edge = this.held.has(action) && !this.prev.has(action);
            if (edge || this.latched.has(action)) this.pressedNow.add(action);
        }
        this.latched.clear();
        this.prev = this.held;
    }

    isHeld(action) {
        return this.held.has(action);
    }

    pressed(action) {
        return this.pressedNow.has(action);
    }
}
