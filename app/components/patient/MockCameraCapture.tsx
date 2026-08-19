"use client";

import { useRef, useEffect, useState, useCallback } from "react";

interface MockCameraCaptureProps {
  isActive: boolean;
}

export default function MockCameraCapture({ isActive }: MockCameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseLandmarkerRef = useRef<unknown>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const [cameraPermission, setCameraPermission] = useState<"idle" | "loading" | "granted" | "denied">("idle");
  const [poseLoading, setPoseLoading] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

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

  // Attach stream to video element as soon as both are ready
  useEffect(() => {
    if (stream && videoRef.current && videoRef.current.srcObject !== stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Load MediaPipe PoseLandmarker
  useEffect(() => {
    if (cameraPermission !== "granted") return;

    const loadPose = async () => {
      setPoseLoading(true);
      try {
        const { FilesetResolver: FSR, PoseLandmarker: PL } = await import("@mediapipe/tasks-vision");
        const vision = await FSR.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm"
        );
        const landmarker = await PL.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });
        poseLandmarkerRef.current = landmarker;
      } catch (e) {
        console.error("Pose model load error:", e);
      } finally {
        setPoseLoading(false);
      }
    };

    loadPose();
  }, [cameraPermission]);

  // Draw skeleton on canvas overlay
  const drawSkeleton = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = poseLandmarkerRef.current as any;
    if (!video || !canvas || video.readyState < 2) return;

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
      const results = landmarker.detectForVideo(video, performance.now());

      if (results?.landmarks?.length > 0) {
        const landmarks = results.landmarks[0];
        const W = canvas.width;
        const H = canvas.height;

        // Draw connections (skeleton lines)
        const connections: [number, number][] = [
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

        ctx.strokeStyle = "#1D9E75";
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.85;
        for (const [a, b] of connections) {
          const lA = landmarks[a];
          const lB = landmarks[b];
          if (lA && lB && lA.visibility > 0.4 && lB.visibility > 0.4) {
            ctx.beginPath();
            ctx.moveTo((1 - lA.x) * W, lA.y * H); // mirror horizontally
            ctx.lineTo((1 - lB.x) * W, lB.y * H);
            ctx.stroke();
          }
        }

        // Draw joint circles
        ctx.globalAlpha = 1;
        for (const lm of landmarks) {
          if (lm.visibility > 0.4) {
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
        ctx.globalAlpha = 1;
      }
    }

    animFrameRef.current = requestAnimationFrame(drawSkeleton);
  }, []);

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
    if (!video.paused) onPlay();

    return () => {
      video.removeEventListener("play", onPlay);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [cameraPermission, drawSkeleton]);

  if (cameraPermission === "denied") {
    return (
      <div className="flex h-72 flex-col items-center justify-center rounded-[12px] border-2 border-amber-200 bg-amber-50">
        <div className="text-4xl mb-3">📷</div>
        <p className="font-semibold text-amber-900">Camera Permission Denied</p>
        <p className="mt-1 text-xs text-amber-800">Please enable camera access in your browser settings to continue</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-[12px] border-2 border-[#1D9E75] bg-black overflow-hidden h-72">
      {/* Loading overlay — shown until camera starts */}
      {(cameraPermission === "idle" || cameraPermission === "loading") && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0f1a15]">
          <div className="mb-3 h-8 w-8 animate-spin rounded-full border-4 border-[#1D9E75]/30 border-t-[#1D9E75]" />
          <p className="font-semibold text-white">Starting camera…</p>
          <p className="mt-1 text-xs text-[#6b9080]">Please allow camera access when prompted</p>
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
                <span className="text-xs font-bold text-white">Loading AI…</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-[#1D9E75] rounded-full animate-pulse" />
                <span className="text-xs font-bold text-[#1D9E75]">POSE TRACKING</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

