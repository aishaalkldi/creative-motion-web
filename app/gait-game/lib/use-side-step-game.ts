"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  COUNTDOWN_FROM,
  CUE_INTERVAL_MS,
  ROUND_SECONDS,
  initialState,
  nextCue,
  applyCorrect,
  applyWrong,
} from "./side-step-logic";
import type { SideCue, SideStepGameState } from "./types";

export function useSideStepGame() {
  const [state, setState] = useState<SideStepGameState>(initialState);
  const cueTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (cueTimerRef.current) {
      clearInterval(cueTimerRef.current);
      cueTimerRef.current = null;
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (feedbackClearRef.current) {
      clearTimeout(feedbackClearRef.current);
      feedbackClearRef.current = null;
    }
  }, []);

  const scheduleFeedbackClear = useCallback(() => {
    if (feedbackClearRef.current) clearTimeout(feedbackClearRef.current);
    feedbackClearRef.current = setTimeout(() => {
      setState((s) => ({ ...s, lastFeedback: null }));
      feedbackClearRef.current = null;
    }, 450);
  }, []);

  const startCueRotation = useCallback(() => {
    if (cueTimerRef.current) clearInterval(cueTimerRef.current);
    setState((s) => ({ ...s, currentCue: nextCue(null) }));
    cueTimerRef.current = setInterval(() => {
      setState((s) => {
        if (s.phase !== "playing") return s;
        return { ...s, currentCue: nextCue(s.currentCue) };
      });
    }, CUE_INTERVAL_MS);
  }, []);

  const startTick = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setState((s) => {
        if (s.phase !== "playing") return s;
        if (s.timeRemaining <= 1) {
          return {
            ...s,
            phase: "complete",
            timeRemaining: 0,
            currentCue: null,
            lastFeedback: null,
          };
        }
        return { ...s, timeRemaining: s.timeRemaining - 1 };
      });
    }, 1000);
  }, []);

  useEffect(() => {
    if (state.phase === "complete" || state.phase === "idle" || state.phase === "paused") {
      if (state.phase !== "paused") clearTimers();
    }
  }, [state.phase, clearTimers]);

  const start = useCallback(() => {
    clearTimers();
    setState({
      ...initialState(),
      phase: "countdown",
      countdown: COUNTDOWN_FROM,
      timeRemaining: ROUND_SECONDS,
    });
  }, [clearTimers]);

  /** Countdown → playing */
  useEffect(() => {
    if (state.phase !== "countdown") return;
    const id = setInterval(() => {
      setState((s) => {
        if (s.phase !== "countdown") return s;
        if (s.countdown <= 1) {
          return {
            ...s,
            phase: "playing",
            countdown: 0,
            currentCue: nextCue(null),
          };
        }
        return { ...s, countdown: s.countdown - 1 };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== "playing") return;
    startCueRotation();
    startTick();
    return () => {
      if (cueTimerRef.current) {
        clearInterval(cueTimerRef.current);
        cueTimerRef.current = null;
      }
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [state.phase, startCueRotation, startTick]);

  useEffect(() => {
    if (state.phase === "complete") clearTimers();
  }, [state.phase, clearTimers]);

  const tap = useCallback(
    (side: SideCue) => {
      setState((s) => {
        if (s.phase !== "playing" || !s.currentCue) return s;
        const ok = side === s.currentCue;
        const next = ok ? applyCorrect(s) : applyWrong(s);
        scheduleFeedbackClear();
        return { ...next, currentCue: nextCue(s.currentCue) };
      });
    },
    [scheduleFeedbackClear]
  );

  const pause = useCallback(() => {
    setState((s) => {
      if (s.phase !== "playing") return s;
      clearTimers();
      return { ...s, phase: "paused" };
    });
  }, [clearTimers]);

  const resume = useCallback(() => {
    setState((s) => {
      if (s.phase !== "paused") return s;
      return { ...s, phase: "playing" };
    });
  }, []);

  const reset = useCallback(() => {
    clearTimers();
    setState(initialState());
  }, [clearTimers]);

  return { state, start, tap, pause, resume, reset };
}
