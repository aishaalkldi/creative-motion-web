"use client";

/**
 * Integrated gait therapy session (MediaPipe + gamification logic).
 * Approach: isolated route `/therapy` with co-located lib under `app/therapy/lib`
 * so the main app stays unchanged except for the sessions iframe target.
 *
 * TODO: Pass patientId / difficulty from parent (sessions flow) and persist
 *       session results to the platform API / Supabase instead of localStorage only.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { PoseStatus } from "./PoseCamera";
import { syncPatientSessions, getSyncConfig } from "../lib/api-adapter";
import {
  saveSession,
  loadPatientSessions,
  getStoredPatientId,
  storePatientId,
  type SessionRecord,
} from "../lib/session-store";
import {
  loadOrGeneratePlan,
  generateSessionPlan,
  saveActivePlan,
  completePlan,
  evaluatePlanTargets,
  type SessionPlan,
} from "../lib/gait/session-plan";
import {
  getExerciseSessionConfig,
  type ExerciseSessionConfig,
} from "../lib/gait/exercise-session-config";
import {
  computeSessionBiomechanics,
  type StepMetrics,
  type BiomechanicsData,
} from "../lib/gait/biomechanics";
import { recordTherapySessionLog } from "@/app/lib/therapy-sessions-store";

const PoseCamera = dynamic(() => import("./PoseCamera"), { ssr: false });

/* ── Config ── */
const SESSION_DURATION = 60; // seconds
const PTS_PER_STEP     = 10; // points awarded per detected knee lift

/* ── Types ── */
type Phase = "safety" | "ready" | "countdown" | "playing" | "done";
type Side  = "left" | "right";

/* ── Pre-session safety questions ─────────────────────────────────────────── */
interface SafetyQuestion {
  id:          string;
  text:        string;
  subtext:     string;
  /** If answered Yes: session start is blocked. */
  yesBlocks:   boolean;
  /** Shown in red when yesBlocks && answered Yes. */
  blockReason?: string;
  /** Shown in yellow when !yesBlocks && answered Yes. */
  warningText?: string;
}

const SAFETY_QUESTIONS: SafetyQuestion[] = [
  {
    id:          "severe_pain",
    text:        "Are you experiencing severe pain right now?",
    subtext:     "7 or above on a 0–10 scale",
    yesBlocks:   true,
    blockReason: "Severe pain is a contraindication to exercise. Please rest and consult your therapist before continuing.",
  },
  {
    id:          "dizzy",
    text:        "Are you feeling dizzy, lightheaded, or unsteady?",
    subtext:     "Any balance instability at this moment",
    yesBlocks:   true,
    blockReason: "Dizziness is a contraindication to standing exercise. Sit and recover, and inform your therapist.",
  },
  {
    id:          "new_injury",
    text:        "Have you had a fall or new injury since your last session?",
    subtext:     "Including any medical event or hospital visit",
    yesBlocks:   true,
    blockReason: "Report any falls or new injuries to your therapist before resuming exercise.",
  },
  {
    id:          "pain_moving",
    text:        "Any pain or discomfort during movement today?",
    subtext:     "Mild or moderate — not severe",
    yesBlocks:   false,
    warningText: "Proceed with caution. Stop immediately if pain increases or reaches 7/10.",
  },
];

/* ── Camera-framing and quality status helpers ─────────────────────────────── */
function framingStatus(span: number, hasData: boolean) {
  if (!hasData)    return { label: "Initializing…", color: "text-slate-500",  hint: "Camera is starting up." };
  if (span <= 0.05) return { label: "Not detected",  color: "text-red-400",    hint: "Stand in front of the camera so your full body is visible." };
  if (span <  0.25) return { label: "Too far",       color: "text-yellow-400", hint: "Step closer to the camera." };
  if (span >  0.75) return { label: "Too close",     color: "text-yellow-400", hint: "Step back so your full body fits in frame." };
  return              { label: "Good",               color: "text-green-400",  hint: "Camera position looks good." };
}

function qualityStatus(quality: number, hasData: boolean) {
  if (!hasData)         return { label: "—",                              color: "text-slate-500" };
  if (quality >= 0.65)  return { label: `${Math.round(quality * 100)}%  Good`,    color: "text-green-400"  };
  if (quality >= 0.40)  return { label: `${Math.round(quality * 100)}%  Reduced`, color: "text-yellow-400" };
  return                       { label: `${Math.round(quality * 100)}%  Poor`,    color: "text-red-400"    };
}

