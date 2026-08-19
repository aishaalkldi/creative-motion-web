"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import MockCameraCapture from "@/app/components/patient/MockCameraCapture";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

const MOCK_ASSESSMENTS = [
  {
    id: "sit-to-stand",
    title: "Sit-to-Stand",
    description: "Stand up from a chair 5 times at your own pace",
    instructions: [
      "Sit in a sturdy chair with your back against the chair",
      "Your feet should be flat on the ground about shoulder-width apart",
      "Cross your arms over your chest",
      "Stand up and sit down as quickly as possible for 5 repetitions",
      "The timer will start when you stand for the first time",
    ],
    icon: "🪑",
    difficulty: "Easy",
    // Mock scores that will be shown in the report
    scoreLabel: "Reps Completed",
    scoreValue: 5,
    scoreMax: 5,
    scoreUnit: "reps",
    benchmark: "5 reps (normal)",
    status: "Normal",
    tip: "You completed all 5 repetitions. Keep practising to improve your speed.",
  },
  {
    id: "single-leg-stance",
    title: "Single-Leg Stance",
    description: "Stand on one leg for as long as you can",
    instructions: [
      "Stand on one leg while keeping the other leg raised",
      "You can hold onto something for balance if needed",
      "Try to maintain this position for up to 30 seconds",
      "If you need to put your foot down, that marks the end of the test",
      "We'll test both legs",
    ],
    icon: "🧍",
    difficulty: "Medium",
    scoreLabel: "Balance Duration",
    scoreValue: 18,
    scoreMax: 30,
    scoreUnit: "sec",
    benchmark: "≥ 20 sec (normal)",
    status: "Below Normal",
    tip: "Balance duration is slightly below the target. Daily balance exercises will help improve this.",
  },
  {
    id: "functional-reach",
    title: "Functional Reach",
    description: "Reach forward as far as you can without losing your balance",
    instructions: [
      "Stand with your feet shoulder-width apart",
      "Extend your dominant arm to shoulder height",
      "Reach forward as far as you can without stepping forward",
      "We'll measure the distance you reached",
      "Try this 3 times and we'll take the best result",
    ],
    icon: "🙌",
    difficulty: "Medium",
    scoreLabel: "Reach Distance",
    scoreValue: 28,
    scoreMax: 35,
    scoreUnit: "cm",
    benchmark: "≥ 25 cm (normal)",
    status: "Normal",
    tip: "Good reach distance. Core strengthening exercises can help you reach even further.",
  },
  {
    id: "timed-up-and-go",
    title: "Timed Up and Go",
    description: "Stand up, walk 10 feet, and sit back down",
    instructions: [
      "Start in a seated position in a sturdy chair",
      "When ready, stand up and walk 10 feet at a normal pace",
      "Turn around and walk back to the chair",
      "Sit back down in the chair",
      "We'll time how long this takes you",
    ],
    icon: "🚶",
    difficulty: "Medium",
    scoreLabel: "Completion Time",
    scoreValue: 11,
    scoreMax: 20,
    scoreUnit: "sec",
    benchmark: "< 12 sec (normal)",
    status: "Normal",
    tip: "Excellent time! You are within the normal range for mobility and fall risk.",
  },
];

