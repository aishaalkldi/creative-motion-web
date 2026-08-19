"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import MockCameraCapture from "@/app/components/patient/MockCameraCapture";

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
  },
];

export default function MockAssessmentPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completed, setCompleted] = useState<boolean[]>([false, false, false, false]);
  const [restTimeRemaining, setRestTimeRemaining] = useState(0);

  // Check if we should show rest page (after 2 assessments)
  const completedCount = completed.filter((c) => c).length;
  const showRestPage = completedCount === 2 && !completed[2];

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
        setCurrentIndex(2); // Move to 3rd assessment
        setRestTimeRemaining(0);
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
    setRestTimeRemaining(0);
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
          /* Success State */
          <div className="flex flex-col items-center justify-center rounded-[16px] border-2 border-[#1D9E75] bg-[#f0f7f4] p-12 text-center">
            <div className="mb-4 text-6xl">✓</div>
            <h2 className="text-3xl font-bold text-[#0f2e22]">Great job!</h2>
            <p className="mt-3 text-lg text-[#6b9080]">You've completed all 4 assessments.</p>
            <p className="mt-2 text-sm text-[#6b9080]">
              This mock assessment is complete. To perform a real assessment, contact your clinic for a secure assessment link.
            </p>
            <Link
              href="/"
              className="mt-8 inline-block rounded-[12px] bg-[#1D9E75] px-8 py-4 font-bold text-white transition hover:bg-[#1a8f6a] active:scale-95"
            >
              Back to Home
            </Link>
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
              <p className="text-xs text-[#6b9080]">You'll automatically continue after the rest period</p>
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