/* ── Helpers ── */
function formatTime(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

/* ── Sound hook ───────────────────────────────────────────────────────────────
   Uses the Web Audio API only — no libraries, no external files, no network.
   AudioContext is created lazily on the first call (after a user gesture) to
   satisfy the browser autoplay policy.

   Enhanced audio design (v2):
   ────────────────────────────
   Each valid rep now triggers a 4-layer impact stack:
     Layer 0 — SUB-BASS THUMP   : very short (<60 ms), deep sine sweep (40–55 Hz).
                                   Gives the "physical weight" feel of a stomp.
     Layer 1 — STOMP BODY       : kick-drum-style frequency sweep (90–115 Hz).
                                   Left/right differentiated for L/R awareness.
     Layer 1b— MID PUNCH        : fast mid-frequency hit (180–220 Hz, 45 ms).
                                   Adds "body" so the impact feels solid, not thin.
     Layer 2 — CLICK TRANSIENT  : white-noise bandpass burst (28 ms).
                                   The sharp attack snap that makes timing feel instant.
     Layer 3 — SHIMMER          : rising triangle-wave sweep, active at combo ≥ 2.
                                   Volume grows with combo: 0.04 → 0.15 max.
     Layer 4 — POWER CHORD      : two triangle tones a 5th apart, active at combo ≥ 5.
                                   Turns a hit into a "power shot".
     Milestone — SPARKLE        : 3-note arpeggio every 5 hits in a streak.
     Milestone — FANFARE        : 5-note arpeggio + sawtooth sweep every 10 hits.

   Tuning:
     Sub-bass vol   0.42   deep but very brief — won't mask other layers
     Stomp vol      0.32   clear kick impact
     Mid punch      0.18   body filler
     Click vol      0.26   snappy attack
     Shimmer max    0.15   motivating accent
     Power chord    0.10   combo reward
     Sparkle vol    0.09   small milestone
     Fanfare vol    0.12   big milestone
──────────────────────────────────────────────────────────────────────────── */
function useSoundFX() {
  const ctxRef   = useRef<AudioContext | null>(null);
  const mutedRef = useRef(false);
  const [muted, rawSetMuted] = useState(false);

  const toggleMute = useCallback(() => {
    rawSetMuted((prev) => {
      mutedRef.current = !prev;
      return !prev;
    });
  }, []);

  /** Lazily create / resume the AudioContext */
  const getCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    try {
      if (!ctxRef.current) {
        const AC =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctxRef.current = new AC();
      }
      if (ctxRef.current.state === "suspended") ctxRef.current.resume();
      return ctxRef.current;
    } catch {
      return null;
    }
  }, []);

  /** Schedule a single oscillator tone with type support. */
  const tone = useCallback(
    (freq: number, dur: number, vol = 0.12, delay = 0, type: OscillatorType = "sine") => {
      if (mutedRef.current) return;
      const c = getCtx();
      if (!c) return;
      try {
        const osc  = c.createOscillator();
        const gain = c.createGain();
        osc.connect(gain);
        gain.connect(c.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, c.currentTime + delay);
        gain.gain.setValueAtTime(vol, c.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + dur);
        osc.start(c.currentTime + delay);
        osc.stop(c.currentTime + delay + dur + 0.01);
      } catch { /* silently ignore audio errors */ }
    },
    [getCtx],
  );

  /** Full 4-layer impact stack triggered by each validated knee lift. */
  const playStepImpact = useCallback(
    (side: "left" | "right", combo: number) => {
      if (mutedRef.current) return;
      const c = getCtx();
      if (!c) return;
      try {
        const now    = c.currentTime;
        const isLeft = side === "left";

        /* ── Layer 0: SUB-BASS THUMP — physical weight feel ────────────── */
        {
          const osc  = c.createOscillator();
          const gain = c.createGain();
          osc.connect(gain); gain.connect(c.destination);
          osc.frequency.setValueAtTime(isLeft ? 42 : 52, now);
          osc.frequency.exponentialRampToValueAtTime(24, now + 0.055);
          gain.gain.setValueAtTime(0.42, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.060);
          osc.start(now); osc.stop(now + 0.065);
        }

        /* ── Layer 1: STOMP BODY — kick-drum sweep ──────────────────────── */
        {
          const osc  = c.createOscillator();
          const gain = c.createGain();
          osc.connect(gain); gain.connect(c.destination);
          osc.frequency.setValueAtTime(isLeft ? 90 : 115, now);
          osc.frequency.exponentialRampToValueAtTime(isLeft ? 32 : 40, now + 0.14);
          gain.gain.setValueAtTime(0.32, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
          osc.start(now); osc.stop(now + 0.17);
        }

        /* ── Layer 1b: MID PUNCH — solid body filler ────────────────────── */
        {
          const osc  = c.createOscillator();
          const gain = c.createGain();
          osc.connect(gain); gain.connect(c.destination);
          osc.frequency.setValueAtTime(isLeft ? 185 : 230, now);
          osc.frequency.exponentialRampToValueAtTime(isLeft ? 75 : 92, now + 0.045);
          gain.gain.setValueAtTime(0.18, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
          osc.start(now); osc.stop(now + 0.060);
        }

        /* ── Layer 2: CLICK TRANSIENT — attack snap ─────────────────────── */
        {
          const size   = Math.ceil(c.sampleRate * 0.028);
          const buf    = c.createBuffer(1, size, c.sampleRate);
          const d      = buf.getChannelData(0);
          for (let i = 0; i < size; i++) d[i] = Math.random() * 2 - 1;
          const src    = c.createBufferSource();
          src.buffer   = buf;
          const filter = c.createBiquadFilter();
          filter.type  = "bandpass";
          filter.frequency.value = isLeft ? 2100 : 3000;
          filter.Q.value = 1.6;
          const gain   = c.createGain();
          gain.gain.setValueAtTime(0.26, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);
          src.connect(filter); filter.connect(gain); gain.connect(c.destination);
          src.start(now); src.stop(now + 0.032);
        }

        /* ── Layer 3: SHIMMER — rising harmonic, grows with combo ──────── */
        if (combo >= 2) {
          const freq = isLeft ? 1050 : 1420;
          const vol  = Math.min(0.15, 0.04 + (combo - 2) * 0.009);
          const osc  = c.createOscillator();
          const gain = c.createGain();
          osc.connect(gain); gain.connect(c.destination);
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now);
          osc.frequency.exponentialRampToValueAtTime(freq * 1.7, now + 0.10);
          gain.gain.setValueAtTime(vol, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          osc.start(now); osc.stop(now + 0.13);
        }

        /* ── Layer 4: POWER CHORD — combo ≥ 5 ──────────────────────────── */
        if (combo >= 5) {
          const root = isLeft ? 440 : 523;
          const vol  = Math.min(0.10, 0.05 + (combo - 5) * 0.004);
          [root, root * 1.5].forEach((f) => {          // root + perfect 5th
            const osc  = c.createOscillator();
            const gain = c.createGain();
            osc.connect(gain); gain.connect(c.destination);
            osc.type = "triangle";
            osc.frequency.value = f;
            gain.gain.setValueAtTime(vol, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
            osc.start(now); osc.stop(now + 0.18);
          });
        }

        /* ── Milestone: SPARKLE ARPEGGIO — every 5th hit ───────────────── */
        if (combo > 0 && combo % 5 === 0) {
          const isMajor = combo % 10 === 0;    // every 10th = bigger fanfare
          const base    = isLeft ? 660 : 880;
          const steps   = isMajor ? [0, 1, 2, 3, 4] : [0, 1, 2];
          const dStep   = isMajor ? 0.046 : 0.055;
          const vol     = isMajor ? 0.12 : 0.09;

          steps.forEach((i) => {
            const d    = i * dStep;
            const osc  = c.createOscillator();
            const gain = c.createGain();
            osc.connect(gain); gain.connect(c.destination);
            osc.type = isMajor ? "triangle" : "sine";
            osc.frequency.value = base * (1 + i * 0.25);
            gain.gain.setValueAtTime(vol, now + d);
            gain.gain.exponentialRampToValueAtTime(0.001, now + d + 0.09);
            osc.start(now + d); osc.stop(now + d + 0.10);
          });

          /* Extra sawtooth sweep for major (×10) milestones */
          if (isMajor) {
            const osc  = c.createOscillator();
            const gain = c.createGain();
            osc.connect(gain); gain.connect(c.destination);
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(180, now);
            osc.frequency.exponentialRampToValueAtTime(1400, now + 0.20);
            gain.gain.setValueAtTime(0.055, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
            osc.start(now); osc.stop(now + 0.23);
          }
        }
      } catch { /* ignore audio errors */ }
    },
    [getCtx],
  );

  /**
   * Energetic 4-note ascending fanfare for the GO! moment.
   * G4 → B4 → D5 → G5 — a rising perfect fourth.
   */
  const playGo = useCallback(() => {
    const c = getCtx();
    if (!c || mutedRef.current) return;
    const now   = c.currentTime;
    const notes = [392, 494, 587, 784] as const;   // G4 B4 D5 G5
    notes.forEach((freq, i) => {
      const d    = i * 0.062;
      const osc  = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain); gain.connect(c.destination);
      osc.type = "triangle";
      osc.frequency.value = freq;
      const vol = i === notes.length - 1 ? 0.17 : 0.11;
      gain.gain.setValueAtTime(vol, now + d);
      gain.gain.exponentialRampToValueAtTime(0.001, now + d + (i === notes.length - 1 ? 0.24 : 0.14));
      osc.start(now + d); osc.stop(now + d + 0.26);
    });
  }, [getCtx]);

  /**
   * Session-complete fanfare: ascending C5–E5–G5–C6, then a final C-major chord.
   * Feels rewarding without being jarring.
   */
  const playDone = useCallback(() => {
    const c = getCtx();
    if (!c || mutedRef.current) return;
    const now = c.currentTime;

    // Rising arpeggio
    ([
      [523,  0.00, 0.12, 0.20],
      [659,  0.14, 0.12, 0.20],
      [784,  0.28, 0.12, 0.22],
      [1047, 0.44, 0.15, 0.32],
    ] as const).forEach(([freq, delay, vol, dur]) => {
      const osc  = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain); gain.connect(c.destination);
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
      osc.start(now + delay); osc.stop(now + delay + dur + 0.05);
    });

    // Final C-major chord (softer, sustains)
    [523, 659, 784].forEach((freq) => {
      const osc  = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain); gain.connect(c.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0, now + 0.58);
      gain.gain.linearRampToValueAtTime(0.07, now + 0.62);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.10);
      osc.start(now + 0.58); osc.stop(now + 1.15);
    });
  }, [getCtx]);

  return { muted, toggleMute, playStepImpact, playGo, playDone };
}

