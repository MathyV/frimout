// Synthesised sound effects and looping chiptunes. Nothing is loaded from
// disk; everything is generated with the Web Audio API.
import { readStorage, writeStorage } from "./storage.js";

const MUTE_KEY = "frimout.muted";

// A song is a lead line (one step per eighth note) and a bass line (one step
// per quarter note), in semitones relative to A4; null is a rest.
//   { tempo, lead: (number|null)[], bass: (number|null)[], leadWave?: OscillatorType }

export class Sound {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.musicGain = null;
        this.muted = readStorage(MUTE_KEY, "0") === "1";
        this.song = null;
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
        writeStorage(MUTE_KEY, this.muted ? "1" : "0");
        if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
        return this.muted;
    }

    startMusic(song) {
        if (!this.ctx) return;
        if (this.song === song && this.timer !== null) return;
        this.stopMusic();
        this.song = song;
        this.step = 0;
        this.nextTime = this.ctx.currentTime + 0.05;
        this.timer = window.setInterval(() => this.schedule(), 25);
    }

    stopMusic() {
        if (this.timer !== null) window.clearInterval(this.timer);
        this.timer = null;
        this.song = null;
    }

    schedule() {
        const song = this.song;
        if (!this.ctx || !this.musicGain || !song) return;
        const stepLen = 60 / song.tempo / 2;
        while (this.nextTime < this.ctx.currentTime + 0.12) {
            const lead = song.lead[this.step % song.lead.length];
            if (lead !== null && lead !== undefined) {
                this.note(this.musicGain, song.leadWave ?? "square", freq(lead), this.nextTime, stepLen * 0.9, 0.12);
            }
            if (this.step % 2 === 0) {
                const bass = song.bass[(this.step / 2) % song.bass.length];
                if (bass !== null && bass !== undefined) {
                    this.note(this.musicGain, "triangle", freq(bass), this.nextTime, stepLen * 1.8, 0.35);
                }
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
        const master = this.master;
        const t = this.ctx.currentTime;
        notes.forEach((n, i) => this.note(master, type, freq(n), t + i * stepLen, stepLen * 1.5, volume));
    }

    // level: optional intensity (e.g. cascade depth) for sounds that use it.
    play(name, level = 0) {
        switch (name) {
            case "swap":
                this.sweep("triangle", 330, 520, 0.08, 0.15);
                break;
            case "invalid":
                this.arpeggio([-5, -8], 0.07, "square", 0.12);
                break;
            case "match": {
                const base = 7 + Math.min(level, 8) * 2;
                this.arpeggio([base, base + 4, base + 7], 0.045, "triangle", 0.25);
                break;
            }
            case "rocket":
                this.sweep("sawtooth", 200, 1600, 0.35, 0.18);
                break;
            case "flare":
                this.sweep("sine", 120, 1800, 0.6, 0.3);
                break;
            case "shuffle":
                this.arpeggio([0, 3, 7, 3, 0], 0.05, "triangle", 0.15);
                break;
            case "win":
                this.arpeggio([0, 4, 7, 12, 16, 19, 24], 0.08, "square", 0.16);
                break;
            case "lose":
                this.arpeggio([7, 3, 0, -5], 0.15, "triangle", 0.25);
                break;
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
            case "zap":
                this.sweep("sawtooth", 1400, 300, 0.14, 0.14);
                break;
            case "empty":
                this.sweep("square", 160, 120, 0.06, 0.1);
                break;
            case "hit":
                this.sweep("square", 700, 350, 0.08, 0.18);
                break;
            case "robotDown":
                this.sweep("sawtooth", 600, 40, 0.6, 0.25);
                break;
            case "robotShot":
                this.sweep("triangle", 900, 500, 0.12, 0.15);
                break;
            case "hurt":
                this.sweep("square", 220, 90, 0.2, 0.28);
                break;
            case "door":
                this.sweep("triangle", 120, 220, 0.35, 0.2);
                break;
            case "alert":
                this.arpeggio([7, 7], 0.08, "square", 0.12);
                break;
            default:
                throw new Error(`Unknown sound "${name}"`);
        }
    }
}

function freq(semitonesFromA4) {
    return 440 * Math.pow(2, semitonesFromA4 / 12);
}