export default function MockAssessmentPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completed, setCompleted] = useState<boolean[]>([false, false, false, false]);
  const [restTimeRemaining, setRestTimeRemaining] = useState(0);
  const [restDone, setRestDone] = useState(false);

  // Check if we should show rest page (after 2 assessments)
  const completedCount = completed.filter((c) => c).length;
  const showRestPage = completedCount === 2 && !restDone;

  // Initialize rest timer when entering rest page
  useEffect(() => {
    if (showRestPage && restTimeRemaining === 0) {
      setRestTimeRemaining(120); // 2 minutes in seconds
    }
  }, [showRestPage]);

  // Rest timer effect
  useEffect(() => {
    if (!showRestPage || restTimeRemaining <= 0) return;

    const timer = setInterval(() => {
      setRestTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showRestPage, restTimeRemaining]);

  // Auto-continue when rest time expires
  useEffect(() => {
    if (showRestPage && restTimeRemaining === 0 && completedCount === 2) {
      const timer = setTimeout(() => {
        setRestDone(true);
        setCurrentIndex(2);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [restTimeRemaining, showRestPage, completedCount]);

  const currentAssessment = MOCK_ASSESSMENTS[currentIndex];
  const progress = Math.round(((currentIndex + (completed[currentIndex] ? 1 : 0)) / MOCK_ASSESSMENTS.length) * 100);

  const handleCompleteAssessment = () => {
    const newCompleted = [...completed];
    newCompleted[currentIndex] = true;
    setCompleted(newCompleted);

    // Check if this is the 2nd completed assessment
    if (newCompleted.filter((c) => c).length === 2) {
      // Don't auto-advance, show rest page instead
      return;
    }

    if (currentIndex < MOCK_ASSESSMENTS.length - 1) {
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
      }, 500);
    }
  };

  const handleContinueAfterRest = () => {
    setRestDone(true);
    setCurrentIndex(2); // Move to 3rd assessment
  };

  const handleNext = () => {
    if (currentIndex < MOCK_ASSESSMENTS.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const allCompleted = completed.every((c) => c);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F4F6F5] to-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#d1dbd6] bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-full bg-[#f0f7f4] p-2 text-[#1D9E75] hover:bg-[#e8f3ef]"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#6b9080]">Mock Assessment</p>
              <h1 className="text-lg font-bold text-[#0f2e22]">Assessment Session</h1>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-[#1D9E75]">{currentIndex + 1} of {MOCK_ASSESSMENTS.length}</p>
            <p className="text-xs text-[#6b9080]">{progress}% complete</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-[#e4ece8]">
          <div
            className="h-full bg-[#1D9E75] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-6 py-12">
        {allCompleted ? (
          /* ── FULL REPORT ── */
          <div className="space-y-8">
            {/* Hero banner */}
            <div className="rounded-[20px] bg-gradient-to-br from-[#1D9E75] to-[#0f6a4e] p-8 text-center text-white shadow-lg">
              <div className="mb-3 text-6xl">🎉</div>
              <h2 className="text-3xl font-bold">Assessment Complete!</h2>
              <p className="mt-2 text-lg opacity-90">Great job! Here is your performance summary.</p>
              <p className="mt-1 text-sm opacity-70">Completed on {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
            </div>

            {/* Charts row */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Radar chart — overall shape */}
              <div className="rounded-[16px] border border-[#d1dbd6] bg-white p-6">
                <h3 className="mb-1 text-base font-bold text-[#0f2e22]">Performance Overview</h3>
                <p className="mb-4 text-xs text-[#6b9080]">Score vs benchmark across all assessments</p>
                <ResponsiveContainer width="100%" height={240}>
                  <RadarChart data={MOCK_ASSESSMENTS.map((a) => ({
                    name: a.title.split(" ")[0], // short label
                    score: Math.round((a.scoreValue / a.scoreMax) * 100),
                    benchmark: 80,
                  }))}>
                    <PolarGrid stroke="#e4ece8" />
                    <PolarAngleAxis dataKey="name" tick={{ fill: "#6b9080", fontSize: 12, fontWeight: 600 }} />
                    <Radar name="Your score" dataKey="score" stroke="#1D9E75" fill="#1D9E75" fillOpacity={0.35} strokeWidth={2} />
                    <Radar name="Benchmark" dataKey="benchmark" stroke="#9db0a3" fill="#9db0a3" fillOpacity={0.15} strokeDasharray="4 2" strokeWidth={1.5} />
                  </RadarChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-6 mt-2">
                  <span className="flex items-center gap-1.5 text-xs text-[#6b9080]"><span className="inline-block h-2 w-4 rounded-full bg-[#1D9E75]" />Your score</span>
                  <span className="flex items-center gap-1.5 text-xs text-[#6b9080]"><span className="inline-block h-2 w-4 rounded-full bg-[#9db0a3]" />Benchmark</span>
                </div>
              </div>

              {/* Bar chart — per-assessment % */}
              <div className="rounded-[16px] border border-[#d1dbd6] bg-white p-6">
                <h3 className="mb-1 text-base font-bold text-[#0f2e22]">Score Breakdown</h3>
                <p className="mb-4 text-xs text-[#6b9080]">Percentage of benchmark reached per test</p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={MOCK_ASSESSMENTS.map((a) => ({
                      name: a.title.split(" ")[0],
                      score: Math.round((a.scoreValue / a.scoreMax) * 100),
                      status: a.status,
                    }))}
                    margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4ece8" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "#6b9080", fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#9db0a3", fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                    <Tooltip
                      formatter={(v) => [`${v}%`, "Score"]}
                      contentStyle={{ borderRadius: 10, border: "1px solid #d1dbd6", fontSize: 13 }}
                    />
                    <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={48}>
                      {MOCK_ASSESSMENTS.map((a, i) => (
                        <Cell key={i} fill={a.status === "Normal" ? "#1D9E75" : "#f59e0b"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-6 mt-2">
                  <span className="flex items-center gap-1.5 text-xs text-[#6b9080]"><span className="inline-block h-2 w-2 rounded-full bg-[#1D9E75]" />Normal</span>
                  <span className="flex items-center gap-1.5 text-xs text-[#6b9080]"><span className="inline-block h-2 w-2 rounded-full bg-amber-400" />Below Normal</span>
                </div>
              </div>
            </div>

            {/* Per-assessment result cards */}
            <div>
              <h3 className="mb-4 text-lg font-bold text-[#0f2e22]">Detailed Results</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {MOCK_ASSESSMENTS.map((a) => {
                  const pct = Math.round((a.scoreValue / a.scoreMax) * 100);
                  const isNormal = a.status === "Normal";
                  return (
                    <div key={a.id} className="rounded-[14px] border border-[#d1dbd6] bg-white p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{a.icon}</span>
                          <div>
                            <p className="font-bold text-[#0f2e22] text-sm">{a.title}</p>
                            <p className="text-xs text-[#6b9080]">{a.scoreLabel}</p>
                          </div>
                        </div>
                        <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${isNormal ? "bg-[#e8f3ef] text-[#1D9E75]" : "bg-amber-50 text-amber-700"}`}>
                          {a.status}
                        </span>
                      </div>

                      {/* Score bar */}
                      <div className="mb-2">
                        <div className="flex justify-between text-xs text-[#6b9080] mb-1">
                          <span>{a.scoreValue} {a.scoreUnit}</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-[#e4ece8]">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: isNormal ? "#1D9E75" : "#f59e0b" }}
                          />
                        </div>
                        <p className="mt-1 text-[10px] text-[#9db0a3]">Benchmark: {a.benchmark}</p>
                      </div>

                      {/* Tip */}
                      <p className="mt-3 text-xs leading-relaxed text-[#6b9080] border-t border-[#e4ece8] pt-3">
                        💡 {a.tip}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Overall summary */}
            <div className="rounded-[16px] border-2 border-[#1D9E75] bg-[#f0f7f4] p-6">
              <h3 className="mb-3 text-base font-bold text-[#0f2e22]">📋 Overall Summary</h3>
              <div className="grid grid-cols-3 divide-x divide-[#d1dbd6] text-center">
                <div className="px-4">
                  <p className="text-3xl font-bold text-[#1D9E75]">4</p>
                  <p className="text-xs text-[#6b9080]">Tests Completed</p>
                </div>
                <div className="px-4">
                  <p className="text-3xl font-bold text-[#1D9E75]">3</p>
                  <p className="text-xs text-[#6b9080]">In Normal Range</p>
                </div>
                <div className="px-4">
                  <p className="text-3xl font-bold text-amber-500">1</p>
                  <p className="text-xs text-[#6b9080]">Needs Attention</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-[#6b9080]">
                This is a mock assessment for demonstration purposes. Results are simulated and do not reflect real clinical measurements. Contact your clinic for an official assessment.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/"
                className="flex-1 rounded-[12px] border-2 border-[#1D9E75] px-6 py-4 text-center font-bold text-[#1D9E75] transition hover:bg-[#f0f7f4]"
              >
                Back to Home
              </Link>
              <button
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-2 rounded-[12px] bg-[#1D9E75] px-6 py-4 font-bold text-white transition hover:bg-[#1a8f6a] active:scale-95"
              >
                🖨️ Print Report
              </button>
            </div>
          </div>
        ) : showRestPage ? (
          /* Rest Page */
          <div className="flex flex-col items-center justify-center rounded-[16px] border-2 border-[#1D9E75] bg-gradient-to-b from-[#f0f7f4] to-[#e8f3ef] p-12 text-center min-h-96">
            <div className="mb-6 text-7xl">😊</div>
            <h2 className="text-4xl font-bold text-[#0f2e22] mb-2">Great Progress!</h2>
            <p className="text-lg text-[#6b9080] mb-8">You've completed 2 assessments. Take a moment to rest.</p>
            
            {/* Rest Timer */}
            <div className="mb-8">
              <div className="text-7xl font-bold text-[#1D9E75] font-mono tracking-wider">
                {formatTime(restTimeRemaining)}
              </div>
              <p className="mt-4 text-sm text-[#6b9080]">Rest time remaining</p>
            </div>

            {/* Rest Guidance */}
            <div className="mb-8 max-w-md rounded-[12px] border border-[#d1dbd6] bg-white p-6">
              <h3 className="font-bold text-[#0f2e22] mb-3">While you rest:</h3>
              <ul className="space-y-2 text-left text-sm text-[#6b9080]">
                <li className="flex gap-2">
                  <span>💧</span>
                  <span>Take a few sips of water</span>
                </li>
                <li className="flex gap-2">
                  <span>🫁</span>
                  <span>Do some deep breathing</span>
                </li>
                <li className="flex gap-2">
                  <span>🧘</span>
                  <span>Stretch gently if comfortable</span>
                </li>
              </ul>
            </div>

            {/* Manual Continue Button (if timer expires) */}
            {restTimeRemaining === 0 && (
              <button
                onClick={handleContinueAfterRest}
                className="rounded-[12px] bg-[#1D9E75] px-8 py-4 font-bold text-white transition hover:bg-[#1a8f6a] active:scale-95"
              >
                Continue to Next Assessment
              </button>
            )}

            {/* Auto-continue message */}
            {restTimeRemaining > 0 && (
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs text-[#6b9080]">You'll automatically continue after the rest period</p>
                {process.env.NODE_ENV === "development" && (
                  <button
                    onClick={handleContinueAfterRest}
                    className="text-xs text-[#9db0a3] underline hover:text-[#1D9E75]"
                  >
                    Skip rest (dev only)
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Assessment Card */
          <div className="space-y-8">
            {/* Camera Feed */}
            <MockCameraCapture isActive={!allCompleted} />

            {/* Assessment Info */}
            <div className="rounded-[16px] border border-[#d1dbd6] bg-white p-8">
              <div className="mb-6 flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="text-5xl">{currentAssessment.icon}</div>
                  <div>
                    <h2 className="text-3xl font-bold text-[#0f2e22]">{currentAssessment.title}</h2>
                    <p className="mt-2 text-lg text-[#6b9080]">{currentAssessment.description}</p>
                    <div className="mt-4 flex items-center gap-2">
                      <span className="rounded-full bg-[#e8f3ef] px-3 py-1 text-xs font-bold uppercase text-[#1D9E75]">
                        {currentAssessment.difficulty}
                      </span>
                    </div>
                  </div>
                </div>
                {completed[currentIndex] && (
                  <div className="rounded-full bg-[#1D9E75] p-3 text-white">
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="mt-8">
                <h3 className="mb-4 text-base font-bold text-[#0f2e22]">How to perform this assessment:</h3>
                <ol className="space-y-3">
                  {currentAssessment.instructions.map((instruction, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#e8f3ef] font-bold text-[#1D9E75]">
                        {i + 1}
                      </span>
                      <span className="text-sm leading-relaxed text-[#6b9080]">{instruction}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Safety Notice */}
            <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-4">
              <div className="flex gap-3">
                <div className="text-lg">⚠️</div>
                <div>
                  <p className="text-sm font-semibold text-amber-900">Safety Notice</p>
                  <p className="mt-1 text-xs text-amber-800">
                    Perform each assessment in a safe environment. Stop immediately if you experience pain, dizziness, or shortness of breath. If performing at home, ensure someone is nearby.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className="flex items-center justify-center gap-2 rounded-[12px] border-2 border-[#d1dbd6] bg-white px-6 py-4 font-bold text-[#6b9080] transition hover:border-[#1D9E75] hover:text-[#1D9E75] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>

              {!completed[currentIndex] ? (
                <button
                  onClick={handleCompleteAssessment}
                  className="flex-1 rounded-[12px] bg-[#1D9E75] px-6 py-4 font-bold text-white transition hover:bg-[#1a8f6a] active:scale-95"
                >
                  Complete Assessment
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  disabled={currentIndex === MOCK_ASSESSMENTS.length - 1}
                  className="flex-1 flex items-center justify-center gap-2 rounded-[12px] bg-[#1D9E75] px-6 py-4 font-bold text-white transition hover:bg-[#1a8f6a] active:scale-95 disabled:bg-[#6b9080]"
                >
                  {currentIndex === MOCK_ASSESSMENTS.length - 1 ? "Assessment Complete" : "Next Assessment"}
                  {currentIndex !== MOCK_ASSESSMENTS.length - 1 && (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Assessment List Sidebar */}
        <div className="mt-12">
          <h3 className="mb-4 text-base font-bold text-[#0f2e22]">Assessment Sequence</h3>
          <div className="grid gap-3">
            {MOCK_ASSESSMENTS.map((assessment, i) => (
              <button
                key={assessment.id}
                onClick={() => setCurrentIndex(i)}
                className={`flex items-center gap-3 rounded-[12px] border-2 p-4 text-left transition ${
                  currentIndex === i
                    ? "border-[#1D9E75] bg-[#f0f7f4]"
                    : completed[i]
                      ? "border-[#1D9E75] bg-white"
                      : "border-[#d1dbd6] bg-white hover:border-[#1D9E75]"
                }`}
              >
                <div className={`text-2xl`}>{assessment.icon}</div>
                <div className="flex-1">
                  <p className="font-bold text-[#0f2e22]">{i + 1}. {assessment.title}</p>
                  <p className="text-xs text-[#6b9080]">{assessment.description}</p>
                </div>
                {completed[i] && (
                  <div className="rounded-full bg-[#1D9E75] p-1">
                    <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
