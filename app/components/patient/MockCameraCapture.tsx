"use client";

import { useRef, useEffect, useState } from "react";

interface MockCameraCaptureProps {
  isActive: boolean;
}

export default function MockCameraCapture({ isActive }: MockCameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraPermission, setCameraPermission] = useState<"idle" | "granted" | "denied" | "mock">("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!isActive) {
      // Stop stream when not active
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
      return;
    }

    const startCamera = async () => {
      try {
        setIsLoading(true);
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
          audio: false,
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setCameraPermission("granted");
      } catch (error) {
        console.error("Camera error:", error);
        // Fall back to mock camera display
        setCameraPermission("mock");
        drawMockCamera();
      } finally {
        setIsLoading(false);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isActive, stream]);

  const drawMockCamera = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw dark background (like camera feed)
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw a grid pattern (simulating motion capture grid)
    ctx.strokeStyle = "#1D9E75";
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.2;

    const gridSize = 40;
    for (let i = 0; i < canvas.width; i += gridSize) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;

    // Draw center circle (simulating pose detection)
    ctx.strokeStyle = "#1D9E75";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 60, 0, Math.PI * 2);
    ctx.stroke();

    // Draw some joint markers
    const joints = [
      { x: canvas.width / 2, y: canvas.height / 2 - 80, label: "Head" },
      { x: canvas.width / 2 - 70, y: canvas.height / 2 - 20, label: "L-Shoulder" },
      { x: canvas.width / 2 + 70, y: canvas.height / 2 - 20, label: "R-Shoulder" },
      { x: canvas.width / 2 - 50, y: canvas.height / 2 + 100, label: "L-Knee" },
      { x: canvas.width / 2 + 50, y: canvas.height / 2 + 100, label: "R-Knee" },
    ];

    joints.forEach((joint) => {
      ctx.fillStyle = "#1D9E75";
      ctx.beginPath();
      ctx.arc(joint.x, joint.y, 6, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw connecting lines
    ctx.strokeStyle = "#1D9E75";
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(joints[0].x, joints[0].y);
    ctx.lineTo(joints[1].x, joints[1].y);
    ctx.lineTo(joints[3].x, joints[3].y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(joints[0].x, joints[0].y);
    ctx.lineTo(joints[2].x, joints[2].y);
    ctx.lineTo(joints[4].x, joints[4].y);
    ctx.stroke();
  };

  if (cameraPermission === "denied") {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-[12px] border-2 border-amber-200 bg-amber-50">
        <div className="text-4xl mb-3">📷</div>
        <p className="font-semibold text-amber-900">Camera Permission Denied</p>
        <p className="mt-1 text-xs text-amber-800">Please enable camera access in your browser settings to continue</p>
      </div>
    );
  }

  if (isLoading && cameraPermission === "idle") {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-[12px] border-2 border-[#d1dbd6] bg-[#f4f6f5]">
        <div className="mb-3 h-8 w-8 animate-spin rounded-full border-4 border-[#d1dbd6] border-t-[#1D9E75]"></div>
        <p className="font-semibold text-[#0f2e22]">Starting camera...</p>
        <p className="mt-1 text-xs text-[#6b9080]">Please allow camera access when prompted</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-[12px] border-2 border-[#d1dbd6] bg-black overflow-hidden">
      {cameraPermission === "granted" ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-64 w-full object-cover"
        />
      ) : (
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="h-64 w-full bg-black"
        />
      )}

      {/* Camera HUD Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Corner markers */}
        <div className="absolute top-4 left-4 w-6 h-6 border-2 border-[#1D9E75]" />
        <div className="absolute top-4 right-4 w-6 h-6 border-2 border-[#1D9E75]" />
        <div className="absolute bottom-4 left-4 w-6 h-6 border-2 border-[#1D9E75]" />
        <div className="absolute bottom-4 right-4 w-6 h-6 border-2 border-[#1D9E75]" />

        {/* Center crosshair */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="w-12 h-12 border-2 border-[#1D9E75] rounded-full opacity-50" />
          <div className="w-0.5 h-6 bg-[#1D9E75] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-50" />
          <div className="w-6 h-0.5 bg-[#1D9E75] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-50" />
        </div>

        {/* Recording indicator */}
        <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/50 px-3 py-1 rounded-full">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs font-bold text-white">REC</span>
        </div>

        {/* Mock camera indicator */}
        {cameraPermission === "mock" && (
          <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/50 px-3 py-1 rounded-full">
            <span className="text-xs font-bold text-[#1D9E75]">MOTION DETECTION</span>
          </div>
        )}
      </div>
    </div>
  );
}

