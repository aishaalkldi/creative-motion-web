"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useGlobalLanguage } from "@/app/components/GlobalLanguageProvider";

interface MockCameraCaptureProps {
  isActive: boolean;
  assessmentId?: string;
  onLiveCue?: (cue: string) => void;
}

const MEDIAPIPE_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/+esm";
const MEDIAPIPE_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm";
const POSE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";

type TargetPoint = {
  x: number;
  y: number;
};

const COIN_HIT_ANIMATION_MS = 520;
const ACTIVE_COIN_RADIUS = 22;
const IDLE_COIN_RADIUS = 16;
const HIT_COIN_RADIUS = 22;

const FUNCTIONAL_REACH_TARGETS: TargetPoint[] = [
  // Alternating vertical pattern: up -> down -> up -> down -> up
  { x: 0.66, y: 0.30 },
  { x: 0.74, y: 0.68 },
  { x: 0.80, y: 0.30 },
  { x: 0.86, y: 0.68 },
  { x: 0.92, y: 0.30 },
];

const SKELETON_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
  [11, 12],
  [11, 13], [13, 15],
  [12, 14], [14, 16],
  [15, 17], [15, 19], [15, 21],
  [16, 18], [16, 20], [16, 22],
  [11, 23], [12, 24],
  [23, 24],
  [23, 25], [25, 27], [27, 29], [27, 31],
  [24, 26], [26, 28], [28, 30], [28, 32],
];