/* ── Background music (Web Audio synthesiser) ─────────────────────────────
   Generates a motivating, looping 92-BPM rhythm entirely in the browser.
   No external files, no network requests, no libraries.

   Beat pattern (8 × 8th-notes per bar at 92 BPM = ~0.326 s each):
     Step 0  — kick + sub-bass + chord pad + bass + hihat  (beat 1)
     Step 1  — open hihat (offbeat swing feel)
     Step 2  — snare + clap click + hihat                  (beat 2)
     Step 3  — open hihat
     Step 4  — kick + sub-bass + chord pad + bass + hihat  (beat 3)
     Step 5  — open hihat
     Step 6  — snare + clap click + hihat                  (beat 4)
     Step 7  — open hihat

   Enhancements vs v1:
     • 92 BPM (was 80) — noticeably more energetic, still controlled
     • Kick doubled with a sub-bass layer for physical impact feel
     • Snare + sharp clap transient for crispness
     • Open hi-hats on odd steps for groove and forward momentum
     • Soft triangle chord pad on beats 1 & 3 for warmth/depth
     • Walking bass: alternates A2/E2 between beat 1 and beat 3
     • Subtle synth accent note every 4 bars to add melodic interest

   Uses the same lookahead scheduler (150 ms window, 30 ms polling).
─────────────────────────────────────────────────────────────────────────── */
function useBgMusic() {
  const ctxRef    = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const schRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextT     = useRef(0);
  const beatIdx   = useRef(0);
  const running   = useRef(false);
  const mutedRef  = useRef(false);
  const [muted, rawSetMuted] = useState(false);

  const BPM    = 92;
  const EIGHTH = (60 / BPM) / 2;   // ≈ 0.326 s per 8th-note step
  const LOOK   = 0.15;
  const SCHED  = 30;
  const VOL    = 0.42;              // slightly higher than v1 for energy

  const getCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    try {
      if (!ctxRef.current) {
        const AC =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctxRef.current = new AC();
        masterRef.current = ctxRef.current.createGain();
        masterRef.current.gain.value = 0;
        masterRef.current.connect(ctxRef.current.destination);
      }
      if (ctxRef.current.state === "suspended") ctxRef.current.resume();
      return ctxRef.current;
    } catch { return null; }
  }, []);

  const makeNoise = (c: AudioContext, dur: number) => {
    const size = Math.ceil(c.sampleRate * dur);
    const buf  = c.createBuffer(1, size, c.sampleRate);
    const d    = buf.getChannelData(0);
    for (let i = 0; i < size; i++) d[i] = Math.random() * 2 - 1;
    const src  = c.createBufferSource();
    src.buffer = buf;
    return src;
  };

  const scheduleStep = useCallback((step: number, t: number) => {
    const c = ctxRef.current;
    const m = masterRef.current;
    if (!c || !m) return;
    const s = step % 8;

    /* ── Kick drum — frequency-swept sine: "thump" ── */
    if (s === 0 || s === 4) {
      const osc  = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain); gain.connect(m);
      osc.frequency.setValueAtTime(100, t);
      osc.frequency.exponentialRampToValueAtTime(36, t + 0.25);
      gain.gain.setValueAtTime(1.0, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.start(t); osc.stop(t + 0.30);

      /* Sub-bass punch layer — adds deep "body weight" to the kick */
      const osc2  = c.createOscillator();
      const gain2 = c.createGain();
      osc2.connect(gain2); gain2.connect(m);
      osc2.frequency.setValueAtTime(52, t);
      osc2.frequency.exponentialRampToValueAtTime(26, t + 0.11);
      gain2.gain.setValueAtTime(0.55, t);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      osc2.start(t); osc2.stop(t + 0.14);
    }

    /* ── Snare + clap click — crispier backbeat ── */
    if (s === 2 || s === 6) {
      // Main snare noise
      const src    = makeNoise(c, 0.13);
      const filter = c.createBiquadFilter();
      filter.type  = "bandpass"; filter.frequency.value = 950; filter.Q.value = 0.70;
      const gain   = c.createGain();
      gain.gain.setValueAtTime(0.42, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      src.connect(filter); filter.connect(gain); gain.connect(m);
      src.start(t); src.stop(t + 0.14);

      // Short clap transient on top for crispness
      const src2    = makeNoise(c, 0.012);
      const filter2 = c.createBiquadFilter();
      filter2.type  = "bandpass"; filter2.frequency.value = 1900; filter2.Q.value = 0.55;
      const gain2   = c.createGain();
      gain2.gain.setValueAtTime(0.30, t);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
      src2.connect(filter2); filter2.connect(gain2); gain2.connect(m);
      src2.start(t); src2.stop(t + 0.015);
    }

    /* ── Hi-hats: closed on downbeats, open on off-beats ── */
    {
      const isOpen = s % 2 === 1;              // open on odd steps (off-beat)
      const dur    = isOpen ? 0.10 : 0.050;
      const src    = makeNoise(c, dur);
      const filter = c.createBiquadFilter();
      filter.type  = "highpass";
      filter.frequency.value = isOpen ? 7800 : 9800;
      const gain   = c.createGain();
      gain.gain.setValueAtTime(s % 2 === 0 ? 0.16 : 0.10, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter); filter.connect(gain); gain.connect(m);
      src.start(t); src.stop(t + dur + 0.005);
    }

    /* ── Walking bass: A2 (110 Hz) on beat 1, E2 (82 Hz) on beat 3 ── */
    if (s === 0 || s === 4) {
      const bassFreq = s === 0 ? 110 : 82;
      const osc  = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain); gain.connect(m);
      osc.type = "sine"; osc.frequency.value = bassFreq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.46, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + EIGHTH * 1.6);
      osc.start(t); osc.stop(t + EIGHTH * 2);
    }

    /* ── Chord pad — soft triangle pulse on beats 1 & 3 ── */
    if (s === 0 || s === 4) {
      // A-minor voicing: A3/C4/E4 — warm and motivating, not jarring
      const chordFreqs = [220, 261, 330] as const;
      chordFreqs.forEach((freq) => {
        const osc  = c.createOscillator();
        const gain = c.createGain();
        osc.connect(gain); gain.connect(m);
        osc.type = "triangle";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.045, t + 0.04);
        gain.gain.setValueAtTime(0.045, t + EIGHTH * 0.70);
        gain.gain.linearRampToValueAtTime(0, t + EIGHTH * 0.95);
        osc.start(t); osc.stop(t + EIGHTH + 0.01);
      });
    }

    /* ── Synth accent — every 4 bars (32 steps), adds melodic interest ── */
    if (s === 0 && step > 0 && step % 32 === 0) {
      const freq = (Math.floor(step / 32) % 2 === 0) ? 440 : 587; // A4 or D5
      const osc  = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain); gain.connect(m);
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.start(t); osc.stop(t + 0.20);
    }
  }, [EIGHTH]);

  /* ── Lookahead scheduler ── */
  const schedule = useCallback(() => {
    const c = ctxRef.current;
    if (!c || !running.current) return;
    while (nextT.current < c.currentTime + LOOK) {
      scheduleStep(beatIdx.current, nextT.current);
      nextT.current += EIGHTH;
      beatIdx.current++;
    }
    schRef.current = setTimeout(schedule, SCHED);
  }, [scheduleStep, EIGHTH]);

  /* ── Public API ── */
  const start = useCallback(() => {
    const c = getCtx();
    if (!c || !masterRef.current) return;
    // Cancel any residual fade-out and reset gain
    const now = c.currentTime;
    masterRef.current.gain.cancelScheduledValues(now);
    masterRef.current.gain.setValueAtTime(0, now);
    if (!mutedRef.current) {
      // 1.5 s fade-in — gentle start, feels motivating not startling
      masterRef.current.gain.linearRampToValueAtTime(VOL, now + 1.5);
    }
    running.current   = true;
    nextT.current     = now + 0.08;
    beatIdx.current   = 0;
    schedule();
  }, [getCtx, schedule]);

  const stop = useCallback(() => {
    if (!running.current) return;
    running.current = false;
    if (schRef.current !== null) { clearTimeout(schRef.current); schRef.current = null; }
    // Short fade-out to avoid a hard click when the session ends
    if (masterRef.current && ctxRef.current) {
      const now = ctxRef.current.currentTime;
      masterRef.current.gain.cancelScheduledValues(now);
      masterRef.current.gain.setValueAtTime(masterRef.current.gain.value, now);
      masterRef.current.gain.linearRampToValueAtTime(0, now + 0.4);
    }
  }, []);

  const toggleMute = useCallback(() => {
    rawSetMuted((prev) => {
      const next = !prev;
      mutedRef.current = next;
      if (masterRef.current && ctxRef.current && running.current) {
        const now = ctxRef.current.currentTime;
        masterRef.current.gain.cancelScheduledValues(now);
        masterRef.current.gain.setValueAtTime(masterRef.current.gain.value, now);
        masterRef.current.gain.linearRampToValueAtTime(next ? 0 : VOL, now + 0.12);
      }
      return next;
    });
  }, []);

  return { start, stop, muted, toggleMute };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main component
