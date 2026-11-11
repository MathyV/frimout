// Low-level input. Every physical control is reported as a code:
//   keyboard   KeyboardEvent.code ("KeyA", "ArrowLeft", "Space", ...)
//   gamepad    "PadLeft" "PadRight" "PadUp" "PadDown" (left stick or d-pad),
//              "PadA" "PadB" "PadX" "PadY" "PadLB" "PadRB" "PadLT" "PadRT" "PadStart"
//   touch      the data-code of on-screen buttons ("TouchLeft", "TouchA", ...)
//   pointer    "Tap" (any press on the canvas), "MouseLeft" (held mouse button)
// Games describe actions as lists of codes (see bindings.js) and query them
// with held() and pressed().

const PREVENT_DEFAULT = new Set([
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Space",
    "Tab",
    "Enter",
    "NumpadEnter",
]);

const PAD_BUTTONS = {
    0: "PadA",
    1: "PadB",
    2: "PadX",
    3: "PadY",
    4: "PadLB",
    5: "PadRB",
    6: "PadLT",
    7: "PadRT",
    9: "PadStart",
    12: "PadUp",
    13: "PadDown",
    14: "PadLeft",
    15: "PadRight",
};

export class Input {
    constructor(canvas) {
        this.canvas = canvas;
        this.down = new Set();
        this.latched = new Set();
        this.prev = new Set();
        this.heldNow = new Set();
        this.pressedNow = new Set();
        this.mouseAccum = 0;
        this.mouseDX = 0;
        this.gestureHandlers = [];

        window.addEventListener("keydown", (e) => {
            if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
            if (!e.repeat) this.latched.add(e.code);
            this.down.add(e.code);
            this.gesture();
        });
        window.addEventListener("keyup", (e) => this.down.delete(e.code));
        window.addEventListener("blur", () => this.down.clear());

        canvas.addEventListener("pointerdown", (e) => {
            this.latched.add("Tap");
            if (e.pointerType === "mouse" && e.button === 0) {
                this.down.add("MouseLeft");
                this.latched.add("MouseLeft");
            }
            this.gesture();
        });
        window.addEventListener("pointerup", (e) => {
            if (e.pointerType === "mouse" && e.button === 0) this.down.delete("MouseLeft");
        });
        document.addEventListener("mousemove", (e) => {
            if (document.pointerLockElement === canvas) this.mouseAccum += e.movementX;
        });
        canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    }

    onGesture(fn) {
        this.gestureHandlers.push(fn);
    }

    gesture() {
        for (const fn of this.gestureHandlers) fn();
    }

    // Wires on-screen buttons; each needs a data-code attribute.
    bindTouchButtons(root) {
        root.querySelectorAll("[data-code]").forEach((el) => {
            const code = el.getAttribute("data-code");
            if (!code) return;
            const press = (e) => {
                e.preventDefault();
                this.down.add(code);
                this.latched.add(code);
                el.classList.add("active");
                this.gesture();
            };
            const release = (e) => {
                e.preventDefault();
                this.down.delete(code);
                el.classList.remove("active");
            };
            el.addEventListener("pointerdown", press);
            el.addEventListener("pointerup", release);
            el.addEventListener("pointercancel", release);
            el.addEventListener("pointerleave", release);
        });
    }

    readGamepads() {
        const codes = new Set();
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const pad of pads) {
            if (!pad) continue;
            const ax = pad.axes[0] ?? 0;
            const ay = pad.axes[1] ?? 0;
            if (ax < -0.4) codes.add("PadLeft");
            if (ax > 0.4) codes.add("PadRight");
            if (ay < -0.4) codes.add("PadUp");
            if (ay > 0.4) codes.add("PadDown");
            pad.buttons.forEach((b, i) => {
                const code = PAD_BUTTONS[i];
                if (code && b.pressed) codes.add(code);
            });
        }
        return codes;
    }

    // Call once per fixed simulation step.
    update() {
        const held = new Set([...this.down, ...this.readGamepads()]);
        const pressed = new Set();
        for (const code of held) if (!this.prev.has(code)) pressed.add(code);
        for (const code of this.latched) pressed.add(code);
        this.latched.clear();
        this.prev = held;
        this.heldNow = held;
        this.pressedNow = pressed;
        this.mouseDX = this.mouseAccum;
        this.mouseAccum = 0;
    }

    held(codes) {
        return codes.some((c) => this.heldNow.has(c));
    }

    pressed(codes) {
        return codes.some((c) => this.pressedNow.has(c));
    }

    // Horizontal mouse movement (pointer-locked) since the previous step.
    mouseX() {
        return this.mouseDX;
    }
}
