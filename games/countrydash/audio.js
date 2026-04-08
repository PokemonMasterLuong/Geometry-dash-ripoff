'use strict';

// ── CountryDash Audio Engine ───────────────────────────────────────────────
//
// Procedural chiptune music using the Web Audio API.
// No audio files needed. Each level has a unique melody, tempo and key.
// Call Audio.playLevel(index) when a level starts.
// Call Audio.stop() on menu / death screen.
//
// Inspired by: Montagem Rugada, Stereo Madness, Base After Base, Polargeist,
//              Clubstep, Theory of Everything — reimagined as original chiptunes.

const Audio = (() => {
    let ctx = null;        // AudioContext (lazy-init on first user gesture)
    let masterGain = null;
    let currentLevel = -1;
    let schedulerTimer = null;
    let beatClock = 0;
    let beatIndex = 0;
    let running = false;

    // ── Level music definitions ────────────────────────────────────────────
    // Each entry: { bpm, key (MIDI root), scale, bassline[], melody[], arp[] }
    // Scale degrees: 0=root, 2=maj2, 4=maj3, 5=p4, 7=p5, 9=maj6, 11=maj7
    // Minor scale:   0, 2, 3, 5, 7, 8, 10
    // Pentatonic:    0, 2, 4, 7, 9

    const MAJ  = [0, 2, 4, 5, 7, 9, 11];
    const MIN  = [0, 2, 3, 5, 7, 8, 10];
    const PENT = [0, 2, 4, 7, 9];
    const HARM = [0, 2, 3, 5, 7, 8, 11]; // harmonic minor

    // MIDI note → Hz
    function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
    // Scale degree lookup
    function deg(scale, key, d, octave = 0) {
        const idx = ((d % scale.length) + scale.length) % scale.length;
        return midi(key + scale[idx] + octave * 12);
    }

    const LEVELS = [
        // 0 — "Starlight" — C maj, 140 bpm, bright & simple
        { bpm:140, key:60, scale:MAJ,
          bass:[0,0,4,0, 0,0,4,7, 5,5,4,0, 0,0,7,7],
          mel: [4,7,9,7, 4,4,7,9, 5,5,4,2, 0,2,4,0],
          arp: [0,4,7,4, 0,4,7,9, 5,9,5,2, 0,2,4,7] },

        // 1 — "Drive" — A min, 150 bpm, punchy
        { bpm:150, key:57, scale:MIN,
          bass:[0,0,3,0, 0,0,3,7, 5,5,3,0, 0,0,7,5],
          mel: [7,7,5,3, 2,3,5,7, 8,7,5,3, 2,0,3,2],
          arp: [0,3,7,3, 0,3,7,8, 5,8,5,3, 0,3,5,7] },

        // 2 — "Neon Rush" — D min, 155 bpm, energetic
        { bpm:155, key:62, scale:MIN,
          bass:[0,0,3,5, 7,5,3,0, 5,5,3,2, 0,2,3,5],
          mel: [3,5,7,5, 3,3,5,8, 7,8,7,5, 3,2,0,2],
          arp: [0,3,5,7, 3,5,7,3, 5,7,3,5, 0,5,3,0] },

        // 3 — "Polar Night" — F# min, 160 bpm, darker
        { bpm:160, key:54, scale:HARM,
          bass:[0,0,5,0, 3,3,5,7, 5,5,3,0, 0,0,7,5],
          mel: [5,7,8,7, 5,5,7,5, 3,5,3,2, 0,2,3,5],
          arp: [0,5,7,5, 3,7,3,8, 5,8,5,3, 0,3,5,0] },

        // 4 — "Thunder Road" — E min, 165 bpm, rock-ish
        { bpm:165, key:52, scale:MIN,
          bass:[0,0,3,7, 5,5,3,0, 7,7,5,3, 0,3,5,7],
          mel: [7,5,3,5, 7,8,7,5, 3,5,7,8, 7,5,3,2],
          arp: [0,3,7,3, 5,7,5,3, 7,5,3,0, 3,5,7,8] },

        // 5 — "Voltage" — B min, 170 bpm, punchy synth
        { bpm:170, key:59, scale:MIN,
          bass:[0,0,5,0, 3,3,0,7, 5,5,3,0, 7,0,3,5],
          mel: [3,5,7,8, 7,5,3,2, 0,2,3,5, 7,5,3,0],
          arp: [0,3,5,7, 0,5,7,3, 3,7,3,5, 0,5,3,7] },

        // 6 — "Subzero" — C min, 175 bpm, icy fast
        { bpm:175, key:60, scale:MIN,
          bass:[0,0,3,5, 7,5,3,7, 0,3,0,5, 7,5,3,0],
          mel: [7,8,7,5, 3,5,7,8, 7,5,3,5, 3,2,0,2],
          arp: [0,3,5,7, 3,5,3,8, 7,8,7,5, 0,5,3,7] },

        // 7 — "Void Walker" — D# min, 180 bpm, very fast
        { bpm:180, key:63, scale:MIN,
          bass:[0,5,3,0, 7,0,5,3, 0,3,5,7, 5,3,0,5],
          mel: [5,7,8,7, 5,3,5,8, 7,8,7,5, 3,2,3,5],
          arp: [0,3,5,7, 5,3,7,5, 0,5,3,7, 3,7,5,0] },

        // 8 — "Galactic" — G maj, 182 bpm, bright space feel
        { bpm:182, key:67, scale:PENT,
          bass:[0,0,4,0, 7,4,0,7, 4,7,4,0, 0,4,7,4],
          mel: [4,7,9,7, 4,2,4,7, 9,7,4,2, 0,2,4,9],
          arp: [0,4,7,4, 2,4,7,9, 4,9,4,7, 0,7,4,2] },

        // 9 — "Final Stretch" — A min, 185 bpm
        { bpm:185, key:57, scale:HARM,
          bass:[0,5,3,7, 0,3,5,0, 7,5,3,0, 3,5,7,5],
          mel: [7,8,7,5, 3,5,7,8, 5,7,5,3, 2,3,5,7],
          arp: [0,3,5,7, 3,7,8,7, 5,8,5,3, 0,5,7,3] },

        // 10 — "World Domination" — E min, 190 bpm, intense
        { bpm:190, key:52, scale:MIN,
          bass:[0,7,5,3, 0,3,0,7, 5,0,5,3, 7,5,3,7],
          mel: [3,5,7,8, 7,5,3,5, 8,7,5,3, 2,3,5,7],
          arp: [0,3,7,3, 5,3,0,5, 7,5,3,7, 0,7,5,3] },

        // 11 — "Overload" — C# min, 195 bpm
        { bpm:195, key:61, scale:HARM,
          bass:[0,5,7,5, 3,5,3,0, 7,3,7,5, 0,5,3,7],
          mel: [5,7,8,7, 5,3,5,7, 8,7,5,3, 2,3,2,0],
          arp: [0,3,5,7, 5,7,3,8, 5,8,7,5, 3,5,7,0] },

        // 12 — "Boss: Armageddon" — F min, 200 bpm, epic finale
        { bpm:200, key:53, scale:HARM,
          bass:[0,7,5,3, 0,0,7,5, 3,5,7,5, 3,0,5,7],
          mel: [5,7,8,7, 5,5,7,8, 7,8,7,5, 3,5,7,5],
          arp: [0,3,5,7, 5,3,7,5, 0,7,5,3, 5,7,8,7] },
    ];

    // ── Oscillator / synth helpers ─────────────────────────────────────────

    function ensureCtx() {
        if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(0.36, ctx.currentTime);
            masterGain.connect(ctx.destination);
        }
        if (ctx.state === 'suspended') ctx.resume();
    }

    function playNote(freq, startTime, duration, type = 'square', vol = 0.18, detune = 0) {
        if (!ctx) return;
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);
        if (detune) osc.detune.setValueAtTime(detune, startTime);

        // Snappy attack, quick decay to sustain, fast release
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(vol, startTime + 0.008);
        gain.gain.setValueAtTime(vol * 0.72, startTime + 0.018);
        gain.gain.linearRampToValueAtTime(0, startTime + duration * 0.92);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(startTime);
        osc.stop(startTime + duration);
    }

    function playDrum(time, type) {
        if (!ctx) return;
        if (type === 'kick') {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime(160, time);
            o.frequency.exponentialRampToValueAtTime(30, time + 0.18);
            g.gain.setValueAtTime(0.55, time);
            g.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
            o.connect(g); g.connect(masterGain);
            o.start(time); o.stop(time + 0.25);
        } else if (type === 'snare') {
            const buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
            const src = ctx.createBufferSource();
            const bpf = ctx.createBiquadFilter();
            const g   = ctx.createGain();
            src.buffer = buf;
            bpf.type = 'bandpass'; bpf.frequency.value = 2200; bpf.Q.value = 0.7;
            g.gain.setValueAtTime(0.28, time);
            g.gain.exponentialRampToValueAtTime(0.001, time + 0.10);
            src.connect(bpf); bpf.connect(g); g.connect(masterGain);
            src.start(time); src.stop(time + 0.12);
        } else if (type === 'hihat') {
            const buf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
            const src = ctx.createBufferSource();
            const hpf = ctx.createBiquadFilter();
            const g   = ctx.createGain();
            src.buffer = buf;
            hpf.type = 'highpass'; hpf.frequency.value = 7000;
            g.gain.setValueAtTime(0.12, time);
            g.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
            src.connect(hpf); hpf.connect(g); g.connect(masterGain);
            src.start(time); src.stop(time + 0.04);
        }
    }

    // ── Scheduler ─────────────────────────────────────────────────────────

    const LOOKAHEAD   = 0.14;  // seconds to schedule ahead
    const SCHEDULE_HZ = 80;    // ms between scheduler calls

    function schedule() {
        if (!running || !ctx) return;
        const def      = LEVELS[currentLevel] || LEVELS[0];
        const beatDur  = 60 / def.bpm;
        const n        = def.bass.length;   // pattern length in beats
        const now      = ctx.currentTime;

        while (beatClock < now + LOOKAHEAD) {
            const bi = ((beatIndex % n) + n) % n;
            const t  = beatClock;

            // ── Bass — square wave, low octave ─────────────────────────────
            const bassDeg = def.bass[bi];
            playNote(deg(def.scale, def.key, bassDeg, -1), t, beatDur * 0.85, 'square', 0.17);

            // ── Melody — triangle wave, upper octave ───────────────────────
            const melDeg  = def.mel[bi];
            playNote(deg(def.scale, def.key, melDeg, 1), t, beatDur * 0.55, 'triangle', 0.13);

            // ── Arp — sawtooth, mid octave, 4 subdivisions ─────────────────
            const subDur = beatDur / 4;
            for (let s = 0; s < 4; s++) {
                const arpDeg = def.arp[(bi * 4 + s) % def.arp.length];
                playNote(deg(def.scale, def.key, arpDeg, 0), t + s * subDur, subDur * 0.7,
                         'sawtooth', 0.065, (s % 2 === 0) ? 5 : -5);
            }

            // ── Drums ──────────────────────────────────────────────────────
            // Kick on beats 0 and 2 (of 4-beat bar)
            const barBeat = beatIndex % 4;
            if (barBeat === 0 || barBeat === 2) playDrum(t, 'kick');
            // Snare on beats 1 and 3
            if (barBeat === 1 || barBeat === 3) playDrum(t, 'snare');
            // Hi-hat every half beat
            playDrum(t, 'hihat');
            playDrum(t + beatDur * 0.5, 'hihat');

            beatClock += beatDur;
            beatIndex++;
        }

        schedulerTimer = setTimeout(schedule, SCHEDULE_HZ);
    }

    // ── Public API ─────────────────────────────────────────────────────────

    function playLevel(index) {
        ensureCtx();
        const idx = Math.max(0, Math.min(index, LEVELS.length - 1));
        if (idx === currentLevel && running) return;  // same level, already playing

        stopInternal();
        currentLevel = idx;
        beatClock    = ctx.currentTime + 0.05;
        beatIndex    = 0;
        running      = true;
        schedule();
    }

    function stopInternal() {
        running = false;
        clearTimeout(schedulerTimer);
    }

    function stop() {
        stopInternal();
        currentLevel = -1;
    }

    function setVolume(v) {
        if (!masterGain) return;
        masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime);
    }

    // Resume AudioContext if suspended after page visibility change
    document.addEventListener('visibilitychange', () => {
        if (!ctx) return;
        if (document.hidden) stopInternal();
        else if (currentLevel >= 0) playLevel(currentLevel);
    });

    return { playLevel, stop, setVolume };
})();