═══════════════════════════════════════════════════════════════════════════ */
export default function SessionPage() {
  /* Sound effects (step ticks, GO!, done chime) */
  const sound    = useSoundFX();
  const soundRef = useRef(sound);
  soundRef.current = sound;

  /* Background music synthesiser */
  const bgMusic    = useBgMusic();
  const bgMusicRef = useRef(bgMusic);
  bgMusicRef.current = bgMusic;

  /* UI phase */
  const [phase,        setPhase]        = useState<Phase>("safety");
  const [countdownVal, setCountdownVal] = useState(3);

  /* Safety screen — answers: null = unanswered, true/false = answered */
  const [safetyAnswers, setSafetyAnswers] = useState<Record<string, boolean | null>>(
    () => Object.fromEntries(SAFETY_QUESTIONS.map((q) => [q.id, null])),
  );

  /* Camera quality check — accumulated during the "ready" phase */
  const camCheckRef  = useRef<{ sum: number; count: number }>({ sum: 0, count: 0 });
  const [camBodySpan, setCamBodySpan] = useState(0);
  const [camQuality,  setCamQuality]  = useState(0);

  /* Session stats — updated ONLY by real camera events */
  const [timeLeft,   setTimeLeft]   = useState(SESSION_DURATION);
  const [score,      setScore]      = useState(0);
  const [leftSteps,  setLeftSteps]  = useState(0);
  const [rightSteps, setRightSteps] = useState(0);
  const [lastSide,   setLastSide]   = useState<Side | null>(null);

  /* Streak / combo — increments on each step, auto-resets after COMBO_RESET_MS
     of no movement so patients who pause briefly don't get penalised harshly  */
  const COMBO_RESET_MS            = 2500; // ~3 beats at 80 BPM
  const [combo,     setCombo]     = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const comboRef      = useRef(0);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Biomechanics accumulator — collects per-step metrics during "playing" */
  const stepMetricsRef = useRef<{ left: StepMetrics[]; right: StepMetrics[] }>({
    left: [],
    right: [],
  });

  /* Landmark quality accumulator — tracks mean lower-body visibility per frame */
  const lmQualityRef = useRef<{ sum: number; count: number }>({ sum: 0, count: 0 });

  /* Fatigue index: record timestamp (ms) for every detected step */
  const stepTimestampsRef = useRef<number[]>([]);

  /* Camera visibility: count onKneeRaise frames fired during "playing" */
  const poseFramesRef = useRef(0);

  /* Patient identity & session persistence */
  const router = useRouter();
  const [patientId,   setPatientId]   = useState<string>("PT-001");
  const [savedRecord, setSavedRecord] = useState<SessionRecord | null>(null);

  /* Active session plan — loaded on mount, refreshed after each saved session */
  const [activePlan,    setActivePlan]    = useState<SessionPlan | null>(null);
  const activePlanRef = useRef<SessionPlan | null>(null);

  /* Exercise-specific detection config — derived from the active plan.
     Falls back to DEFAULT_SESSION_CONFIG (original behaviour) if no plan. */
  const exerciseConfig: ExerciseSessionConfig = useMemo(
    () => getExerciseSessionConfig(activePlan?.exerciseId ?? "default"),
    [activePlan?.exerciseId],
  );

  /* Reset camera-check accumulators each time "ready" is entered */
  useEffect(() => {
    if (phase === "ready") {
      camCheckRef.current = { sum: 0, count: 0 };
      setCamBodySpan(0);
      setCamQuality(0);
    }
  }, [phase]);

  /* Load stored patient ID and active plan on first render */
  useEffect(() => {
    const pid      = getStoredPatientId();
    const sessions = loadPatientSessions(pid);
    const plan     = loadOrGeneratePlan(pid, sessions);
    setPatientId(pid);
    setActivePlan(plan);
    activePlanRef.current = plan;
  }, []);

  /* Camera status */
  const [poseReady,  setPoseReady]  = useState(false);
  const [poseStatus, setPoseStatus] = useState<PoseStatus>("initializing");

  /* Refs for use inside async timers/callbacks without stale closures */
  const phaseRef      = useRef<Phase>("ready");
  const doneRef       = useRef(false);
  const cdRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>  | null>(null);

  phaseRef.current = phase; // keep ref in sync on every render

  /* ── Derived values ── */
  const totalSteps  = leftSteps + rightSteps;
  const timerPct    = (timeLeft / SESSION_DURATION) * 100;
  const symmetryPct = totalSteps < 2
    ? 100
    : Math.round((Math.min(leftSteps, rightSteps) / Math.max(leftSteps, rightSteps)) * 100);
  const stepsPerMin = timeLeft < SESSION_DURATION
    ? Math.round((totalSteps / (SESSION_DURATION - timeLeft)) * 60)
    : 0;

  /* ── End session ── */
  const endSession = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    clearInterval(timerRef.current!);
    clearTimeout(feedbackTimer.current!);
    clearTimeout(comboTimerRef.current!);
    setLastSide(null);
    soundRef.current.playDone();
    setPhase("done");
  }, []);

  /* ── Countdown ── */
  useEffect(() => {
    if (phase !== "countdown") return;
    setCountdownVal(3);
    let count = 3;
    cdRef.current = setInterval(() => {
      count -= 1;
      setCountdownVal(count);
      if (count <= 0) {
        clearInterval(cdRef.current!);
        soundRef.current.playGo();
        setTimeout(() => setPhase("playing"), 700);
      }
    }, 1000);
    return () => clearInterval(cdRef.current!);
  }, [phase]);

  /* ── Session timer ── */
  useEffect(() => {
    if (phase !== "playing") return;
    doneRef.current = false;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { endSession(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [phase, endSession]);

  /* ── Background music — starts with the session, stops when it ends ── */
  useEffect(() => {
    if (phase === "playing") {
      bgMusicRef.current.start();
    } else {
      bgMusicRef.current.stop();
    }
  }, [phase]); // bgMusicRef.current is always current; phase drives start/stop

  /* ── Step handler — the only source of score, reps, and combo ──
     Called by PoseCamera on each real knee-lift rising edge.
     Only active during the "playing" phase.
  ── */
  /* Per-frame landmark quality accumulator — only active during "playing" */
  const handleFrameQuality = useCallback((quality: number) => {
    if (phaseRef.current === "playing") {
      lmQualityRef.current.sum   += quality;
      lmQualityRef.current.count += 1;
    }
    if (phaseRef.current === "ready") {
      camCheckRef.current.sum   += quality;
      camCheckRef.current.count += 1;
      // Throttle state updates to every 10 frames (~330 ms) to avoid excessive re-renders
      if (camCheckRef.current.count % 10 === 0) {
        setCamQuality(camCheckRef.current.sum / camCheckRef.current.count);
      }
    }
  }, []);

  const handleBodySpan = useCallback((span: number) => {
    if (phaseRef.current !== "ready") return;
    setCamBodySpan((prev) => (Math.abs(prev - span) > 0.02 ? span : prev));
  }, []);

  const handleStepDetected = useCallback((side: Side, metrics: StepMetrics) => {
    if (phaseRef.current !== "playing") return;

    /* ── Biomechanics accumulation ── */
    stepMetricsRef.current[side].push(metrics);

    /* ── Fatigue tracking ── */
    stepTimestampsRef.current.push(Date.now());

    /* ── Combo: increment, save best, arm auto-reset timer ── */
    clearTimeout(comboTimerRef.current!);
    const newCombo = comboRef.current + 1;
    comboRef.current = newCombo;
    setCombo(newCombo);
    setBestCombo((best) => Math.max(best, newCombo));
    comboTimerRef.current = setTimeout(() => {
      comboRef.current = 0;
      setCombo(0);
    }, COMBO_RESET_MS);

    /* ── Impact sound — combo-aware layering ── */
    soundRef.current.playStepImpact(side, newCombo);

    /* ── Stats ── */
    if (side === "left")  setLeftSteps((n) => n + 1);
    else                  setRightSteps((n) => n + 1);
    setScore((s) => s + PTS_PER_STEP);

    /* ── Visual feedback ── */
    setLastSide(side);
    clearTimeout(feedbackTimer.current!);
    feedbackTimer.current = setTimeout(() => setLastSide(null), 800);
  }, []); // all mutable values read via refs — deps intentionally empty

  /* ── Pose-frame counter for camera visibility score ── */
  const handleKneeRaise = useCallback((_left: number, _right: number) => {
    if (phaseRef.current === "playing") poseFramesRef.current++;
  }, []);

  /* ── Save completed session to localStorage ── */
  const handleSaveSession = useCallback(() => {
    const pid    = patientId.trim() || "PT-001";
    const { left: leftMetrics, right: rightMetrics } = stepMetricsRef.current;

    // Landmark quality: mean lower-body visibility across all playing frames
    const lmQ = lmQualityRef.current;
    const sessionLandmarkQuality = lmQ.count > 0 ? lmQ.sum / lmQ.count : 0;

    // Biomechanics — requires ≥5 detected steps for statistically meaningful scores.
    // Below this, individual-sample noise would dominate the CV and angle averages.
    const biomechanics: BiomechanicsData | undefined =
      leftMetrics.length + rightMetrics.length >= 5
        ? computeSessionBiomechanics(leftMetrics, rightMetrics, sessionLandmarkQuality)
        : undefined;

    // Fatigue index: compare step density in first half vs second half of session
    const ts = stepTimestampsRef.current;
    let fatigueIndex = 0;
    if (ts.length >= 4) {
      const mid   = (ts[0] + ts[ts.length - 1]) / 2;
      const first = ts.filter((t) => t <= mid).length;
      const second = ts.filter((t) => t > mid).length;
      fatigueIndex = first > 0 ? Math.max(0, Math.min(1, 1 - second / first)) : 0;
    }

    // Camera visibility: pose-detected frames out of expected 30fps × SESSION_DURATION
    const cameraVisibilityScore = Math.min(
      100,
      Math.round((poseFramesRef.current / (SESSION_DURATION * 30)) * 100),
    );

    // Session-level warnings
    const sessionSymmetry = totalSteps < 2
      ? 100
      : Math.round((Math.min(leftSteps, rightSteps) / Math.max(leftSteps, rightSteps)) * 100);
    const warnings = computeSessionWarnings(
      totalSteps, sessionSymmetry, fatigueIndex, cameraVisibilityScore, biomechanics,
    );

    // Positive feedback messages
    const feedbackMessages = computeSessionFeedback(
      totalSteps, sessionSymmetry, bestCombo, biomechanics,
    );

    // Build the session metrics snapshot used for both storage and plan evaluation
    const sessionMetrics = {
      patientId:   pid,
      date:        new Date().toISOString(),
      durationSec: SESSION_DURATION,
      score,
      totalSteps,
      leftSteps,
      rightSteps,
      symmetryPct: sessionSymmetry,
      bestCombo,
      stepsPerMin: Math.round((totalSteps / SESSION_DURATION) * 60),
      biomechanics,
      fatigueIndex:          Math.round(fatigueIndex * 100) / 100,
      cameraVisibilityScore,
      warnings,
      feedbackMessages,
    };

    // Evaluate plan targets before saving (uses same metrics, no circular dep)
    const currentPlan        = activePlanRef.current;
    const targetAchievements = currentPlan
      ? evaluatePlanTargets(currentPlan, sessionMetrics)
      : undefined;

    const record = saveSession({
      ...sessionMetrics,
      planId:             currentPlan?.id,
      exerciseId:         currentPlan?.exerciseId,
      targetAchievements,
    });

    storePatientId(pid);
    setPatientId(pid);
    setSavedRecord(record);

    try {
      recordTherapySessionLog({
        id: record.id,
        patientId: pid,
        recordedAt: record.date,
        programLabel: "Side stepping / gait therapy",
        score: record.score,
        totalSteps: record.totalSteps,
        symmetryPct: record.symmetryPct,
      });
    } catch {
      /* localStorage unavailable */
    }

    // Non-blocking sync to the Creative Motion platform.
    // Local save above is already complete and is the primary UX path.
    // getSyncConfig() returns null when NEXT_PUBLIC_CM_API_URL is not set,
    // which causes syncPatientSessions to skip silently — no side effects.
    syncPatientSessions(pid, getSyncConfig()).then((result) => {
      if (process.env.NODE_ENV !== "development") return;
      const tag = "[CM Sync]";
      if (result.status === "success") {
        console.log(`${tag} ✓ synced ${result.sessionsSent} session(s) — patient: ${pid}`);
      } else if (result.status === "error") {
        console.warn(`${tag} ✗ ${result.reason} — ${result.error}`);
      } else {
        console.log(`${tag} — skipped (${result.reason ?? "unknown"})`);
      }
    });

    // Complete the current plan and pre-generate the next one
    if (currentPlan) {
      completePlan(pid);
      const updatedSessions = loadPatientSessions(pid);
      const nextPlan        = generateSessionPlan(pid, updatedSessions);
      saveActivePlan(nextPlan);
      setActivePlan(nextPlan);
      activePlanRef.current = nextPlan;
    }
  }, [patientId, score, totalSteps, leftSteps, rightSteps, bestCombo]);

  /* ── Reset all session state ── */
  const resetState = useCallback(() => {
    doneRef.current   = false;
    comboRef.current  = 0;
    clearTimeout(comboTimerRef.current!);
    stepMetricsRef.current    = { left: [], right: [] };
    lmQualityRef.current      = { sum: 0, count: 0 };
    stepTimestampsRef.current = [];
    poseFramesRef.current     = 0;
    setTimeLeft(SESSION_DURATION);
    setScore(0);
    setLeftSteps(0);
    setRightSteps(0);
    setLastSide(null);
    setCombo(0);
    setBestCombo(0);
    setCountdownVal(3);
    setSavedRecord(null);
  }, []);

  /* ════════════════════════════════════════════════════════════════════════
     Render
  ════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-10">

      {/* ── SAFETY SCREEN ─────────────────────────────────────────────── */}
      {phase === "safety" && (() => {
        const blockingQ   = SAFETY_QUESTIONS.find((q) => q.yesBlocks && safetyAnswers[q.id] === true);
        const warningQs   = SAFETY_QUESTIONS.filter((q) => !q.yesBlocks && safetyAnswers[q.id] === true);
        const allAnswered = SAFETY_QUESTIONS.every((q) => safetyAnswers[q.id] !== null);
        const canProceed  = allAnswered && !blockingQ;

        return (
          <div className="flex w-full max-w-md flex-col gap-6">

            {/* Header */}
            <div className="text-center">
              <div className="mb-3 flex items-center justify-center gap-2">
                <span className="text-2xl">🛡</span>
                <h1 className="text-xl font-bold text-white">Pre-Session Safety Check</h1>
              </div>
              <p className="text-sm text-slate-500">
                Answer each question honestly before the camera opens.
                Responses are not recorded or transmitted.
              </p>
            </div>

            {/* Questions */}
            <div className="flex flex-col gap-3">
              {SAFETY_QUESTIONS.map((q) => {
                const answered = safetyAnswers[q.id];
                const isBlocker = q.yesBlocks && answered === true;
                const isWarning = !q.yesBlocks && answered === true;

                return (
                  <div key={q.id} className={`rounded-2xl border p-4 transition-colors ${
                    isBlocker ? "border-red-400/30 bg-red-400/6"
                    : isWarning ? "border-yellow-400/25 bg-yellow-400/5"
                    : "border-white/8 bg-white/3"
                  }`}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-200">{q.text}</p>
                        <p className="mt-0.5 text-[11px] text-slate-600">{q.subtext}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {(["Yes", "No"] as const).map((opt) => {
                          const val = opt === "Yes";
                          const active = answered === val;
                          return (
                            <button
                              key={opt}
                              onClick={() => setSafetyAnswers((prev) => ({ ...prev, [q.id]: val }))}
                              className={`min-w-[52px] rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                                active && val && q.yesBlocks
                                  ? "border-red-400/50 bg-red-400/20 text-red-300"
                                  : active && val && !q.yesBlocks
                                  ? "border-yellow-400/40 bg-yellow-400/15 text-yellow-300"
                                  : active && !val
                                  ? "border-green-400/40 bg-green-400/12 text-green-400"
                                  : "border-white/10 bg-white/4 text-slate-500 hover:border-white/20 hover:text-slate-300"
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Block reason */}
                    {isBlocker && q.blockReason && (
                      <p className="mt-2 rounded-lg border border-red-400/20 bg-red-400/8 px-3 py-2 text-[11px] leading-relaxed text-red-300">
                        {q.blockReason}
                      </p>
                    )}
                    {/* Warning text */}
                    {isWarning && q.warningText && (
                      <p className="mt-2 rounded-lg border border-yellow-400/20 bg-yellow-400/6 px-3 py-2 text-[11px] leading-relaxed text-yellow-300">
                        {q.warningText}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Status summary */}
            {blockingQ && (
              <div className="rounded-2xl border border-red-400/30 bg-red-400/8 px-4 py-3 text-center">
                <p className="text-sm font-semibold text-red-300">Session blocked</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Answer the highlighted question differently, or contact your therapist.
                </p>
              </div>
            )}
            {warningQs.length > 0 && !blockingQ && (
              <div className="rounded-2xl border border-yellow-400/25 bg-yellow-400/5 px-4 py-2 text-center">
                <p className="text-xs text-yellow-300">
                  You may proceed — but stop the session immediately if pain increases.
                </p>
              </div>
            )}

            {/* Proceed button */}
            <button
              disabled={!canProceed}
              onClick={() => setPhase("ready")}
              className={`w-full rounded-2xl py-4 text-sm font-semibold transition-all duration-200 ${
                canProceed
                  ? "bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-lg shadow-cyan-500/20 hover:scale-105 active:scale-95"
                  : "cursor-not-allowed bg-white/5 text-slate-600"
              }`}
            >
              {!allAnswered ? "Answer all questions to continue" : canProceed ? "Continue — Open Camera" : "Session blocked"}
            </button>

            {/* Disclaimer */}
            <p className="text-center text-[10px] text-slate-700">
              This safety screen is a basic patient-care prompt. It does not replace therapist assessment.
              Thresholds (e.g. pain ≥7/10) are reference values, not validated clinical cut-offs.
            </p>
          </div>
        );
      })()}

      {/* ── READY ─────────────────────────────────────────────────────── */}
      {phase === "ready" && (
        <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">

          {/* Title */}
          <div className="flex flex-col items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-cyan-400">
              Gait Training Program
            </span>
            <h1 className="text-4xl font-bold text-white">
              Exercise{" "}
              <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Session
              </span>
            </h1>
            <p className="text-sm text-slate-400">
              March in place — the camera counts your real knee lifts.
            </p>
          </div>

          {/* Camera status + setup quality */}
          {(() => {
            const hasData  = camBodySpan > 0 || camQuality > 0;
            const framing  = framingStatus(camBodySpan, hasData);
            const quality  = qualityStatus(camQuality,  hasData);
            const setupOK  = hasData && camBodySpan > 0.1 && camBodySpan <= 0.75 && camQuality >= 0.4;
            return (
              <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
                <p className="mb-3 text-xs font-medium uppercase tracking-widest text-slate-600">
                  Camera Setup
                </p>

                {/* Pose detection status */}
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-lg transition-colors ${
                    poseReady ? "bg-green-400/15 text-green-400" : "bg-white/5 text-slate-600"
                  }`}>
                    {poseReady ? "✓" : "📷"}
                  </div>
                  <div className="text-left">
                    <p className={`text-sm font-semibold ${poseReady ? "text-green-400" : "text-slate-400"}`}>
                      {poseReady                             ? "Pose detected"
                       : poseStatus === "loading_model"     ? "Loading pose model…"
                       : poseStatus === "no_pose"           ? "Show your full body in frame"
                       : poseStatus === "error"             ? "Camera error"
                       :                                      "Starting camera…"}
                    </p>
                    <p className="text-xs text-slate-600">
                      Stand 2–3 m away · full body visible in camera
                    </p>
                  </div>
                </div>

                {/* Framing + quality grid */}
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/5 pt-3">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-widest text-slate-600">Framing</p>
                    <p className={`mt-0.5 text-sm font-semibold ${framing.color}`}>{framing.label}</p>
                    <p className="mt-0.5 text-[10px] text-slate-600">{framing.hint}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-widest text-slate-600">Landmark quality</p>
                    <p className={`mt-0.5 text-sm font-semibold ${quality.color}`}>{quality.label}</p>
                    <p className="mt-0.5 text-[10px] text-slate-600">
                      {!hasData ? "Waiting for first frames…"
                       : camQuality >= 0.4 ? "All 6 lower-body landmarks visible"
                       : "Improve lighting or step back"}
                    </p>
                  </div>
                </div>

                {/* Soft warning if setup is poor but session start is still allowed */}
                {hasData && !setupOK && (
                  <p className="mt-3 rounded-lg border border-yellow-400/20 bg-yellow-400/5 px-3 py-2 text-[10px] leading-relaxed text-yellow-300">
                    Camera setup could affect measurement quality.
                    Adjust your position, then start when ready — or proceed and note reduced data reliability.
                  </p>
                )}
              </div>
            );
          })()}

          {/* Patient ID */}
          <div className="w-full">
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-widest text-slate-600">
              Patient ID
            </label>
            <input
              type="text"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder="e.g. PT-001"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-700 outline-none focus:border-cyan-400/30 transition-colors"
            />
            <p className="mt-1 text-[10px] text-slate-700">
              Used to link this session to your progress report
            </p>
          </div>

          {/* Prescribed session plan */}
          {activePlan && (
            <div className="w-full rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
              <p className="mb-1.5 text-[9px] font-medium uppercase tracking-widest text-slate-600">
                Prescribed Session
              </p>
              <p className="text-sm font-semibold text-cyan-300">{activePlan.exerciseName}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{activePlan.coachingCues[0]}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {activePlan.targets.map((t, i) => (
                  <span key={i} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] text-slate-400">
                    {t.label}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[9px] leading-relaxed text-slate-700">{activePlan.clinicalRationale}</p>
            </div>
          )}

          {/* Start button */}
          <button
            onClick={() => { resetState(); setPhase("countdown"); }}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-10 py-4 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all duration-200 hover:scale-105 active:scale-95"
          >
            ▶&nbsp; Start Session
          </button>

          <p className="text-xs text-slate-700">Session lasts {SESSION_DURATION} seconds</p>
        </div>
      )}

      {/* ── COUNTDOWN ─────────────────────────────────────────────────── */}
      {phase === "countdown" && (
        <div className="flex flex-col items-center gap-6 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-slate-600">
            Starting in…
          </p>
          <span
            key={countdownVal}
            className={`font-bold leading-none tabular-nums ${
              countdownVal <= 0
                ? "text-7xl bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent"
                : "text-[9rem] text-white"
            }`}
            style={{ animation: "countPop 0.35s ease-out forwards" }}
          >
            {countdownVal <= 0 ? "GO!" : countdownVal}
          </span>
          <p className="text-sm text-slate-500">
            {countdownVal <= 0 ? "March in place!" : "Prepare to march"}
          </p>
        </div>
      )}

      {/* ── PLAYING ───────────────────────────────────────────────────── */}
      {phase === "playing" && (
        <div className="flex w-full max-w-md flex-col gap-5">

          {/* Timer */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-slate-600">Time remaining</span>
              <span className="tabular-nums font-medium text-slate-400">{formatTime(timeLeft)}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-[width] duration-1000 ease-linear"
                style={{ width: `${timerPct}%` }}
              />
            </div>
          </div>

          {/* Activity score + repetition count */}
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Activity Score" value={score.toLocaleString()} accent="cyan" />
            <StatCard label="Repetitions" value={String(totalSteps)} accent="blue" />
          </div>

          {/* Live target progress — shows only targets computable in real-time */}
          {activePlan && activePlan.targets.some((t) => t.isLiveTrackable) && (
            <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-3">
              <p className="mb-2 text-[9px] font-medium uppercase tracking-widest text-slate-700">
                {activePlan.exerciseName} · Targets
              </p>
              <div className="flex flex-wrap gap-2">
                {activePlan.targets.filter((t) => t.isLiveTrackable).map((t, i) => {
                  const live =
                    t.metric === "totalSteps" ? totalSteps :
                    t.metric === "symmetryPct" ? symmetryPct :
                    t.metric === "stepsPerMin" ? stepsPerMin : -1;
                  const met =
                    live >= 0 && (
                      t.operator === ">=" ? live >= t.threshold :
                      t.operator === "<=" ? live <= t.threshold :
                      live >= t.threshold && live <= (t.thresholdMax ?? Infinity)
                    );
                  return (
                    <div key={i} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-medium transition-all duration-300 ${
                      met
                        ? "border-green-400/40 bg-green-400/10 text-green-300"
                        : "border-white/8 bg-white/3 text-slate-500"
                    }`}>
                      <span>{met ? "✓" : "○"}</span>
                      <span>{t.label}</span>
                      {live >= 0 && <span className="text-slate-600">({live})</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Live detection feedback — border and glow scale with combo */}
          <div className={`rounded-3xl border px-6 py-6 text-center transition-all duration-150 ${
            combo >= 15 && lastSide ? "border-orange-400/70 bg-orange-400/10 shadow-lg shadow-orange-500/20" :
            combo >= 10 && lastSide ? "border-yellow-400/70 bg-yellow-400/10 shadow-lg shadow-yellow-500/20" :
            combo >= 5  && lastSide ? "border-green-400/60  bg-green-400/10  shadow-lg shadow-green-500/15"  :
            lastSide === "left"     ? "border-cyan-400/50  bg-cyan-400/10"  :
            lastSide === "right"    ? "border-blue-400/50  bg-blue-400/10"  :
            combo >= 10             ? "border-yellow-400/25 bg-yellow-400/5" :
            combo >= 5              ? "border-green-400/20  bg-green-400/5"  :
                                      "border-white/8 bg-white/3"
          }`}>
            {lastSide ? (
              <>
                <p className={`text-4xl font-bold tracking-tight ${
                  combo >= 15 ? "text-orange-300" :
                  combo >= 10 ? "text-yellow-300" :
                  combo >= 5  ? "text-green-300"  :
                                "text-white"
                }`}>
                  {lastSide === "left" ? "← LEFT" : "RIGHT →"}
                </p>

                {/* Streak badge — appears from combo 3 */}
                {combo >= 3 && (
                  <p className={`mt-1.5 text-sm font-bold ${
                    combo >= 15 ? "text-orange-400" :
                    combo >= 10 ? "text-yellow-400" :
                    combo >= 5  ? "text-green-400"  :
                                  "text-cyan-400"
                  }`}>
                    {combo >= 15 ? "🔥" : combo >= 10 ? "⚡" : combo >= 5 ? "✦" : "·"}&nbsp;
                    {combo}× streak
                  </p>
                )}

                <p className="mt-1 text-xs text-slate-500">Knee lift detected</p>
              </>
            ) : (
              <>
                {/* Persistent streak badge when box is idle but combo is active */}
                {combo >= 3 ? (
                  <p className={`mb-1 text-sm font-bold ${
                    combo >= 15 ? "text-orange-400" :
                    combo >= 10 ? "text-yellow-400" :
                    combo >= 5  ? "text-green-400"  :
                                  "text-cyan-400"
                  }`}>
                    {combo >= 15 ? "🔥" : combo >= 10 ? "⚡" : combo >= 5 ? "✦" : "·"}&nbsp;
                    {combo}× streak — keep going!
                  </p>
                ) : null}
                <p className="text-base text-slate-500">March in place</p>
                <p className="mt-1 text-xs text-slate-700">Lift your knees — match left and right height</p>
              </>
            )}
          </div>

          {/* Left / Right breakdown */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/8 bg-white/5 py-3 text-center">
              <p className="text-[10px] uppercase tracking-widest text-slate-600">Left knee</p>
              <p className="mt-0.5 text-3xl font-bold text-cyan-400 tabular-nums">{leftSteps}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/5 py-3 text-center">
              <p className="text-[10px] uppercase tracking-widest text-slate-600">Right knee</p>
              <p className="mt-0.5 text-3xl font-bold text-blue-400 tabular-nums">{rightSteps}</p>
            </div>
          </div>

          {/* Pace hint */}
          {stepsPerMin > 0 && (
            <p className="text-center text-xs text-slate-700">
              Pace: <span className="text-slate-500">{stepsPerMin} reps / min</span>
            </p>
          )}

          {/* End early */}
          <button
            onClick={endSession}
            className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-slate-500 transition-all hover:bg-white/10 hover:text-slate-300"
          >
            End Session Early
          </button>
        </div>
      )}

      {/* ── DONE ──────────────────────────────────────────────────────── */}
      {phase === "done" && (
        <div className="flex w-full max-w-sm flex-col items-center gap-8">

          {/* Header */}
          <div className="text-center">
            <div className="mb-2 text-5xl">{totalSteps > 0 ? "🏆" : "📷"}</div>
            <h1 className="text-3xl font-bold text-white">Session Complete</h1>
            <p className="mt-1 text-sm text-slate-500">
              {SESSION_DURATION}s · Camera · Real Movement
            </p>
          </div>

          {/* No-movement warning */}
          {totalSteps === 0 ? (
            <div className="w-full rounded-2xl border border-yellow-400/30 bg-yellow-400/8 px-5 py-5 text-center">
              <p className="text-sm font-semibold text-yellow-300">No movement detected</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Make sure your full body is visible in the camera panel
                and that the knee bars cross the threshold line when you lift.
              </p>
            </div>
          ) : (
            <>
              <div className="grid w-full grid-cols-2 gap-4">
                <ResultCard label="Activity Score" value={score.toLocaleString()}   unit="pts"      />
                <ResultCard label="Repetitions"    value={String(totalSteps)}       unit="reps"     />
                <ResultCard label="Left Knee"      value={String(leftSteps)}        unit="reps"     />
                <ResultCard label="Right Knee"     value={String(rightSteps)}       unit="reps"     />
                <ResultCard label="Best Streak"    value={String(bestCombo)}        unit="× streak" />
                <ResultCard label="Symmetry"       value={`${symmetryPct}`}         unit="%"        />
              </div>
              <p className="text-center text-xs text-slate-600">
                Avg pace:{" "}
                <span className="text-slate-500">
                  {Math.round(totalSteps / (SESSION_DURATION / 60))} reps / min
                </span>
              </p>
            </>
          )}

          {/* ── Target achievement — shown after save ──────────────── */}
          {savedRecord?.targetAchievements && savedRecord.targetAchievements.length > 0 && totalSteps > 0 && (
            <div className="w-full rounded-2xl border border-white/8 bg-white/3 p-4">
              <p className="mb-3 text-[10px] font-medium uppercase tracking-widest text-slate-600">
                Session Targets · {activePlanRef.current?.exerciseName ?? "Exercise"}
              </p>
              <div className="space-y-2">
                {savedRecord.targetAchievements.map((a, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-base leading-none ${a.achieved ? "text-green-400" : "text-slate-600"}`}>
                        {a.achieved ? "✓" : "○"}
                      </span>
                      <span className={`text-xs ${a.achieved ? "text-green-300" : "text-slate-500"}`}>
                        {a.label}
                      </span>
                    </div>
                    <span className={`tabular-nums text-xs font-semibold ${a.achieved ? "text-green-300" : "text-slate-400"}`}>
                      {a.actualValue >= 0 ? a.actualValue : "—"}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[9px] leading-relaxed text-slate-700">
                Decision-support only · Not a clinical assessment
              </p>
            </div>
          )}

          {/* ── Target preview — shown before save ─────────────────── */}
          {!savedRecord && activePlan && totalSteps > 0 && (
            <div className="w-full rounded-2xl border border-white/8 bg-white/3 p-4">
              <p className="mb-2.5 text-[10px] font-medium uppercase tracking-widest text-slate-600">
                Session Targets · {activePlan.exerciseName}
              </p>
              <div className="space-y-2">
                {activePlan.targets.map((t, i) => {
                  const live =
                    t.metric === "totalSteps"  ? totalSteps  :
                    t.metric === "symmetryPct" ? symmetryPct :
                    t.metric === "stepsPerMin" ? stepsPerMin : null;
                  const met = live !== null && (
                    t.operator === ">=" ? live >= t.threshold :
                    t.operator === "<=" ? live <= t.threshold :
                    live >= t.threshold && live <= (t.thresholdMax ?? Infinity)
                  );
                  return (
                    <div key={i} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-base leading-none ${met ? "text-green-400" : "text-slate-600"}`}>
                          {met ? "✓" : "○"}
                        </span>
                        <span className={`text-xs ${met ? "text-green-300" : "text-slate-500"}`}>
                          {t.label}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-600">
                        {live !== null ? live : t.isLiveTrackable ? "—" : "post-session"}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2.5 text-[9px] text-slate-700">Save to see your full target evaluation</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <button
              onClick={() => { resetState(); setPhase("ready"); }}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all duration-200 hover:scale-105 active:scale-95"
            >
              ▶&nbsp; New Session
            </button>
            <Link
              href="/sessions"
              className="inline-flex items-center rounded-2xl border border-white/10 bg-white/5 px-8 py-3.5 text-sm font-medium text-slate-300 backdrop-blur-md transition-all hover:bg-white/10"
            >
              ← Sessions
            </Link>
          </div>

          {/* ── Save to Progress ─────────────────────────────────────── */}
          {!savedRecord ? (
            <div className="w-full rounded-2xl border border-white/8 bg-white/3 p-4">
              <p className="mb-3 text-[10px] font-medium uppercase tracking-widest text-slate-600">
                Save to Program Report
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  placeholder="Patient ID (e.g. PT-001)"
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-700 outline-none focus:border-cyan-400/30 transition-colors"
                />
                <button
                  onClick={handleSaveSession}
                  disabled={totalSteps === 0}
                  className="rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Save
                </button>
              </div>
              {totalSteps === 0 && (
                <p className="mt-1.5 text-[10px] text-slate-700">
                  Complete at least one step to save a session.
                </p>
              )}
            </div>
          ) : (
            <div className="w-full rounded-2xl border border-green-400/25 bg-green-400/5 p-4 text-center">
              <p className="text-sm font-semibold text-green-400">Session saved ✓</p>
              <p className="mt-0.5 text-xs text-slate-600">
                Linked to <span className="font-medium text-slate-400">{savedRecord.patientId}</span>
              </p>
              <button
                onClick={() => router.push("/results")}
                className="mt-3 text-sm font-medium text-cyan-400 transition-colors hover:text-cyan-300"
              >
                View Program Report →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Sound controls — fixed bottom-left ── */}
      <div className="fixed bottom-4 left-4 z-40 flex items-center gap-2">

        {/* Step-sound toggle */}
        <button
          onClick={sound.toggleMute}
          title={sound.muted ? "Unmute step sounds" : "Mute step sounds"}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#0B1220]/80 text-sm backdrop-blur-md transition-all hover:border-white/20 hover:bg-white/10"
        >
          {sound.muted ? "🔇" : "🔊"}
        </button>

        {/* Music toggle — glows cyan while music is playing */}
        <button
          onClick={bgMusic.toggleMute}
          title={bgMusic.muted ? "Unmute music" : "Mute music"}
          className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium backdrop-blur-md transition-all hover:border-white/20 hover:bg-white/10 ${
            phase === "playing" && !bgMusic.muted
              ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300"
              : "border-white/10 bg-[#0B1220]/80 text-slate-600"
          }`}
        >
          <span className={`text-sm ${bgMusic.muted ? "" : phase === "playing" ? "animate-pulse" : ""}`}>
            {bgMusic.muted ? "🔕" : "🎵"}
          </span>
          <span className="hidden sm:inline">
            {bgMusic.muted ? "Music off" : phase === "playing" ? "Playing" : "Music"}
          </span>
        </button>

      </div>

      {/* ══════════════════════════════════════════════════════════════════
          PoseCamera — fixed bottom-right.
          Hidden during "safety" (camera off before consent) and "done".
          `detecting` is only true during "playing" so steps don't score
          during the countdown or ready screen.
      ══════════════════════════════════════════════════════════════════ */}
      {phase !== "done" && phase !== "safety" && (
        <div className={`fixed bottom-4 right-4 z-40 transition-all duration-500 ${
          phase === "ready" ? "w-72" : "w-52"
        }`}>
          <PoseCamera
            running
            detecting={phase === "playing"}
            onStepDetected={handleStepDetected}
            onPoseReady={setPoseReady}
            onStatusChange={setPoseStatus}
            onKneeRaise={handleKneeRaise}
            onFrameQuality={handleFrameQuality}
            onBodySpan={handleBodySpan}
            exerciseConfig={exerciseConfig}
          />
        </div>
      )}
    </div>
  );
}

/* ── Session-level warning and feedback generators ───────────────────────── */

function computeSessionWarnings(
  totalSteps: number,
  symmetryPct: number,
  fatigueIndex: number,
  cameraVisibilityScore: number,
  bio?: BiomechanicsData,
): string[] {
  const w: string[] = [];
  if (totalSteps === 0)           w.push("No movement detected");
  if (symmetryPct < 75)           w.push("Bilateral symmetry below 75%");
  if (fatigueIndex > 0.5)         w.push("High fatigue index — output declined over session");
  if (cameraVisibilityScore < 50) w.push("Poor camera visibility — consider repositioning");
  if (bio?.postureScore  != null && bio.postureScore  < 70) w.push("Postural stability reduced");
  if (bio?.controlScore  != null && bio.controlScore  < 70) w.push("Step-height consistency reduced");
  if (bio?.romScore      != null && bio.romScore      < 60) w.push("Range of motion below target");
  return w;
}

function computeSessionFeedback(
  totalSteps: number,
  symmetryPct: number,
  bestCombo: number,
  bio?: BiomechanicsData,
): string[] {
  const msgs: string[] = [];
  if (totalSteps >= 60)      msgs.push(`Strong output: ${totalSteps} steps completed`);
  else if (totalSteps >= 30) msgs.push(`Good session: ${totalSteps} steps completed`);
  else if (totalSteps > 0)   msgs.push(`Session complete: ${totalSteps} steps recorded`);
  if (symmetryPct >= 85)     msgs.push(`Excellent bilateral symmetry at ${symmetryPct}%`);
  if (bestCombo >= 10)       msgs.push(`Great rhythm: best streak of ${bestCombo} consecutive steps`);
  if ((bio?.movementQualityScore ?? 0) >= 75)
    msgs.push(`Movement quality score: ${bio!.movementQualityScore}/100`);
  return msgs;
}

/* ── Shared sub-components ── */

function StatCard({ label, value, accent }: { label: string; value: string; accent: "cyan" | "blue" }) {
  const color = accent === "cyan" ? "text-cyan-300" : "text-blue-300";
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-center backdrop-blur-md">
      <p className="text-xs uppercase tracking-widest text-slate-600">{label}</p>
      <p className={`mt-1 text-4xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function ResultCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-center backdrop-blur-md">
      <p className="text-[10px] uppercase tracking-widest text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-[10px] text-slate-700">{unit}</p>
    </div>
  );
}
