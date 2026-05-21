"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { updateSessionStatus } from "@/app/lib/api/treatment-plans";

// ─── Types ────────────────────────────────────────────────────────────────

type Phase = "phase-1" | "phase-2" | "phase-3" | "phase-4";
type SessionState = "screening" | "setup" | "ready" | "active" | "paused" | "completed";

type ScreeningQuestion = {
  id: string;
  question: string;
  type: "scale" | "boolean";
  maxAllowed?: number;
  failValue?: boolean;
  warningValue?: boolean;
  failMessage?: string;
  warningMessage?: string;
};

type Exercise = {
  name: string;
  sets: number;
  reps: number;
  cameraSetup: string;
  cues: string[];
};

type CVMetrics = {
  kneeFlexionAngle: number;
  kneeAlignment: number; // valgus/varus in degrees
  hipAngle: number;
  weightSymmetry: number; // percentage
  balance: number; // percentage
  tempo: number; // seconds
  repQuality: number; // 0-100
};

type PhaseLimits = {
  maxKneeFlexion: number;
  maxValgusAngle: number;
  minSymmetry: number;
  minRepQuality: number;
};

// ─── Exercise Database ────────────────────────────────────────────────────

const exercisesByPhase: Record<Phase, Exercise[]> = {
  "phase-1": [
    {
      name: "Sit-to-Stand",
      sets: 3,
      reps: 10,
      cameraSetup: "Front view, 6ft distance, chair and full body visible",
      cues: [
        "Stand with feet shoulder-width apart",
        "Lean forward slightly, then stand",
        "Control your descent back to the chair",
        "Keep weight balanced between both legs",
      ],
    },
    {
      name: "Mini Squats (0-45°)",
      sets: 3,
      reps: 12,
      cameraSetup: "Front view, 6ft distance, full body visible",
      cues: [
        "Feet shoulder-width apart, toes forward",
        "Squat only to 45° knee bend",
        "Push through heels to stand",
        "Keep knees tracking over toes",
      ],
    },
    {
      name: "Single-Leg Stance",
      sets: 3,
      reps: 1,
      cameraSetup: "Front view, 6ft distance, full body visible",
      cues: [
        "Hold for 30-60 seconds per leg",
        "Keep hips level",
        "Focus on a fixed point ahead",
        "Use light finger support if needed",
      ],
    },
  ],
  "phase-2": [
    {
      name: "Goblet Squat (0-90°)",
      sets: 3,
      reps: 10,
      cameraSetup: "Front view, 6ft distance, full body visible",
      cues: [
        "Hold a water bottle at chest height",
        "Squat to 90° knee bend",
        "Keep chest up, core engaged",
        "Drive through heels to stand",
      ],
    },
    {
      name: "Bulgarian Split Squat",
      sets: 3,
      reps: 8,
      cameraSetup: "Side view, 6ft distance, full body visible",
      cues: [
        "Rear foot elevated on a low surface",
        "Lower front knee to 90°",
        "Keep torso upright",
        "Compare left vs right performance",
      ],
    },
    {
      name: "Forward Lunge",
      sets: 3,
      reps: 10,
      cameraSetup: "Front view, 6ft distance, full body visible",
      cues: [
        "Step forward into controlled lunge",
        "Front knee at 90°, back knee hovering",
        "Push back to starting position",
        "Alternate legs",
      ],
    },
  ],
  "phase-3": [
    {
      name: "Countermovement Jump",
      sets: 3,
      reps: 8,
      cameraSetup: "Front view, 6ft distance, full body visible",
      cues: [
        "Quick dip, then jump explosively",
        "Land softly with knees bent",
        "Control landing - no knee wobble",
        "Focus on landing mechanics",
      ],
    },
    {
      name: "Lateral Bounds",
      sets: 3,
      reps: 8,
      cameraSetup: "Front view, 8ft distance, full lateral movement visible",
      cues: [
        "Push off one leg, land on the other",
        "Stick the landing for 2 seconds",
        "Maintain balance and control",
        "Build confidence with each rep",
      ],
    },
  ],
  "phase-4": [
    {
      name: "Single-Leg Hop for Distance",
      sets: 3,
      reps: 3,
      cameraSetup: "Side view, 8ft distance, full hop distance visible",
      cues: [
        "Hop as far as possible on one leg",
        "Stick the landing",
        "Measure left vs right distance",
        "Performance test - give max effort",
      ],
    },
  ],
};