export default function MockCameraCapture({ isActive, assessmentId, onLiveCue }: MockCameraCaptureProps) {
  const { language } = useGlobalLanguage();
  const isArabic = language === "ar";
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseLandmarkerRef = useRef<unknown>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const targetIndexRef = useRef<number>(0);
  const targetHitFlashUntilRef = useRef<number>(0);
  const targetHitEffectsRef = useRef<Record<number, number>>({});
  const lastTargetHitAtRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastHitSoundAtRef = useRef<number>(0);
  const detectTimestampRef = useRef<number>(0);
  const lastLiveCueRef = useRef<string>("");
  const lastLiveCueAtRef = useRef<number>(0);
  const [cameraPermission, setCameraPermission] = useState<"idle" | "loading" | "granted" | "denied">("idle");
  const [poseLoading, setPoseLoading] = useState(false);
  const [poseReady, setPoseReady] = useState(false);
  const [poseError, setPoseError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [targetIndex, setTargetIndex] = useState(0);
  const [targetSequenceDone, setTargetSequenceDone] = useState(false);
  const [liveCue, setLiveCue] = useState(isArabic ? "اتبع الإرشادات المعروضة على الشاشة." : "Follow the on-screen guidance.");

  const showGuidedTargets = assessmentId === "functional-reach";
  const activeTargets = FUNCTIONAL_REACH_TARGETS;
  const ui = {
    introTargets: isArabic ? "مد يدك إلى العملة المضيئة." : "Reach your hand to the glowing coin.",
    introAssessment: isArabic ? "اتبع تعليمات التقييم على الشاشة." : "Follow the assessment instructions on screen.",
    poseUnavailable: isArabic ? "نظام تتبع الوضعية غير متاح في هذا المتصفح." : "Pose engine unavailable in this browser.",
    poseFailed: isArabic ? "فشل تتبع الوضعية. جرّب Chrome أو Edge." : "Pose tracking failed. Try Chrome/Edge.",
    moveCloser: isArabic ? "اقترب قليلًا من الكاميرا." : "Move closer to the camera.",
    moveBack: isArabic ? "ابتعد قليلًا عن الكاميرا." : "Move a little back from the camera.",
    sitDown: isArabic ? "رائع. اجلس الآن." : "Great. Now sit down.",
    standUp: isArabic ? "جيد. قف الآن." : "Good. Now stand up.",
    keepGoing: isArabic ? "تابع: قف ثم اجلس." : "Keep going: stand up, then sit down.",
    liftFoot: isArabic ? "ارفع قدمًا واحدة وحافظ على توازنك." : "Lift one foot and hold your balance.",
    holdBalance: isArabic ? "ممتاز. واصل الحفاظ على توازنك." : "Excellent. Keep your balance and hold.",
    reachTarget: isArabic ? "مد يدك إلى العملة المضيئة." : "Reach your hand to the glowing coin.",
    holdArmSteady: isArabic ? "ممتاز. حافظ على ثبات ذراعك." : "Excellent reach. Hold your arm steady.",
    walkBack: isArabic ? "جيد. امشِ بضع خطوات للخلف ثم عد واجلس." : "Good. Walk back a few steps, then return and sit.",
    startWalking: isArabic ? "قف الآن وابدأ المشي." : "Stand up now and start walking.",
    keepCentered: isArabic ? "حافظ على تمركز جسمك داخل الكاميرا." : "Keep your full body centered in the camera.",
    bodyVisible: isArabic ? "قف بحيث يظهر جسمك بالكامل في الكاميرا." : "Stand where your full body is visible in camera.",
    raiseHand: isArabic ? "ارفع يدك للعثور على العملة." : "Raise your hand to find the coin.",
    positionBody: isArabic ? "ضع جسمك بحيث نتمكن من اكتشاف وضعيتك." : "Position your body so we can detect your pose.",
    cameraDenied: isArabic ? "تم رفض إذن الكاميرا" : "Camera Permission Denied",
    cameraDeniedHelp: isArabic ? "يرجى تفعيل الوصول إلى الكاميرا من إعدادات المتصفح للمتابعة" : "Please enable camera access in your browser settings to continue",
    startingCamera: isArabic ? "جارٍ تشغيل الكاميرا…" : "Starting camera…",
    allowCamera: isArabic ? "يرجى السماح بالوصول إلى الكاميرا عند الطلب" : "Please allow camera access when prompted",
    loadingAi: isArabic ? "جارٍ تحميل الذكاء الاصطناعي…" : "Loading AI…",
    poseTracking: isArabic ? "تتبّع الوضعية" : "POSE TRACKING",
    poseStarting: isArabic ? "بدء التتبّع" : "POSE STARTING",
    handReachGuide: isArabic ? "دليل الوصول باليد" : "Hand Reach Guide",
    targetsComplete: isArabic ? "اكتملت الأهداف" : "Targets complete",
    reachGlow: isArabic ? "صل إلى العملة المضيئة" : "Reach the glowing coin",
    targetLabel: isArabic ? "عملة" : "Coin",
    excellentReach: isArabic ? "وصول ممتاز" : "Excellent reach",
    defaultCue: isArabic ? "اتبع الإرشادات المعروضة على الشاشة." : "Follow the on-screen guidance.",
  };

  useEffect(() => {
    targetIndexRef.current = targetIndex;
  }, [targetIndex]);

  useEffect(() => {
    setLiveCue(ui.defaultCue);
    lastLiveCueRef.current = ui.defaultCue;
  }, [ui.defaultCue]);

  useEffect(() => {
    setTargetIndex(0);
    targetIndexRef.current = 0;
    setTargetSequenceDone(false);
    targetHitFlashUntilRef.current = 0;
    targetHitEffectsRef.current = {};
    lastTargetHitAtRef.current = 0;
    const introCue = showGuidedTargets ? ui.introTargets : ui.introAssessment;
    setLiveCue(introCue);
    onLiveCue?.(introCue);
    lastLiveCueRef.current = introCue;
    lastLiveCueAtRef.current = performance.now();
  }, [assessmentId, onLiveCue, showGuidedTargets, ui.introAssessment, ui.introTargets]);

  const emitLiveCue = useCallback((cue: string, minIntervalMs = 1600) => {
    const now = performance.now();
    const cueChanged = cue !== lastLiveCueRef.current;
    const intervalReached = now - lastLiveCueAtRef.current > minIntervalMs;
    if (!cueChanged && !intervalReached) return;
    if (cueChanged || intervalReached) {
      lastLiveCueRef.current = cue;
      lastLiveCueAtRef.current = now;
      setLiveCue(cue);
      onLiveCue?.(cue);
    }
  }, [onLiveCue]);

  const playTargetHitSound = useCallback(() => {
    if (typeof window === "undefined") return;
    const now = performance.now();
    if (now - lastHitSoundAtRef.current < 220) return;
    lastHitSoundAtRef.current = now;

    const AudioCtx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (!ctx) return;

      if (ctx.state === "suspended") {
        void ctx.resume();
      }

      const startAt = ctx.currentTime;
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-20, startAt);
      compressor.knee.setValueAtTime(14, startAt);
      compressor.ratio.setValueAtTime(10, startAt);
      compressor.attack.setValueAtTime(0.002, startAt);
      compressor.release.setValueAtTime(0.12, startAt);

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.34, startAt);
      master.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.46);
      master.connect(compressor);
      compressor.connect(ctx.destination);

      const toneBus = ctx.createGain();
      toneBus.gain.setValueAtTime(1, startAt);
      const air = ctx.createBiquadFilter();
      air.type = "highshelf";
      air.frequency.setValueAtTime(2500, startAt);
      air.gain.setValueAtTime(8, startAt);
      toneBus.connect(air);
      air.connect(master);

      const partials = [
        { frequency: 1710, decay: 0.28, gain: 0.2 },
        { frequency: 2620, decay: 0.2, gain: 0.14 },
        { frequency: 4020, decay: 0.14, gain: 0.09 },
      ];

      partials.forEach((partial, index) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = index === 1 ? "triangle" : "sine";
        osc.frequency.setValueAtTime(partial.frequency, startAt);
        osc.frequency.exponentialRampToValueAtTime(partial.frequency * 0.93, startAt + partial.decay);
        g.gain.setValueAtTime(0.0001, startAt);
        g.gain.exponentialRampToValueAtTime(partial.gain, startAt + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0001, startAt + partial.decay);
        osc.connect(g);
        g.connect(toneBus);
        osc.start(startAt);
        osc.stop(startAt + partial.decay + 0.02);
      });

      const noiseDuration = 0.085;
      const frameCount = Math.max(1, Math.floor(ctx.sampleRate * noiseDuration));
      const noiseBuffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      for (let i = 0; i < frameCount; i += 1) {
        noiseData[i] = (Math.random() * 2 - 1) * 0.42;
      }

      const makeImpact = (impactAt: number, level: number) => {
        const source = ctx.createBufferSource();
        source.buffer = noiseBuffer;
        const bandPass = ctx.createBiquadFilter();
        bandPass.type = "bandpass";
        bandPass.frequency.setValueAtTime(3600, impactAt);
        bandPass.Q.setValueAtTime(7.5, impactAt);
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0.0001, impactAt);
        gainNode.gain.exponentialRampToValueAtTime(level, impactAt + 0.004);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, impactAt + noiseDuration);
        source.connect(bandPass);
        bandPass.connect(gainNode);
        gainNode.connect(master);
        source.start(impactAt);
        source.stop(impactAt + noiseDuration);
      };

      makeImpact(startAt, 0.11);
      makeImpact(startAt + 0.05, 0.065);
    } catch {
      // Ignore audio-device errors to keep camera loop stable
    }
  }, []);

  // Start camera
  useEffect(() => {
    if (!isActive) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        setStream(null);
      }
      setCameraPermission("idle");
      return;
    }

    const startCamera = async () => {
      setCameraPermission("loading");
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
          audio: false,
        });
        setStream(mediaStream);
        // videoRef may not be mounted yet; srcObject is set in a separate effect
        setCameraPermission("granted");
      } catch {
        setCameraPermission("denied");
      }
    };

    startCamera();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  // Attach stream to video element as soon as both are ready
  useEffect(() => {
    if (stream && videoRef.current && videoRef.current.srcObject !== stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Load MediaPipe PoseLandmarker
  useEffect(() => {
    if (cameraPermission !== "granted") return;

    let cancelled = false;

    const loadPose = async () => {
      setPoseLoading(true);
      setPoseReady(false);
      try {
        const importModule = new Function("u", "return import(u)") as (u: string) => Promise<unknown>;
        const mod = (await importModule(MEDIAPIPE_CDN)) as {
          FilesetResolver: { forVisionTasks: (base: string) => Promise<unknown> };
          PoseLandmarker: {
            createFromOptions: (
              fileset: unknown,
              options: {
                baseOptions: { modelAssetPath: string; delegate: "GPU" | "CPU" };
                runningMode: string;
                numPoses: number;
                minPoseDetectionConfidence?: number;
                minPosePresenceConfidence?: number;
                minTrackingConfidence?: number;
              }
            ) => Promise<unknown>;
          };
          RunningMode?: { VIDEO: string };
        };

        if (cancelled) return;
        const vision = await mod.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
        if (cancelled) return;
        const runningMode = mod.RunningMode?.VIDEO ?? "VIDEO";

        let landmarker: unknown;
        try {
          landmarker = await mod.PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: POSE_MODEL, delegate: "GPU" },
            runningMode,
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
        } catch {
          landmarker = await mod.PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: POSE_MODEL, delegate: "CPU" },
            runningMode,
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
        }

        if (cancelled) return;
        poseLandmarkerRef.current = landmarker;
        detectTimestampRef.current = 0;
        setPoseReady(true);
        setPoseError(null);
      } catch (e) {
        console.error("Pose model load error:", e);
        poseLandmarkerRef.current = null;
        setPoseReady(false);
        setPoseError(ui.poseUnavailable);
      } finally {
        setPoseLoading(false);
      }
    };

    loadPose();

    return () => {
      cancelled = true;
    };
  }, [cameraPermission]);

  const drawGuidedTargets = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    handPoint: { x: number; y: number } | null
  ) => {
    const currentIndex = Math.min(targetIndexRef.current, activeTargets.length - 1);
    const now = performance.now();
    const drawCoin = (
      x: number,
      y: number,
      radius: number,
      alpha: number,
      pulse: number,
      spinProgress: number | null,
    ) => {
      const spin = spinProgress ?? 0;
      const faceWidth = spinProgress === null ? 1 : Math.max(0.12, Math.abs(Math.cos(spin * Math.PI * 5)));
      const fade = spinProgress === null ? 1 : 1 - spin;
      const rise = spinProgress === null ? 0 : 14 * spin;

      ctx.save();
      ctx.translate(x, y - rise);
      ctx.scale(faceWidth, 1);

      const glowSize = radius * (2.8 + pulse * 0.26);
      const glow = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, glowSize);
      glow.addColorStop(0, `rgba(253, 224, 71, ${0.42 * alpha * fade})`);
      glow.addColorStop(1, "rgba(253, 224, 71, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(35, 22, 8, ${0.34 * alpha * fade})`;
      ctx.beginPath();
      ctx.ellipse(radius * 0.22, radius * 0.28, radius * 0.95, radius * 0.52, 0, 0, Math.PI * 2);
      ctx.fill();

      const coinFill = ctx.createRadialGradient(-radius * 0.32, -radius * 0.38, radius * 0.1, 0, 0, radius);
      coinFill.addColorStop(0, `rgba(255, 252, 210, ${alpha * fade})`);
      coinFill.addColorStop(0.45, `rgba(255, 216, 72, ${alpha * fade})`);
      coinFill.addColorStop(0.75, `rgba(227, 163, 19, ${alpha * fade})`);
      coinFill.addColorStop(1, `rgba(160, 92, 10, ${alpha * fade})`);
      ctx.fillStyle = coinFill;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();

      const rimGradient = ctx.createRadialGradient(0, 0, radius * 0.4, 0, 0, radius);
      rimGradient.addColorStop(0, `rgba(245, 179, 41, ${0.5 * alpha * fade})`);
      rimGradient.addColorStop(1, `rgba(118, 63, 6, ${0.95 * alpha * fade})`);
      ctx.strokeStyle = rimGradient;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, 0, radius - 1, 0, Math.PI * 2);
      ctx.stroke();

      // Coin edge ridges for a more realistic coin look
      const ridgeCount = 28;
      const ridgeLength = radius * 0.14;
      ctx.strokeStyle = `rgba(120, 53, 15, ${0.7 * alpha * fade})`;
      ctx.lineWidth = 1.25;
      for (let i = 0; i < ridgeCount; i += 1) {
        const angle = (i / ridgeCount) * Math.PI * 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const r1 = radius - 0.8;
        const r2 = r1 - ridgeLength;
        ctx.beginPath();
        ctx.moveTo(cos * r1, sin * r1);
        ctx.lineTo(cos * r2, sin * r2);
        ctx.stroke();
      }

      const innerRing = ctx.createRadialGradient(0, 0, radius * 0.15, 0, 0, radius * 0.72);
      innerRing.addColorStop(0, `rgba(255, 246, 186, ${0.9 * alpha * fade})`);
      innerRing.addColorStop(1, `rgba(186, 112, 10, ${0.65 * alpha * fade})`);
      ctx.strokeStyle = innerRing;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.62, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * alpha * fade})`;
      ctx.beginPath();
      ctx.ellipse(-radius * 0.22, -radius * 0.3, radius * 0.22, radius * 0.15, -0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(107, 52, 8, ${0.95 * alpha * fade})`;
      ctx.font = `${Math.max(13, radius * 0.88)}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("◉", 0, 1);
      ctx.restore();
    };

    // Soft path between targets
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 7]);
    ctx.beginPath();
    activeTargets.forEach((p, i) => {
      const x = p.x * width;
      const y = p.y * height;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Draw past/current/future targets
    activeTargets.forEach((point, idx) => {
      const x = point.x * width;
      const y = point.y * height;
      const reached = idx < currentIndex || targetSequenceDone;
      const active = idx === currentIndex && !targetSequenceDone;
      const hitAt = targetHitEffectsRef.current[idx] ?? 0;
      const hitAge = hitAt > 0 ? now - hitAt : Number.POSITIVE_INFINITY;
      const hitProgress = Math.min(1, hitAge / COIN_HIT_ANIMATION_MS);
      const hitAnimating = hitAt > 0 && hitAge < COIN_HIT_ANIMATION_MS;

      if (reached) {
        if (hitAnimating) {
          drawCoin(x, y, HIT_COIN_RADIUS, 1, 0.2, hitProgress);
        }
        return;
      }

      if (active) {
        const pulse = 1 + 0.18 * Math.sin(now / 180);
        ctx.save();
        ctx.strokeStyle = "rgba(254, 240, 138, 0.95)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, (ACTIVE_COIN_RADIUS + 7) * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        drawCoin(x, y, ACTIVE_COIN_RADIUS, 1, pulse, null);

        // decorative sparkle ring
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.75)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 25 * pulse, 0, Math.PI * 2);
        ctx.stroke();

        // hit flash
        if (targetHitFlashUntilRef.current > now) {
          ctx.strokeStyle = "rgba(255,255,255,0.95)";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(x, y, 30 * pulse, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      } else {
        drawCoin(x, y, IDLE_COIN_RADIUS, 0.5, 0, null);
      }
    });

    // Draw hand marker and guidance line
    if (handPoint) {
    const currentTarget = activeTargets[currentIndex];
      const tx = currentTarget.x * width;
      const ty = currentTarget.y * height;
      const dx = handPoint.x - tx;
      const dy = handPoint.y - ty;
      const distance = Math.sqrt(dx * dx + dy * dy);

      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 1.8;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(handPoint.x, handPoint.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = distance < 42 ? "#50ebb6" : "#fbbf24";
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(handPoint.x, handPoint.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      if (!targetSequenceDone && distance < 52 && now - lastTargetHitAtRef.current > 460) {
        lastTargetHitAtRef.current = now;
        targetHitFlashUntilRef.current = now + 220;
        targetHitEffectsRef.current[targetIndexRef.current] = now;
        playTargetHitSound();
        setTargetIndex((prev) => {
          const next = prev + 1;
          targetIndexRef.current = next;
          if (next >= activeTargets.length) {
            setTargetSequenceDone(true);
            return activeTargets.length - 1;
          }
          return next;
        });
      }
    }
  };

  // Draw skeleton on canvas overlay
  const drawSkeleton = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = poseLandmarkerRef.current as any;
    try {
      if (!video || !canvas || video.readyState < 2) {
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Match canvas to actual video dimensions
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (landmarker && video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;
        let results: { landmarks?: Array<Array<{ x: number; y: number; visibility?: number }>> } | null = null;
        try {
          let ts = detectTimestampRef.current;
          const now = performance.now();
          ts = now <= ts ? ts + 0.001 : now;
          detectTimestampRef.current = ts;
          results = landmarker.detectForVideo(video, ts);
        } catch (e) {
          console.error("Pose runtime error:", e);
          poseLandmarkerRef.current = null;
          setPoseReady(false);
          setPoseError(ui.poseFailed);
        }

        if (results?.landmarks?.length) {
          const landmarks = results.landmarks[0];
          const W = canvas.width;
          const H = canvas.height;
          let rightHandPoint: { x: number; y: number } | null = null;
          let leftHandPoint: { x: number; y: number } | null = null;

          ctx.strokeStyle = "#1D9E75";
          ctx.lineWidth = 3;
          ctx.globalAlpha = 0.85;
          for (const [a, b] of SKELETON_CONNECTIONS) {
            const lA = landmarks[a];
            const lB = landmarks[b];
            if (lA && lB && (lA.visibility ?? 1) > 0.4 && (lB.visibility ?? 1) > 0.4) {
              ctx.beginPath();
              ctx.moveTo((1 - lA.x) * W, lA.y * H); // mirror horizontally
              ctx.lineTo((1 - lB.x) * W, lB.y * H);
              ctx.stroke();
            }
          }

          // Draw joint circles
          ctx.globalAlpha = 1;
          for (const lm of landmarks) {
            if ((lm.visibility ?? 1) > 0.4) {
              const x = (1 - lm.x) * W;
              const y = lm.y * H;

              // Outer glow ring
              ctx.strokeStyle = "#ffffff";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(x, y, 8, 0, Math.PI * 2);
              ctx.stroke();

              // Inner filled circle
              ctx.fillStyle = "#1D9E75";
              ctx.beginPath();
              ctx.arc(x, y, 5, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          const rightWrist = landmarks[16];
          if (rightWrist && (rightWrist.visibility ?? 1) > 0.45) {
            rightHandPoint = { x: (1 - rightWrist.x) * W, y: rightWrist.y * H };
          }
          const leftWrist = landmarks[15];
          if (leftWrist && (leftWrist.visibility ?? 1) > 0.45) {
            leftHandPoint = { x: (1 - leftWrist.x) * W, y: leftWrist.y * H };
          }

          const leftShoulder = landmarks[11];
          const rightShoulder = landmarks[12];
          const leftHip = landmarks[23];
          const rightHip = landmarks[24];
          const leftKnee = landmarks[25];
          const rightKnee = landmarks[26];
          const leftAnkle = landmarks[27];
          const rightAnkle = landmarks[28];

          if (leftShoulder && rightShoulder) {
            const shoulderSpan = Math.abs(leftShoulder.x - rightShoulder.x) * W;
            if (shoulderSpan < W * 0.14) {
              emitLiveCue(ui.moveCloser);
            } else if (shoulderSpan > W * 0.42) {
              emitLiveCue(ui.moveBack);
            } else if (assessmentId === "sit-to-stand" && leftHip && rightHip && leftKnee && rightKnee) {
              const hipY = (leftHip.y + rightHip.y) / 2;
              const kneeY = (leftKnee.y + rightKnee.y) / 2;
              const standDelta = kneeY - hipY;
              if (standDelta > 0.2) {
                emitLiveCue(ui.sitDown);
              } else if (standDelta < 0.1) {
                emitLiveCue(ui.standUp);
              } else {
                emitLiveCue(ui.keepGoing);
              }
            } else if (assessmentId === "single-leg-stance" && leftAnkle && rightAnkle) {
              const ankleDiff = Math.abs(leftAnkle.y - rightAnkle.y);
              if (ankleDiff < 0.08) {
                emitLiveCue(ui.liftFoot);
              } else {
                emitLiveCue(ui.holdBalance);
              }
            } else if (assessmentId === "functional-reach") {
              if (targetSequenceDone) {
                emitLiveCue(ui.holdArmSteady);
              } else {
                emitLiveCue(ui.reachTarget);
              }
            } else if (assessmentId === "timed-up-and-go" && leftHip && rightHip && leftKnee && rightKnee) {
              const hipY = (leftHip.y + rightHip.y) / 2;
              const kneeY = (leftKnee.y + rightKnee.y) / 2;
              const standDelta = kneeY - hipY;
              if (standDelta > 0.2) {
                emitLiveCue(ui.walkBack);
              } else {
                emitLiveCue(ui.startWalking);
              }
            } else {
              emitLiveCue(ui.keepCentered);
            }
          }

          if (showGuidedTargets) {
            // use the hand further to the right on screen, fallback to available hand
            const selectedHand =
              rightHandPoint && leftHandPoint
                ? (rightHandPoint.x > leftHandPoint.x ? rightHandPoint : leftHandPoint)
                : (rightHandPoint || leftHandPoint);
            drawGuidedTargets(ctx, W, H, selectedHand || null);
          }

          ctx.globalAlpha = 1;
        } else if (showGuidedTargets) {
          drawGuidedTargets(ctx, canvas.width, canvas.height, null);
          emitLiveCue(ui.raiseHand);
        }
      } else if (showGuidedTargets) {
        drawGuidedTargets(ctx, canvas.width, canvas.height, null);
        emitLiveCue(ui.positionBody);
      } else {
        emitLiveCue(ui.bodyVisible);
      }
    } finally {
      animFrameRef.current = requestAnimationFrame(drawSkeleton);
    }
  }, [activeTargets, assessmentId, emitLiveCue, showGuidedTargets, targetSequenceDone]);

  // Start render loop once camera is ready
  useEffect(() => {
    if (cameraPermission !== "granted") return;

    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      drawSkeleton();
    };

    video.addEventListener("play", onPlay);
    onPlay();

    return () => {
      video.removeEventListener("play", onPlay);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [cameraPermission, drawSkeleton]);

  if (cameraPermission === "denied") {
    return (
      <div className="flex h-72 flex-col items-center justify-center rounded-[12px] border-2 border-amber-200 bg-amber-50">
        <div className="text-4xl mb-3">📷</div>
        <p className="font-semibold text-amber-900">{ui.cameraDenied}</p>
        <p className="mt-1 text-xs text-amber-800">{ui.cameraDeniedHelp}</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-[12px] border-2 border-[#1D9E75] bg-black overflow-hidden h-72">
      {/* Loading overlay — shown until camera starts */}
      {(cameraPermission === "idle" || cameraPermission === "loading") && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0f1a15]">
          <div className="mb-3 h-8 w-8 animate-spin rounded-full border-4 border-[#1D9E75]/30 border-t-[#1D9E75]" />
          <p className="font-semibold text-white">{ui.startingCamera}</p>
          <p className="mt-1 text-xs text-[#6b9080]">{ui.allowCamera}</p>
        </div>
      )}

      {/* Live video — always in DOM so ref attaches immediately */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ transform: "scaleX(-1)" }}
        className="h-full w-full object-cover"
      />

      {/* Skeleton canvas — sits on top of video */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ pointerEvents: "none", transform: "none" }}
      />

      {/* HUD overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Corner markers */}
        <div className="absolute top-3 left-3 w-5 h-5 border-l-2 border-t-2 border-[#1D9E75]" />
        <div className="absolute top-3 right-3 w-5 h-5 border-r-2 border-t-2 border-[#1D9E75]" />
        <div className="absolute bottom-3 left-3 w-5 h-5 border-l-2 border-b-2 border-[#1D9E75]" />
        <div className="absolute bottom-3 right-3 w-5 h-5 border-r-2 border-b-2 border-[#1D9E75]" />

        {/* Recording badge */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 px-3 py-1 rounded-full">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs font-bold text-white tracking-widest">REC</span>
        </div>

        {/* Pose status bottom-left */}
        {cameraPermission === "granted" && (
          <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/60 px-3 py-1 rounded-full">
            {poseLoading ? (
              <>
                <div className="h-2 w-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span className="text-xs font-bold text-white">{ui.loadingAi}</span>
              </>
            ) : (
              <>
                <div className={`w-2 h-2 rounded-full animate-pulse ${poseReady ? "bg-[#1D9E75]" : "bg-amber-400"}`} />
                <span className={`text-xs font-bold ${poseReady ? "text-[#1D9E75]" : "text-amber-300"}`}>
                  {poseReady ? ui.poseTracking : ui.poseStarting}
                </span>
              </>
            )}
          </div>
        )}

        {cameraPermission === "granted" && poseError && (
          <div className="absolute left-1/2 top-12 -translate-x-1/2 rounded-lg border border-amber-300/50 bg-black/70 px-3 py-1.5 text-[11px] font-semibold text-amber-200">
            {poseError}
          </div>
        )}

        {cameraPermission === "granted" && (
          <div className="absolute left-1/2 bottom-3 z-20 -translate-x-1/2 rounded-xl border border-white/20 bg-black/65 px-3 py-2 text-center text-xs font-semibold text-white shadow-lg">
            {liveCue}
          </div>
        )}

        {/* Functional reach guided-target status */}
        {cameraPermission === "granted" && showGuidedTargets && (
          <div className="absolute bottom-3 right-3 rounded-xl border border-white/20 bg-black/60 px-3 py-2 text-right shadow-lg">
            <p className="text-[10px] uppercase tracking-wider text-[#9db0a3]">{ui.handReachGuide}</p>
            <p className="text-xs font-bold text-white">
              {targetSequenceDone ? ui.targetsComplete : `${ui.targetLabel} ${Math.min(targetIndex + 1, activeTargets.length)} / ${activeTargets.length}`}
            </p>
          </div>
        )}

        {cameraPermission === "granted" && showGuidedTargets && (
          <div className="absolute top-3 right-3 rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold text-white">
            {targetSequenceDone ? ui.excellentReach : ui.reachGlow}
          </div>
        )}
      </div>
    </div>
  );
}
