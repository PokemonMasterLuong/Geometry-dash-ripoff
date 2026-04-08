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

    // Menu theme — upbeat funk intro
    const MENU_TRACK = { bpm:130, key:60, scale:MAJ,
        bass:[0,0,4,7, 5,5,4,2, 0,0,7,4, 5,4,2,0],
        mel: [4,7,9,7, 4,4,7,9, 5,9,7,5, 4,2,0,2],
        arp: [0,4,7,4, 0,4,7,9, 5,9,5,4, 0,4,7,0] };

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

        // 12 — "Boss: World Domination" — Montagem Rugada — A min, 130 bpm
        // Scale indices for A min: 0=A(root), 2=C(min3), 4=E(5th), 6=G(min7)
        // Bass is 16 quarter-note steps; boss scheduler doubles each at 8th-note level.
        // Pattern: root×3 → 5th → min3×2 → 5th → min3 → root×3 → 5th → min7 → 5th → min3 → root
        { bpm:130, key:57, scale:MIN, boss:true,
          bass:[0,0,0,4, 2,2,4,2, 0,0,0,4, 6,4,2,0],
          mel: [4,2,0,2, 4,6,4,2, 0,2,4,2, 6,4,2,4],
          arp: [0,4,2,4, 0,4,2,6, 2,0,4,2, 0,2,4,0] },
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
        } else if (type === 'tamborim') {
            // High metallic percussive hit — Brazilian funk flavour
            const buf  = ctx.createBuffer(1, ctx.sampleRate * 0.055, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
            const src = ctx.createBufferSource();
            const bpf = ctx.createBiquadFilter();
            const g   = ctx.createGain();
            src.buffer = buf;
            bpf.type = 'bandpass'; bpf.frequency.value = 4800; bpf.Q.value = 1.4;
            g.gain.setValueAtTime(0.22, time);
            g.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
            src.connect(bpf); bpf.connect(g); g.connect(masterGain);
            src.start(time); src.stop(time + 0.055);
        }
    }

    // ── 808-style sliding bass ────────────────────────────────────────────
    // freq1 = target note, freq2 = portamento destination (next note).
    // "Wub" attack: pitch dives from 1.45× above freq1 down to freq1 in ~28 ms,
    // then slides toward freq2 (portamento). Waveshaper gives the warm drive.

    function play808Bass(freq1, freq2, startTime, duration) {
        if (!ctx) return;
        const osc  = ctx.createOscillator();
        const ws   = ctx.createWaveShaper();
        const gain = ctx.createGain();

        // Soft-clip saturation — warmer, more driven 808 tone
        const N = 512, amt = 22;
        const curve = new Float32Array(N);
        for (let i = 0; i < N; i++) {
            const x = (i * 2) / N - 1;
            curve[i] = (Math.PI + amt) * x / (Math.PI + amt * Math.abs(x));
        }
        ws.curve = curve;
        ws.oversample = '2x';

        osc.type = 'sine';
        // WUB: start 1.45× above target, dive down in 28 ms → audible pitch sweep
        osc.frequency.setValueAtTime(freq1 * 1.45, startTime);
        osc.frequency.exponentialRampToValueAtTime(freq1, startTime + 0.028);
        // Portamento: glide toward next note after the wub settles
        osc.frequency.setValueAtTime(freq1, startTime + 0.028);
        osc.frequency.exponentialRampToValueAtTime(freq2, startTime + duration * 0.72);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.70, startTime + 0.003);  // instant punch
        gain.gain.setValueAtTime(0.50, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.84);

        osc.connect(ws);
        ws.connect(gain);
        gain.connect(masterGain);
        osc.start(startTime);
        osc.stop(startTime + duration);
    }

    function playHeavyKick(time) {
        if (!ctx) return;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(200, time);
        o.frequency.exponentialRampToValueAtTime(28, time + 0.22);
        g.gain.setValueAtTime(0.9, time);
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.28);
        o.connect(g); g.connect(masterGain);
        o.start(time); o.stop(time + 0.3);
    }

    // ── Scheduler ─────────────────────────────────────────────────────────

    const LOOKAHEAD   = 0.14;  // seconds to schedule ahead
    const SCHEDULE_HZ = 80;    // ms between scheduler calls

    function schedule() {
        if (!running || !ctx) return;
        const def      = currentTrack || LEVELS[0];
        const beatDur  = 60 / def.bpm;
        const n        = def.bass.length;   // pattern length in beats
        const now      = ctx.currentTime;

        while (beatClock < now + LOOKAHEAD) {
            const bi = ((beatIndex % n) + n) % n;
            const t  = beatClock;

            const bassDeg = def.bass[bi];
            const barBeat = beatIndex % 4;

            if (def.boss) {
                // ── BOSS: Montagem Rugada style ────────────────────────────
                const half    = beatDur * 0.5;
                const nextBi  = ((bi + 1) % n + n) % n;
                const nextDeg = def.bass[nextBi];
                const baseFreq = deg(def.scale, def.key, bassDeg, -2);
                const nextFreq = deg(def.scale, def.key, nextDeg, -2);

                // 808 doubles at 8th-note level — two wubs per beat ("wub wub")
                // On-beat hit: wub into current note, portamento toward next
                play808Bass(baseFreq, nextFreq, t, half * 0.93);
                // "And" hit: same wub again, continuing slide to next note
                play808Bass(baseFreq, nextFreq, t + half, half * 0.93);

                // Melody — sawtooth, on the beat only
                const melDeg = def.mel[bi];
                playNote(deg(def.scale, def.key, melDeg, 0), t, beatDur * 0.45, 'sawtooth', 0.09);

                // Arp — 16th-note subdivisions, square wave, slight detune chorus
                const subDur = beatDur / 4;
                for (let s = 0; s < 4; s++) {
                    const arpDeg = def.arp[(bi * 4 + s) % def.arp.length];
                    playNote(deg(def.scale, def.key, arpDeg, 1), t + s * subDur, subDur * 0.55,
                             'square', 0.042, (s % 2 === 0) ? 9 : -9);
                }

                // Drums — Montagem Rugada kick pattern:
                // Beat 1 (barBeat 0): downbeat kick + anticipation kick on "and of 2"
                if (barBeat === 0) {
                    playHeavyKick(t);
                    playHeavyKick(t + beatDur * 0.75);  // "and of 2" anticipation
                }
                // Beat 3 (barBeat 2): straight kick
                if (barBeat === 2) playHeavyKick(t);
                // "And of 4" (barBeat 3, half): pre-kick before bar 2
                if (barBeat === 3) playHeavyKick(t + half);
                // Snare on 2 and 4
                if (barBeat === 1 || barBeat === 3) playDrum(t, 'snare');
                // 16th hi-hats
                playDrum(t,                  'hihat');
                playDrum(t + beatDur * 0.25, 'hihat');
                playDrum(t + beatDur * 0.5,  'hihat');
                playDrum(t + beatDur * 0.75, 'hihat');
                // Tamborim — carioca funk pattern: "and" of every beat,
                // plus "e" and "ah" of beats 2 and 4 for the classic stutter
                playDrum(t + half, 'tamborim');
                if (barBeat === 1 || barBeat === 3) {
                    playDrum(t + beatDur * 0.25, 'tamborim');
                    playDrum(t + beatDur * 0.75, 'tamborim');
                }

            } else {
                // ── Normal levels — Montagem Rugada style ──────────────────
                // 808 sliding bass — slides into next note
                const nextBi  = ((bi + 1) % n + n) % n;
                const nextDeg = def.bass[nextBi];
                play808Bass(
                    deg(def.scale, def.key, bassDeg, -1),
                    deg(def.scale, def.key, nextDeg, -1),
                    t, beatDur * 0.92
                );

                // Lead melody — sawtooth for grit, upper octave
                const melDeg = def.mel[bi];
                playNote(deg(def.scale, def.key, melDeg, 1), t, beatDur * 0.45, 'sawtooth', 0.12);
                // Harmony layer — mid octave, quieter square
                playNote(deg(def.scale, def.key, melDeg, 0), t, beatDur * 0.40, 'square', 0.07);

                // Arp — 4 subdivisions, punchy
                const subDur = beatDur / 4;
                for (let s = 0; s < 4; s++) {
                    const arpDeg = def.arp[(bi * 4 + s) % def.arp.length];
                    playNote(deg(def.scale, def.key, arpDeg, 0), t + s * subDur, subDur * 0.6,
                             'sawtooth', 0.07, (s % 2 === 0) ? 7 : -7);
                }

                // Drums — Montagem Rugada pattern
                // Heavy kick: beat 1 + syncopated "and" of beat 1, beat 3
                if (barBeat === 0) {
                    playHeavyKick(t);
                    playHeavyKick(t + beatDur * 0.75); // syncopated anticipation kick
                }
                if (barBeat === 2) playHeavyKick(t);
                // Snare on beats 2 and 4
                if (barBeat === 1 || barBeat === 3) playDrum(t, 'snare');
                // 16th-note hi-hats — 4 per beat
                for (let hh = 0; hh < 4; hh++) {
                    playDrum(t + hh * beatDur / 4, 'hihat');
                }
                // Tamborim on off-beats (the "e" of beats 2 and 4)
                if (barBeat === 1 || barBeat === 3) {
                    playDrum(t + beatDur * 0.5, 'tamborim');
                }
            }

            beatClock += beatDur;
            beatIndex++;
        }

        schedulerTimer = setTimeout(schedule, SCHEDULE_HZ);
    }

    // ── Public API ─────────────────────────────────────────────────────────

    let currentTrack = null;  // the active track definition

    function startTrack(trackDef, id) {
        ensureCtx();
        if (id === currentLevel && running) return;
        stopInternal();
        currentLevel = id;
        currentTrack = trackDef;
        beatClock    = ctx.currentTime + 0.05;
        beatIndex    = 0;
        running      = true;
        schedule();
    }

    function playLevel(index) {
        const idx = Math.max(0, Math.min(index, LEVELS.length - 1));
        startTrack(LEVELS[idx], idx);
    }

    function playMenu() {
        startTrack(MENU_TRACK, -2);  // -2 = menu id (won't collide with level ids)
    }

    function stopInternal() {
        running = false;
        clearTimeout(schedulerTimer);
    }

    function stop() {
        stopInternal();
        currentLevel = -1;
        currentTrack = null;
    }

    function setVolume(v) {
        if (!masterGain) return;
        masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime);
    }

    // Resume AudioContext if suspended after page visibility change
    document.addEventListener('visibilitychange', () => {
        if (!ctx) return;
        if (document.hidden) stopInternal();
        else if (currentTrack) startTrack(currentTrack, currentLevel);
    });

    return { playLevel, playMenu, stop, setVolume };
})();