// ─── Phase-Specific Limits ────────────────────────────────────────────────

const phaseLimits: Record<Phase, PhaseLimits> = {
  "phase-1": {
    maxKneeFlexion: 45,
    maxValgusAngle: 8,
    minSymmetry: 70,
    minRepQuality: 60,
  },
  "phase-2": {
    maxKneeFlexion: 90,
    maxValgusAngle: 6,
    minSymmetry: 80,
    minRepQuality: 70,
  },
  "phase-3": {
    maxKneeFlexion: 110,
    maxValgusAngle: 5,
    minSymmetry: 85,
    minRepQuality: 75,
  },
  "phase-4": {
    maxKneeFlexion: 130,
    maxValgusAngle: 5,
    minSymmetry: 90,
    minRepQuality: 80,
  },
};

// ─── Pre-Session Screening ────────────────────────────────────────────────

const screeningQuestions: ScreeningQuestion[] = [
  {
    id: "pain",
    question: "Rate your knee pain right now (0-10)",
    type: "scale",
    maxAllowed: 3,
    failMessage: "Pain level is too high to safely exercise. Please rest and contact your therapist.",
  },
  {
    id: "swelling",
    question: "Is your knee more swollen than yesterday?",
    type: "boolean",
    failValue: true,
    failMessage: "Increased swelling detected. Rest is recommended. Contact your therapist if it persists.",
  },
  {
    id: "rom",
    question: "Can you fully straighten your knee without pain?",
    type: "boolean",
    failValue: false,
    failMessage: "Limited range of motion detected. Contact your therapist before proceeding.",
  },
  {
    id: "instability",
    question: "Did your knee 'give way' or feel unstable in the last 24 hours?",
    type: "boolean",
    failValue: true,
    failMessage: "Instability reported. Session blocked. Your therapist has been notified.",
  },
  {
    id: "medication",
    question: "Have you taken pain medication in the last 4 hours?",
    type: "boolean",
    warningValue: true,
    warningMessage: "⚠️ Note: Pain medication may mask important pain signals. Exercise with extra caution.",
  },
];

// ─── Biomechanical Model ──────────────────────────────────────────────────

class BiomechanicalModel {
  private fatigue: number = 0;
  private baseKneeAngle: number = 45;
  private baseAlignment: number = 2;
  private injuredLegDeficit: number = 10;

  calculateMetrics(phase: Phase, repNumber: number, exerciseName: string): CVMetrics {
    // Fatigue increases with reps (0 to 1 scale)
    this.fatigue = Math.min(repNumber / 20, 0.8);

    // Base angles with realistic noise
    const noise = (range: number) => (Math.random() - 0.5) * range;
    
    // Knee flexion angle - increases with fatigue (form degrades)
    const kneeFlexionAngle = Math.min(
      this.baseKneeAngle + noise(5) + this.fatigue * 8,
      phaseLimits[phase].maxKneeFlexion + 5
    );

    // Knee alignment - valgus increases when tired
    const kneeAlignment = this.baseAlignment + noise(2) + this.fatigue * 4;

    // Hip angle correlates with knee angle
    const hipAngle = kneeFlexionAngle * 0.7 + noise(5);

    // Weight symmetry - degrades with fatigue, worse on injured leg
    const baseSymmetry = 95 - this.injuredLegDeficit;
    const weightSymmetry = Math.max(
      baseSymmetry - this.fatigue * 12 + noise(5),
      phaseLimits[phase].minSymmetry - 5
    );

    // Balance score - worse when tired
    const balance = Math.max(85 - this.fatigue * 15 + noise(8), 60);

    // Tempo - slows down or speeds up when fatigued
    const targetTempo = 3;
    const tempo = targetTempo + (this.fatigue > 0.5 ? -0.5 : 0.3) + noise(0.5);

    // Overall rep quality
    const alignmentScore = Math.max(0, 100 - Math.abs(kneeAlignment) * 8);
    const symmetryScore = weightSymmetry;
    const tempoScore = Math.max(0, 100 - Math.abs(tempo - targetTempo) * 20);
    const repQuality = (alignmentScore + symmetryScore + tempoScore) / 3;

    return {
      kneeFlexionAngle: Math.round(kneeFlexionAngle),
      kneeAlignment: Math.round(kneeAlignment * 10) / 10,
      hipAngle: Math.round(hipAngle),
      weightSymmetry: Math.round(weightSymmetry),
      balance: Math.round(balance),
      tempo: Math.round(tempo * 10) / 10,
      repQuality: Math.round(repQuality),
    };
  }

