// Synthesised sound effects and a small looping chiptune. Nothing is loaded
// from disk; everything is generated with the Web Audio API.

const MUTE_KEY = "frimout.muted";

// Melody in semitones relative to A4; null is a rest. One step is an eighth note.
const LEAD = [
    0, null, 4, 7, 12, null, 7, 4, 5, null, 9, 12, 9, null, 5, null,
    7, null, 11, 14, 12, null, 11, 7, 9, 7, 5, 4, 2, null, null, null,
];
const BASS = [-24, -24, -17, -17, -19, -19, -12, -12, -20, -20, -13, -13, -17, -17, -22, -22];

export class Sound {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.musicGain = null;
        this.muted = readMuted();
        this.musicOn = false;
        this.tempo = 140;
        this.step = 0;
        this.nextTime = 0;
        this.timer = null;
    }

    // Must be called from a user gesture; browsers block audio before that.
    unlock() {
        if (this.ctx) {
            if (this.ctx.state === "suspended") void this.ctx.resume();
            return;
        }
        const Ctor = window.AudioContext ?? window.webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.35;
        this.musicGain.connect(this.master);
    }

    toggleMute() {
        this.muted = !this.muted;
        try {
            localStorage.setItem(MUTE_KEY, this.muted ? "1" : "0");
        } catch {
            // Storage may be unavailable (private mode); muting still works for this session.
        }
        if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
        return this.muted;
    }

    startMusic(tempo) {
        this.tempo = tempo;
        if (!this.ctx || this.musicOn) return;
        this.musicOn = true;
        this.step = 0;
        this.nextTime = this.ctx.currentTime + 0.05;
        this.timer = window.setInterval(() => this.schedule(), 25);
    }

    stopMusic() {
        this.musicOn = false;
        if (this.timer !== null) window.clearInterval(this.timer);
        this.timer = null;
    }

    schedule() {
        if (!this.ctx || !this.musicGain) return;
        const stepLen = 60 / this.tempo / 2;
        while (this.nextTime < this.ctx.currentTime + 0.12) {
            const lead = LEAD[this.step % LEAD.length];
            if (lead !== null && lead !== undefined) {
                this.note(this.musicGain, "square", freq(lead), this.nextTime, stepLen * 0.9, 0.12);
            }
            if (this.step % 2 === 0) {
                const bass = BASS[(this.step / 2) % BASS.length];
                if (bass !== undefined) this.note(this.musicGain, "triangle", freq(bass), this.nextTime, stepLen * 1.8, 0.35);
            }
            this.nextTime += stepLen;
            this.step++;
        }
    }

    note(dest, type, frequency, start, duration, volume) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(volume, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        osc.connect(gain).connect(dest);
        osc.start(start);
        osc.stop(start + duration + 0.02);
    }

    sweep(type, from, to, duration, volume) {
        if (!this.ctx || !this.master) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(from, t);
        osc.frequency.exponentialRampToValueAtTime(to, t + duration);
        gain.gain.setValueAtTime(volume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
        osc.connect(gain).connect(this.master);
        osc.start(t);
        osc.stop(t + duration + 0.02);
    }

    arpeggio(notes, stepLen, type = "square", volume = 0.2) {
        if (!this.ctx || !this.master) return;
        const t = this.ctx.currentTime;
        notes.forEach((n, i) => this.note(this.master, type, freq(n), t + i * stepLen, stepLen * 1.5, volume));
    }

    play(name) {
        switch (name) {
            case "jump":
                this.sweep("square", 280, 620, 0.12, 0.15);
                break;
            case "spring":
                this.sweep("sine", 200, 1100, 0.3, 0.3);
                break;
            case "pickup":
                this.arpeggio([12, 19], 0.06, "triangle", 0.3);
                break;
            case "stomp":
                this.sweep("square", 240, 60, 0.15, 0.25);
                break;
            case "die":
                this.sweep("sawtooth", 440, 50, 0.5, 0.25);
                break;
            case "checkpoint":
                this.arpeggio([0, 4, 7, 12], 0.07, "triangle", 0.3);
                break;
            case "goal":
                this.arpeggio([0, 4, 7, 12, 7, 12, 16, 19], 0.09, "square", 0.18);
                break;
            case "select":
                this.sweep("square", 500, 800, 0.08, 0.12);
                break;
            default:
                throw new Error(`Unknown sound "${name}"`);
        }
    }
}

function freq(semitonesFromA4) {
    return 440 * Math.pow(2, semitonesFromA4 / 12);
}

function readMuted() {
    try {
        return localStorage.getItem(MUTE_KEY) === "1";
    } catch {
        return false;
    }
}