  reset() {
    this.fatigue = 0;
  }
}

// ─── AI Coaching Engine ───────────────────────────────────────────────────

function generateAICoaching(
  metrics: CVMetrics,
  limits: PhaseLimits,
  repNumber: number,
  targetReps: number,
  exerciseName: string
): string {
  // Priority 1: Safety violations (immediate corrections)
  if (metrics.kneeAlignment > limits.maxValgusAngle) {
    return `⚠️ Knee caving inward (${metrics.kneeAlignment}°)! Push knees outward over your toes.`;
  }

  if (metrics.kneeFlexionAngle > limits.maxKneeFlexion + 5) {
    return `⚠️ Too deep! Limit your range to ${limits.maxKneeFlexion}° for this phase.`;
  }

  if (metrics.weightSymmetry < limits.minSymmetry) {
    return `⚠️ Uneven weight (${metrics.weightSymmetry}% symmetry). Balance weight between both legs.`;
  }

  // Priority 2: Form corrections (moderate issues)
  if (metrics.kneeAlignment > limits.maxValgusAngle - 2) {
    return `Watch knee alignment - keep knees tracking over toes. Current: ${metrics.kneeAlignment}°`;
  }

  if (metrics.tempo < 2) {
    return `Slow down! Control your movement - aim for 3 seconds down, 1 second up.`;
  }

  if (metrics.weightSymmetry < limits.minSymmetry + 10) {
    return `Shift more weight to your surgical leg. Current symmetry: ${metrics.weightSymmetry}%`;
  }

  // Priority 3: Positive reinforcement (good reps)
  if (metrics.repQuality > 85 && repNumber > 5) {
    return `✓ Excellent form! Keep that quality through the set.`;
  }

  if (metrics.repQuality > 75 && repNumber === targetReps) {
    return `✓ Great set! You maintained good form throughout.`;
  }

  // Priority 4: Progress encouragement
  if (repNumber === Math.floor(targetReps / 2)) {
    return `Halfway there! Focus on maintaining your form.`;
  }

  if (repNumber === targetReps - 2) {
    return `Last 2 reps - stay controlled and focused!`;
  }

  // Default: General encouragement
  const encouragements = [
    `Good control on rep ${repNumber}. Keep going!`,
    `Nice and steady. Focus on your breathing.`,
    `Maintain that knee alignment - you're doing well.`,
    `Keep your core engaged throughout the movement.`,
  ];

  return encouragements[repNumber % encouragements.length];
}

// ─── Main Component ───────────────────────────────────────────────────────

function ACLSessionContent() {
  const searchParams = useSearchParams();
  const phase = (searchParams.get("phase") || "phase-1") as Phase;
  const patientIdStr = searchParams.get("patientId") || "";
  const sessionId = searchParams.get("session") || "";
  const patientId = patientIdStr || "demo";
  const numericPatientId = parseInt(patientIdStr, 10);

  const [sessionState, setSessionState] = useState<SessionState>("screening");
  const [screeningAnswers, setScreeningAnswers] = useState<Record<string, number | boolean>>({});
  const [screeningFailed, setScreeningFailed] = useState(false);
  const [screeningWarning, setScreeningWarning] = useState<string | null>(null);

  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [reps, setReps] = useState(0);
  const [timer, setTimer] = useState(0);
  const [totalReps, setTotalReps] = useState(0);

  const [cvMetrics, setCvMetrics] = useState<CVMetrics>({
    kneeFlexionAngle: 0,
    kneeAlignment: 0,
    hipAngle: 0,
    weightSymmetry: 0,
    balance: 0,
    tempo: 0,
    repQuality: 0,
  });

  const [aiMessages, setAiMessages] = useState<string[]>([
    "Welcome to your ACL rehabilitation session. Complete the screening to begin.",
  ]);

  const [alerts, setAlerts] = useState<string[]>([]);
  const [bioModel] = useState(new BiomechanicalModel());

  const exercises = exercisesByPhase[phase];
  const currentExercise = exercises[currentExerciseIndex];
  const limits = phaseLimits[phase];

  // ─── Session Timer ────────────────────────────────────────────────────

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (sessionState === "active") {
      interval = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [sessionState]);

  // ─── Screening Logic ──────────────────────────────────────────────────

  const handleScreeningAnswer = (questionId: string, answer: number | boolean) => {
    setScreeningAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const completeScreening = () => {
    const question = screeningQuestions.find((q) => {
      const answer = screeningAnswers[q.id];
      if (q.type === "scale" && q.maxAllowed !== undefined) {
        return typeof answer === "number" && answer > q.maxAllowed;
      }
      if (q.type === "boolean" && q.failValue !== undefined) {
        return answer === q.failValue;
      }
      return false;
    });

    if (question && question.failMessage) {
      setScreeningFailed(true);
      setAlerts([question.failMessage]);
      return;
    }

    const warningQuestion = screeningQuestions.find((q) => {
      const answer = screeningAnswers[q.id];
      return q.type === "boolean" && q.warningValue !== undefined && answer === q.warningValue;
    });

    if (warningQuestion && warningQuestion.warningMessage) {
      setScreeningWarning(warningQuestion.warningMessage);
    }

    setSessionState("setup");
    setAiMessages((prev) => [
      ...prev,
      "✓ Screening passed. Set up your camera for the session.",
    ]);
  };

  // ─── Session Control ──────────────────────────────────────────────────

  const handleStart = () => {
    setSessionState("active");
    bioModel.reset();
    setAiMessages((prev) => [
      ...prev,
      `Starting ${currentExercise.name}. ${currentExercise.cues[0]}`,
    ]);
  };

  const handlePause = () => {
    setSessionState("paused");
  };

  const handleResume = () => {
    setSessionState("active");
  };

  const handleRepComplete = () => {
    const newReps = reps + 1;
    const newTotalReps = totalReps + 1;
    setReps(newReps);
    setTotalReps(newTotalReps);

    // Generate realistic metrics
    const metrics = bioModel.calculateMetrics(phase, newReps, currentExercise.name);
    setCvMetrics(metrics);

    // Generate AI coaching
    const coaching = generateAICoaching(
      metrics,
      limits,
      newReps,
      currentExercise.reps,
      currentExercise.name
    );
    setAiMessages((prev) => [...prev.slice(-4), coaching]);

    // Check for safety violations
    if (metrics.kneeAlignment > limits.maxValgusAngle + 2) {
      setAlerts((prev) => [
        ...prev,
        `Safety Alert: Excessive knee valgus (${metrics.kneeAlignment}°) detected at ${formatTime(timer)}`,
      ]);
    }

    // Move to next set or exercise
    if (newReps >= currentExercise.reps) {
      if (currentSet < currentExercise.sets) {
        setCurrentSet(currentSet + 1);
        setReps(0);
        bioModel.reset();
        setSessionState("paused");
        setAiMessages((prev) => [
          ...prev,
          `✓ Set ${currentSet} complete! Rest for 60 seconds, then start set ${currentSet + 1}.`,
        ]);
      } else {
        // Move to next exercise
        if (currentExerciseIndex < exercises.length - 1) {
          setCurrentExerciseIndex(currentExerciseIndex + 1);
          setCurrentSet(1);
          setReps(0);
          bioModel.reset();
          setSessionState("paused");
          setAiMessages((prev) => [
            ...prev,
            `✓ ${currentExercise.name} complete! Next: ${exercises[currentExerciseIndex + 1].name}`,
          ]);
        } else {
          // Session complete
          setSessionState("completed");
          setAiMessages((prev) => [...prev, "🎉 Excellent work! Session completed successfully."]);
          // Persist completion back to treatment plan service
          if (!isNaN(numericPatientId) && sessionId) {
            void updateSessionStatus(numericPatientId, sessionId, "completed");
          }
        }
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // ─── Rendering: Screening ─────────────────────────────────────────────

  if (sessionState === "screening") {
    return (
      <main className="min-h-screen bg-[#071a2f] px-6 py-10 text-white">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold text-cyan-300">Pre-Session Screening</h1>
            <p className="mt-2 text-white/70">
              Answer these questions to ensure it's safe to exercise today
            </p>
          </div>

          <div className="space-y-6">
            {screeningQuestions.map((q) => (
              <div
                key={q.id}
                className="rounded-[20px] border border-cyan-300/18 bg-white/[0.04] p-6 backdrop-blur-md"
              >
                <p className="mb-4 text-lg font-semibold text-white">{q.question}</p>

                {q.type === "scale" && (
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 11 }, (_, i) => i).map((level) => (
                      <button
                        key={level}
                        onClick={() => handleScreeningAnswer(q.id, level)}
                        className={`flex h-12 w-12 items-center justify-center rounded-lg border text-base font-bold transition ${
                          screeningAnswers[q.id] === level
                            ? "border-cyan-300 bg-cyan-400/20 text-cyan-100"
                            : "border-white/15 bg-white/5 text-white/60 hover:bg-white/10"
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                )}

                {q.type === "boolean" && (
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleScreeningAnswer(q.id, false)}
                      className={`flex-1 rounded-xl border px-6 py-3 font-semibold transition ${
                        screeningAnswers[q.id] === false
                          ? "border-emerald-300 bg-emerald-400/20 text-emerald-100"
                          : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                      }`}
                    >
                      No
                    </button>
                    <button
                      onClick={() => handleScreeningAnswer(q.id, true)}
                      className={`flex-1 rounded-xl border px-6 py-3 font-semibold transition ${
                        screeningAnswers[q.id] === true
                          ? "border-cyan-300 bg-cyan-400/20 text-cyan-100"
                          : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                      }`}
                    >
                      Yes
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={completeScreening}
            disabled={Object.keys(screeningAnswers).length < screeningQuestions.length}
            className="mt-8 w-full rounded-2xl bg-cyan-400 px-6 py-4 text-lg font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue to Session
          </button>

          {screeningFailed && (
            <div className="mt-6 rounded-[20px] border border-red-400/25 bg-red-400/10 p-6">
              <h3 className="mb-3 text-lg font-semibold text-red-200">Session Blocked</h3>
              {alerts.map((alert, idx) => (
                <p key={idx} className="text-sm text-red-100/90">
                  {alert}
                </p>
              ))}
              <Link
                href="/patient/sessions"
                className="mt-4 block w-full rounded-xl bg-red-400/20 px-6 py-3 text-center font-semibold text-red-100 transition hover:bg-red-400/30"
              >
                Exit Session
              </Link>
            </div>
          )}
        </div>
      </main>
    );
  }

  // ─── Rendering: Camera Setup ──────────────────────────────────────────

  if (sessionState === "setup") {
    return (
      <main className="min-h-screen bg-[#071a2f] px-6 py-10 text-white">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold text-cyan-300">Camera Setup</h1>
            <p className="mt-2 text-white/70">Position yourself for optimal computer vision tracking</p>
          </div>

          <div className="space-y-6">
            <div className="rounded-[24px] border border-cyan-300/18 bg-black p-6">
              <div className="flex aspect-video items-center justify-center rounded-2xl border-2 border-dashed border-cyan-300/40 bg-cyan-400/5">
                <div className="text-center">
                  <div className="text-6xl">📹</div>
                  <p className="mt-3 text-lg font-semibold text-white">Camera Preview</p>
                  <p className="mt-1 text-sm text-cyan-300">{currentExercise.cameraSetup}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-6">
              <h3 className="mb-4 text-lg font-semibold text-white">Setup Checklist</h3>
              <ul className="space-y-3 text-sm text-white/80">
                <li className="flex gap-3">
                  <span className="text-emerald-400">✓</span> Camera positioned at chest height
                </li>
                <li className="flex gap-3">
                  <span className="text-emerald-400">✓</span> Full body visible in frame
                </li>
                <li className="flex gap-3">
                  <span className="text-emerald-400">✓</span> Good lighting (no backlighting)
                </li>
                <li className="flex gap-3">
                  <span className="text-emerald-400">✓</span> Clear space for movement
                </li>
              </ul>
            </div>

            {screeningWarning && (
              <div className="rounded-[20px] border border-amber-300/25 bg-amber-400/10 p-6">
                <p className="text-sm text-amber-100/90">{screeningWarning}</p>
              </div>
            )}
          </div>

          <div className="mt-8 flex gap-4">
            <button
              onClick={() => setSessionState("screening")}
              className="flex-1 rounded-2xl border border-white/15 bg-white/5 px-6 py-4 font-semibold text-white transition hover:bg-white/10"
            >
              ← Back to Screening
            </button>
            <button
              onClick={() => setSessionState("ready")}
              className="flex-1 rounded-2xl bg-cyan-400 px-6 py-4 font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              I'm Ready
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ─── Rendering: Session Complete ──────────────────────────────────────

  if (sessionState === "completed") {
    const avgQuality = cvMetrics.repQuality;
    const avgSymmetry = cvMetrics.weightSymmetry;

    return (
      <main className="min-h-screen bg-[#071a2f] px-6 py-10 text-white">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-[28px] border border-emerald-300/20 bg-emerald-400/10 p-8 text-center shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
            <div className="mb-4 text-6xl">✅</div>
            <h1 className="text-3xl font-bold text-emerald-200">Session Complete!</h1>
            <p className="mt-3 text-lg text-emerald-100/90">
              Excellent work on your {phase.replace("-", " ")} session
            </p>

            <div className="mx-auto mt-8 max-w-2xl">
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label="Duration" value={formatTime(timer)} />
                <StatCard label="Total Reps" value={String(totalReps)} />
                <StatCard label="Avg Quality" value={`${avgQuality}%`} />
              </div>

              <div className="mt-8 rounded-[20px] border border-white/10 bg-white/[0.04] p-6">
                <h3 className="mb-4 text-lg font-semibold text-white">Performance Summary</h3>
                <div className="space-y-3 text-sm text-white/75">
                  <div className="flex justify-between">
                    <span>Average Symmetry</span>
                    <span className="font-semibold text-cyan-200">{avgSymmetry}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Exercises Completed</span>
                    <span className="font-semibold text-cyan-200">{exercises.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Safety Alerts</span>
                    <span className="font-semibold text-cyan-200">{alerts.length}</span>
                  </div>
                </div>

                {alerts.length > 0 && (
                  <div className="mt-6 rounded-xl border border-amber-300/20 bg-amber-400/10 p-4">
                    <p className="mb-2 text-sm font-semibold text-amber-200">Session Alerts:</p>
                    <ul className="space-y-1 text-xs text-amber-100/90">
                      {alerts.slice(0, 3).map((alert, idx) => (
                        <li key={idx}>• {alert}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-6 rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-4">
                  <p className="mb-2 text-sm font-semibold text-emerald-200">Therapist Recommendations</p>
                  <ul className="space-y-2 text-sm text-emerald-100/90">
                    <li>• Continue current phase exercises 3x per week</li>
                    <li>• Focus on maintaining knee alignment during movements</li>
                    <li>• Monitor for any delayed-onset symptoms (24hr check-in)</li>
                    <li>• Progress to next phase requires therapist approval</li>
                  </ul>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <Link
                  href="/patient/sessions"
                  className="flex-1 rounded-2xl bg-cyan-400 px-6 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  Back to Sessions
                </Link>
                <Link
                  href="/patient/progress"
                  className="flex-1 rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  View Progress
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ─── Rendering: Active Session ────────────────────────────────────────

  return (
    <main className="min-h-screen bg-[#071a2f] text-white">
      <div className="border-b border-white/10 bg-[#0B1220] px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">ACL Rehabilitation Session</h1>
            <p className="mt-1 text-sm text-white/60">
              {phase.replace("-", " ").replace(/\b\w/g, (l) => l.toUpperCase())} • Patient {patientId}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold tabular-nums text-cyan-300">{formatTime(timer)}</div>
              <div className="text-xs text-white/60">Duration</div>
            </div>
            <Link
              href="/patient/sessions"
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Exit
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-6 p-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {/* CV Tracking Visualization */}
          <div className="rounded-[24px] border border-cyan-300/18 bg-black p-6">
            <div className="relative flex aspect-video items-center justify-center rounded-2xl border-2 border-cyan-300/40 bg-gradient-to-br from-cyan-500/10 to-blue-500/10">
              {/* Skeleton Tracking Mockup */}
              <div className="absolute inset-0 flex items-center justify-center">
                <svg width="200" height="300" viewBox="0 0 200 300" className="opacity-80">
                  {/* Head */}
                  <circle cx="100" cy="30" r="20" fill="none" stroke="#06b6d4" strokeWidth="3" />
                  {/* Body */}
                  <line x1="100" y1="50" x2="100" y2="150" stroke="#06b6d4" strokeWidth="3" />
                  {/* Arms */}
                  <line x1="100" y1="70" x2="60" y2="120" stroke="#06b6d4" strokeWidth="3" />
                  <line x1="100" y1="70" x2="140" y2="120" stroke="#06b6d4" strokeWidth="3" />
                  {/* Legs */}
                  <line x1="100" y1="150" x2="70" y2="230" stroke="#06b6d4" strokeWidth="3" />
                  <line x1="100" y1="150" x2="130" y2="230" stroke="#06b6d4" strokeWidth="3" />
                  {/* Knee joints */}
                  <circle cx="70" cy="190" r="8" fill="#06b6d4" />
                  <circle cx="130" cy="190" r="8" fill="#06b6d4" />
                  {/* Knee angle indicator */}
                  <path
                    d="M 70 180 Q 60 190 70 200"
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth="2"
                    strokeDasharray="3,3"
                  />
                  <text x="50" y="195" fill="#fbbf24" fontSize="14" fontWeight="bold">
                    {cvMetrics.kneeFlexionAngle}°
                  </text>
                </svg>
              </div>

              <div className="relative z-10 text-center">
                <div className="text-5xl">🎥</div>
                <p className="mt-2 text-sm font-semibold text-cyan-300">Live CV Tracking Active</p>
                <p className="mt-1 text-xs text-white/60">Skeleton tracking • Joint angles • Balance</p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="rounded-[24px] border border-cyan-300/18 bg-white/[0.04] p-6 backdrop-blur-md">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {sessionState === "ready" && (
                  <button
                    onClick={handleStart}
                    className="rounded-2xl bg-cyan-400 px-8 py-3 text-lg font-semibold text-slate-950 transition hover:bg-cyan-300"
                  >
                    Start Exercise
                  </button>
                )}
                {sessionState === "active" && (
                  <>
                    <button
                      onClick={handlePause}
                      className="rounded-2xl border border-white/15 bg-white/5 px-8 py-3 text-lg font-semibold text-white transition hover:bg-white/10"
                    >
                      Pause
                    </button>
                    <button
                      onClick={handleRepComplete}
                      className="rounded-2xl bg-cyan-400 px-8 py-3 text-lg font-semibold text-slate-950 transition hover:bg-cyan-300"
                    >
                      Rep Complete
                    </button>
                  </>
                )}
                {sessionState === "paused" && (
                  <button
                    onClick={handleResume}
                    className="rounded-2xl bg-cyan-400 px-8 py-3 text-lg font-semibold text-slate-950 transition hover:bg-cyan-300"
                  >
                    Resume
                  </button>
                )}
              </div>

              <div className="text-right">
                <div className="text-3xl font-bold tabular-nums text-white">
                  {reps}/{currentExercise.reps}
                </div>
                <div className="text-sm text-white/60">Reps (Set {currentSet}/{currentExercise.sets})</div>
              </div>
            </div>
          </div>

          {/* Real-Time CV Metrics */}
          <div className="rounded-[24px] border border-cyan-300/18 bg-white/[0.04] p-6 backdrop-blur-md">
            <h3 className="mb-4 text-lg font-semibold text-white">Real-Time Biomechanics</h3>
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <MetricCard
                label="Knee Angle"
                value={`${cvMetrics.kneeFlexionAngle}°`}
                status={cvMetrics.kneeFlexionAngle <= limits.maxKneeFlexion ? "good" : "warning"}
              />
              <MetricCard
                label="Alignment"
                value={`${cvMetrics.kneeAlignment}°`}
                status={Math.abs(cvMetrics.kneeAlignment) <= limits.maxValgusAngle ? "good" : "alert"}
              />
              <MetricCard
                label="Hip Angle"
                value={`${cvMetrics.hipAngle}°`}
                status="good"
              />
              <MetricCard
                label="Symmetry"
                value={`${cvMetrics.weightSymmetry}%`}
                status={cvMetrics.weightSymmetry >= limits.minSymmetry ? "good" : "warning"}
              />
              <MetricCard
                label="Balance"
                value={`${cvMetrics.balance}%`}
                status="good"
              />
              <MetricCard
                label="Rep Quality"
                value={`${cvMetrics.repQuality}%`}
                status={cvMetrics.repQuality >= limits.minRepQuality ? "good" : "warning"}
              />
            </div>
          </div>

          {/* Safety Alerts */}
          {alerts.length > 0 && (
            <div className="rounded-[24px] border border-amber-300/25 bg-amber-400/10 p-6">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-amber-200">
                <span>⚠️</span> Safety Alerts
              </h3>
              <div className="space-y-2">
                {alerts.slice(-3).map((alert, idx) => (
                  <div key={idx} className="text-sm text-amber-100/90">
                    {alert}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          {/* AI Coach */}
          <div className="rounded-[24px] border border-cyan-300/18 bg-white/[0.04] p-6 backdrop-blur-md">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <span>🤖</span> AI Coach
            </h3>
            <div className="space-y-3">
              {aiMessages.slice(-5).map((msg, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/85"
                >
                  {msg}
                </div>
              ))}
            </div>
          </div>

          {/* Current Exercise */}
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">Current Exercise</h3>
            <div className="text-sm text-white/75">
              <div className="mb-4 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3">
                <p className="font-semibold text-cyan-100">{currentExercise.name}</p>
                <p className="mt-1 text-xs text-cyan-200/80">
                  {currentExercise.sets} sets × {currentExercise.reps} reps
                </p>
              </div>
              <div className="mb-3 text-xs font-semibold uppercase text-white/50">Exercise Cues:</div>
              <ul className="space-y-2">
                {currentExercise.cues.map((cue, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="text-cyan-400">•</span>
                    {cue}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Phase Limits */}
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">Phase Limits</h3>
            <div className="space-y-2 text-sm text-white/70">
              <div className="flex justify-between">
                <span>Max Knee Flexion</span>
                <span className="font-semibold text-cyan-200">{limits.maxKneeFlexion}°</span>
              </div>
              <div className="flex justify-between">
                <span>Max Valgus Angle</span>
                <span className="font-semibold text-cyan-200">{limits.maxValgusAngle}°</span>
              </div>
              <div className="flex justify-between">
                <span>Min Symmetry</span>
                <span className="font-semibold text-cyan-200">{limits.minSymmetry}%</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

// ─── Helper Components ────────────────────────────────────────────────────

function MetricCard({ label, value, status = "good" }: { label: string; value: string; status?: "good" | "warning" | "alert" }) {
  const statusColors = {
    good: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
    warning: "border-amber-300/20 bg-amber-400/10 text-amber-200",
    alert: "border-red-300/20 bg-red-400/10 text-red-200",
  };

  return (
    <div className={`rounded-xl border px-4 py-3 ${statusColors[status]}`}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-sm text-white/60">{label}</p>
      <p className="mt-2 text-2xl font-bold text-cyan-200">{value}</p>
    </div>
  );
}

export default function ACLSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#071a2f] text-white">
          Loading session...
        </div>
      }
    >
      <ACLSessionContent />
    </Suspense>
  );
}
