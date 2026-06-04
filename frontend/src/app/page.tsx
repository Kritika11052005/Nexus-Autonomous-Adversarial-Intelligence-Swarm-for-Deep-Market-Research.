/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Brain,
  ShieldAlert,
  BookOpen,
  Cpu,
  Globe,
  LogOut,
  CreditCard,
  Lock,
  ArrowRight,
  ChevronDown,
  Mic,
  MicOff
} from "lucide-react";
import axios from "axios";

// Node definition for the background graph
interface ParticleNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  pulseSpeed: number;
  pulseOffset: number;
  isActive: boolean;
}

interface FireflyNode {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  pulseSpeed: number;
  pulseOffset: number;
  color: string;
  glowColor: string;
  seed: number;
  trail?: { x: number; y: number; z: number }[];
}

export default function Home() {
  const router = useRouter();

  // Auth state
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("free");

  const [simStage, setSimStage] = useState<"idle" | "planner" | "researchers" | "critic" | "validator" | "writer">("idle");
  const [simLog, setSimLog] = useState<string>("Hover over any node or click 'Simulate Run' to trigger the adversarial pipeline.");
  const [hoveredStage, setHoveredStage] = useState<"planner" | "researchers" | "critic" | "validator" | "writer" | null>(null);

  // Form & Query State
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("General");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Voice input state (Gemini Speech-to-Text)
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);

  // Advanced Configurations (Locked for Free, editable for Pro)
  const [settings, setSettings] = useState({
    model: "gpt-4o",
    search_depth: 5,
    planner_temp: 0.2,
    critic_temp: 0.7
  });


  // Background Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check auth
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAuthenticated(true);
      setEmail(localStorage.getItem("user_email") || "user@example.com");
      setPlan(localStorage.getItem("user_plan") || "free");
    } else {
      setAuthenticated(false);
    }
    setLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    router.push("/auth");
  };

  const handleUpgrade = async () => {
    setSubmitting(true);
    setError("");
    try {
      const apiURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const token = localStorage.getItem("access_token");

      const response = await axios.post(
        `${apiURL}/billing/checkout`,
        {
          success_url: window.location.origin + "/?upgrade_success=true",
          cancel_url: window.location.origin
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.checkout_url) {
        window.location.href = response.data.checkout_url;
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Could not initialize checkout. Please try again.");
      setSubmitting(false);
    }
  };

  // Check for successful payment
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("upgrade_success") === "true") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlan("pro");
      localStorage.setItem("user_plan", "pro");
      setSuccess("Your account has been successfully upgraded to NEXUS PRO! Enjoy unlimited multi-agent runs.");
      router.replace("/");
    }
  }, [router]);

  // Initialize MediaRecorder and Speech Support check
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      navigator.mediaDevices &&
      (window.MediaRecorder || (window as any).webkitMediaRecorder)
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSpeechSupported(true);
    } else {
      setSpeechSupported(false);
    }
  }, []);

  const startRecording = async () => {
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      let options = {};
      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/ogg",
        "audio/mp4",
        "audio/wav"
      ];

      let selectedMimeType = "";
      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          options = { mimeType: mime };
          selectedMimeType = mime;
          break;
        }
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const mimeType = selectedMimeType || mediaRecorder.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: mimeType });

        // Stop all tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());

        setIsTranscribing(true);
        setError("");

        try {
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = async () => {
            try {
              const base64Data = (reader.result as string).split(",")[1];
              const apiURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
              const token = localStorage.getItem("access_token");

              const response = await axios.post(
                `${apiURL}/transcribe`,
                {
                  audio_base64: base64Data,
                  mime_type: mimeType
                },
                {
                  headers: { Authorization: `Bearer ${token}` }
                }
              );

              const transcribedText = response.data?.text;
              if (transcribedText && transcribedText.trim()) {
                setQuery(transcribedText.trim().slice(0, 500));
              } else {
                setError("Speech transcription returned empty text. Please try speaking closer to the mic.");
              }
            } catch (err: any) {
              console.error("Transcription endpoint failed:", err);
              setError("Transcription failed. Please check your network connection or try again.");
            } finally {
              setIsTranscribing(false);
            }
          };
        } catch (err: any) {
          console.error("FileReader failed:", err);
          setError("Failed to process audio recording.");
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch (err: any) {
      console.error("Mic access failed:", err);
      setError("Microphone access was denied or is not available.");
      setIsListening(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  };

  const toggleVoice = () => {
    if (isListening) {
      stopRecording();
    } else {
      setQuery("");
      startRecording();
    }
  };

  // Submit Query
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      setError("Please enter a question.");
      return;
    }
    if (query.trim().length < 10) {
      setError("Please add more details for better swarm reasoning (min 10 characters).");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const apiURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const token = localStorage.getItem("access_token");

      const response = await axios.post(
        `${apiURL}/sessions`,
        {
          query,
          domain,
          settings: plan === "pro" ? settings : { model: "gpt-4o", search_depth: 3 }
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Redirect to the active swarm stream page
      router.push(`/run/${response.data.session_id}`);
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Swarm pipeline initiation failed. Please upgrade to Pro if your Daily Free Limit is reached."
      );
      setSubmitting(false);
    }
  };

  // Canvas Bioluminescent 3D Forest & Firefly Swarm Background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Offscreen rendering layers
    const bgCanvas = document.createElement("canvas");
    const midCanvas = document.createElement("canvas");
    const fgCanvas = document.createElement("canvas");

    const bgCtx = bgCanvas.getContext("2d");
    const midCtx = midCanvas.getContext("2d");
    const fgCtx = fgCanvas.getContext("2d");

    const drawRainforestTree = (c: CanvasRenderingContext2D, x: number, y: number, h: number, barkColor: string, foliageColor: string) => {
      // Curve trunk slightly
      c.fillStyle = barkColor;
      const trunkW = h * 0.055;

      c.beginPath();
      c.moveTo(x - trunkW / 2, y);
      c.quadraticCurveTo(x - trunkW / 2 + (h * 0.04), y - h * 0.45, x - trunkW * 0.3, y - h);
      c.lineTo(x + trunkW * 0.3, y - h);
      c.quadraticCurveTo(x + trunkW / 2 + (h * 0.04), y - h * 0.45, x + trunkW / 2, y);
      c.closePath();
      c.fill();

      // Rounded thick jungle foliage canopy
      c.fillStyle = foliageColor;
      const capRadius = h * 0.24;
      const canopyY = y - h;

      c.beginPath();
      c.arc(x - trunkW * 0.3, canopyY, capRadius, 0, Math.PI * 2);
      c.arc(x - trunkW * 0.3 - capRadius * 0.4, canopyY + capRadius * 0.15, capRadius * 0.75, 0, Math.PI * 2);
      c.arc(x - trunkW * 0.3 + capRadius * 0.4, canopyY + capRadius * 0.1, capRadius * 0.75, 0, Math.PI * 2);
      c.arc(x - trunkW * 0.3, canopyY + capRadius * 0.3, capRadius * 0.65, 0, Math.PI * 2);
      c.closePath();
      c.fill();
    };

    const renderLayers = () => {
      bgCanvas.width = width;
      bgCanvas.height = height;
      midCanvas.width = width;
      midCanvas.height = height;
      fgCanvas.width = width;
      fgCanvas.height = height;

      // Background layer trees (blurred far trees)
      if (bgCtx) {
        bgCtx.clearRect(0, 0, width, height);
        const count = Math.ceil(width / 35);
        bgCtx.filter = "blur(3.5px)";
        for (let i = 0; i < count; i++) {
          const x = (i * width) / (count - 1) + (Math.random() - 0.5) * 25;
          const h = 90 + Math.random() * 80;
          const y = height - 40 + Math.random() * 20;
          // Richer green, higher opacity so they don't look completely black
          drawRainforestTree(bgCtx, x, y, h, "rgba(45, 32, 22, 0.35)", "rgba(28, 70, 38, 0.48)");
        }
        bgCtx.filter = "none";
      }

      // Midground layer trees (medium blur)
      if (midCtx) {
        midCtx.clearRect(0, 0, width, height);
        const count = Math.ceil(width / 55);
        midCtx.filter = "blur(1.2px)";
        for (let i = 0; i < count; i++) {
          const x = (i * width) / (count - 1) + (Math.random() - 0.5) * 40;
          const h = 150 + Math.random() * 100;
          const y = height - 20 + Math.random() * 10;
          // Lush forest green, solid opacity
          drawRainforestTree(midCtx, x, y, h, "rgba(55, 38, 26, 0.65)", "rgba(32, 88, 45, 0.78)");
        }
        midCtx.filter = "none";
      }

      // Foreground framing layer trees & leaves (Rainforest framing)
      if (fgCtx) {
        fgCtx.clearRect(0, 0, width, height);

        // Left large jungle trunk (warm brown with golden edge reflection from fireflies)
        const leftTrunkGrad = fgCtx.createLinearGradient(0, 0, width * 0.15, 0);
        leftTrunkGrad.addColorStop(0, "rgba(55, 38, 24, 0.98)");
        leftTrunkGrad.addColorStop(0.7, "rgba(75, 52, 32, 0.98)");
        leftTrunkGrad.addColorStop(1, "rgba(255, 170, 0, 0.35)"); // Golden firefly reflection edge

        fgCtx.fillStyle = leftTrunkGrad;
        fgCtx.beginPath();
        fgCtx.moveTo(-30, height + 30);
        fgCtx.quadraticCurveTo(width * 0.15, height * 0.5, -10, -30);
        fgCtx.lineTo(-100, -30);
        fgCtx.lineTo(-100, height + 30);
        fgCtx.closePath();
        fgCtx.fill();

        // Right large jungle trunk (warm brown with golden edge reflection)
        const rightTrunkGrad = fgCtx.createLinearGradient(width * 0.85, 0, width, 0);
        rightTrunkGrad.addColorStop(0, "rgba(255, 170, 0, 0.35)"); // Golden reflection edge
        rightTrunkGrad.addColorStop(0.3, "rgba(75, 52, 32, 0.98)");
        rightTrunkGrad.addColorStop(1, "rgba(55, 38, 24, 0.98)");

        fgCtx.fillStyle = rightTrunkGrad;
        fgCtx.beginPath();
        fgCtx.moveTo(width + 30, height + 30);
        fgCtx.quadraticCurveTo(width * 0.85, height * 0.5, width + 10, -30);
        fgCtx.lineTo(width + 100, -30);
        fgCtx.lineTo(width + 100, height + 30);
        fgCtx.closePath();
        fgCtx.fill();

        // Branches wrapping into the scene
        fgCtx.strokeStyle = "rgba(75, 52, 32, 0.98)";
        fgCtx.lineWidth = 16;
        fgCtx.lineCap = "round";

        // Left branch
        fgCtx.beginPath();
        fgCtx.moveTo(0, height * 0.32);
        fgCtx.quadraticCurveTo(width * 0.1, height * 0.28, width * 0.2, height * 0.35);
        fgCtx.stroke();

        // Right branch
        fgCtx.lineWidth = 14;
        fgCtx.beginPath();
        fgCtx.moveTo(width, height * 0.26);
        fgCtx.quadraticCurveTo(width * 0.88, height * 0.25, width * 0.78, height * 0.3);
        fgCtx.stroke();

        // Drooping vines (much brighter jungle green)
        fgCtx.strokeStyle = "rgba(38, 105, 55, 0.8)";
        fgCtx.lineWidth = 2.5;

        // Vine 1
        fgCtx.beginPath();
        fgCtx.moveTo(width * 0.15, height * 0.32);
        fgCtx.quadraticCurveTo(width * 0.16, height * 0.45, width * 0.14, height * 0.55);
        fgCtx.stroke();

        // Vine 2
        fgCtx.beginPath();
        fgCtx.moveTo(width * 0.8, height * 0.28);
        fgCtx.quadraticCurveTo(width * 0.78, height * 0.42, width * 0.81, height * 0.5);
        fgCtx.stroke();

        // Leaf clusters (Lush vibrant jungle green with warm bioluminescent golden overlays)
        const drawLeaves = (cx: number, cy: number, r: number) => {
          if (!fgCtx) return;

          // Main lush green foliage base
          fgCtx.fillStyle = "rgba(32, 92, 48, 0.98)";
          fgCtx.beginPath();
          fgCtx.arc(cx, cy, r, 0, Math.PI * 2);
          fgCtx.arc(cx - r * 0.4, cy + r * 0.2, r * 0.8, 0, Math.PI * 2);
          fgCtx.arc(cx + r * 0.4, cy + r * 0.1, r * 0.8, 0, Math.PI * 2);
          fgCtx.arc(cx, cy + r * 0.4, r * 0.7, 0, Math.PI * 2);
          fgCtx.closePath();
          fgCtx.fill();

          // Bright green leaf highlights to make them visually pop!
          fgCtx.fillStyle = "rgba(74, 165, 92, 0.96)";
          fgCtx.beginPath();
          fgCtx.arc(cx - r * 0.15, cy - r * 0.15, r * 0.65, 0, Math.PI * 2);
          fgCtx.arc(cx + r * 0.2, cy - r * 0.1, r * 0.5, 0, Math.PI * 2);
          fgCtx.closePath();
          fgCtx.fill();

          // Warm bioluminescent amber-gold highlights reflecting fireflies
          fgCtx.fillStyle = "rgba(255, 190, 0, 0.15)";
          fgCtx.beginPath();
          fgCtx.arc(cx + r * 0.1, cy + r * 0.1, r * 0.75, 0, Math.PI * 2);
          fgCtx.closePath();
          fgCtx.fill();
        };

        // Draw multiple large leaf clusters along the branches and frame edges
        drawLeaves(width * 0.2, height * 0.35, 35);
        drawLeaves(width * 0.12, height * 0.3, 40);
        drawLeaves(width * 0.78, height * 0.3, 30);
        drawLeaves(width * 0.85, height * 0.26, 35);

        // Drooping leaves from the top top-center
        drawLeaves(width * 0.5, -10, 65);
        drawLeaves(width * 0.38, -15, 50);
        drawLeaves(width * 0.62, -20, 55);
        drawLeaves(width * 0.25, -20, 45);
        drawLeaves(width * 0.75, -20, 45);
      }
    };

    renderLayers();

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      centerX = width / 2;
      centerY = height / 2;
      renderLayers();
    };

    window.addEventListener("resize", handleResize);

    // Mouse Tracking
    const mouse = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      isPresent: false
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
      mouse.isPresent = true;
    };

    const handleMouseLeave = () => {
      mouse.isPresent = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.body.addEventListener("mouseleave", handleMouseLeave);

    // Generate Fireflies
    const fireflies: FireflyNode[] = [];
    const fireflyCount = 240;
    const colors = [
      "rgba(255, 170, 0, ",  // Warm amber-orange
      "rgba(255, 215, 0, ",  // Neon gold
      "rgba(224, 255, 0, "   // Yellow-green firefly glow
    ];
    const glowColors = ["#FFAA00", "#FFD700", "#E0FF00"];

    for (let i = 0; i < fireflyCount; i++) {
      const colorIndex = Math.floor(Math.random() * colors.length);
      fireflies.push({
        x: Math.random() * width,
        y: Math.random() * height,
        z: Math.random() * 1000,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        vz: (Math.random() - 0.5) * 0.6,
        radius: Math.random() * 2.5 + 1.2,
        pulseSpeed: 0.02 + Math.random() * 0.03,
        pulseOffset: Math.random() * Math.PI * 2,
        color: colors[colorIndex],
        glowColor: glowColors[colorIndex],
        seed: Math.random() * 100
      });
    }

    const FL = 400; // Focal Length
    let centerX = width / 2;
    let centerY = height / 2;

    // Spark Interface for Click Shockwave Glows
    interface Spark {
      x: number;
      y: number;
      z: number;
      vx: number;
      vy: number;
      vz: number;
      glowColor: string;
      life: number;
      maxLife: number;
    }
    const sparks: Spark[] = [];

    const handleCanvasClick = (e: MouseEvent) => {
      const clickX = e.clientX;
      const clickY = e.clientY;

      // Pulse force push away
      fireflies.forEach((ff) => {
        const scale = FL / (FL + ff.z);
        const projX = centerX + (ff.x - centerX) * scale;
        const projY = centerY + (ff.y - centerY) * scale;

        const dx = projX - clickX;
        const dy = projY - clickY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 220 && dist > 0) {
          const force = (1 - dist / 220) * 12;
          ff.vx += (dx / dist) * force;
          ff.vy += (dy / dist) * force;
        }
      });

      // Spawn temporary fast-glow sparks
      for (let k = 0; k < 20; k++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 3;
        const colorIndex = Math.floor(Math.random() * glowColors.length);

        const zTarget = 150 + Math.random() * 200;
        const scaleAtTarget = FL / (FL + zTarget);
        const x3d = (clickX - centerX) / scaleAtTarget + centerX;
        const y3d = (clickY - centerY) / scaleAtTarget + centerY;

        sparks.push({
          x: x3d,
          y: y3d,
          z: zTarget,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          vz: (Math.random() - 0.5) * 2,
          glowColor: glowColors[colorIndex],
          life: 1.0,
          maxLife: 0.015 + Math.random() * 0.02
        });
      }
    };

    window.addEventListener("click", handleCanvasClick);

    let time = 0;
    const draw = () => {
      // Dynamic resize check to prevent vertical cut-offs or stripes
      const currentWidth = window.innerWidth;
      const currentHeight = window.innerHeight;
      if (canvas.width !== currentWidth || canvas.height !== currentHeight) {
        width = canvas.width = currentWidth;
        height = canvas.height = currentHeight;
        centerX = width / 2;
        centerY = height / 2;
        renderLayers();
      }

      time += 0.015;
      ctx.clearRect(0, 0, width, height);

      // Interpolate mouse coordinates
      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      // Parallax offsets (fixed to 0 to keep the jungle static)
      const parallaxBgX = 0;
      const parallaxBgY = 0;
      const parallaxMidX = 0;
      const parallaxMidY = 0;
      const parallaxFgX = 0;
      const parallaxFgY = 0;

      // Update Boids swarm simulation logic
      for (let i = 0; i < fireflies.length; i++) {
        const firefly = fireflies[i];

        let sepX = 0, sepY = 0, sepZ = 0, sepCount = 0;
        let alignX = 0, alignY = 0, alignZ = 0, alignCount = 0;
        let cohX = 0, cohY = 0, cohZ = 0, cohCount = 0;

        for (let j = 0; j < fireflies.length; j++) {
          if (i === j) continue;
          const other = fireflies[j];
          const dx = firefly.x - other.x;
          const dy = firefly.y - other.y;
          const dz = firefly.z - other.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist > 0 && dist < 35) {
            sepX += dx / dist;
            sepY += dy / dist;
            sepZ += dz / dist;
            sepCount++;
          }
          if (dist > 0 && dist < 120) {
            alignX += other.vx;
            alignY += other.vy;
            alignZ += other.vz;
            alignCount++;

            cohX += other.x;
            cohY += other.y;
            cohZ += other.z;
            cohCount++;
          }
        }

        if (sepCount > 0) {
          sepX = (sepX / sepCount) * 0.12;
          sepY = (sepY / sepCount) * 0.12;
          sepZ = (sepZ / sepCount) * 0.12;
        }
        if (alignCount > 0) {
          alignX = (alignX / alignCount - firefly.vx) * 0.04;
          alignY = (alignY / alignCount - firefly.vy) * 0.04;
          alignZ = (alignZ / alignCount - firefly.vz) * 0.04;
        }
        if (cohCount > 0) {
          cohX = (cohX / cohCount - firefly.x) * 0.0015;
          cohY = (cohY / cohCount - firefly.y) * 0.0015;
          cohZ = (cohZ / cohCount - firefly.z) * 0.0015;
        }

        // Mouse gravity attraction and close-range scatter repulsion (prevents clumping)
        let mouseForceX = 0, mouseForceY = 0, mouseForceZ = 0;
        if (mouse.isPresent) {
          const mouseZTarget = 250;
          const scaleAtTarget = FL / (FL + mouseZTarget);
          const targetX = (mouse.x - centerX) / scaleAtTarget + centerX;
          const targetY = (mouse.y - centerY) / scaleAtTarget + centerY;

          const dx = targetX - firefly.x;
          const dy = targetY - firefly.y;
          const dz = mouseZTarget - firefly.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist > 0) {
            if (dist < 120) {
              // Strong repulsion when too close to avoid clubbing/clustering
              const force = (1.0 - dist / 120) * -0.32;
              mouseForceX = (dx / dist) * force;
              mouseForceY = (dy / dist) * force;
              mouseForceZ = (dz / dist) * force;
            } else if (dist < 350) {
              // Gentle attraction when in range to guide them near the cursor
              const force = ((dist - 120) / 230) * 0.045;
              mouseForceX = (dx / dist) * force;
              mouseForceY = (dy / dist) * force;
              mouseForceZ = (dz / dist) * force * 0.8;

              // Swirling orbit effect around the cursor
              const swirlX = -dy / dist;
              const swirlY = dx / dist;
              mouseForceX += swirlX * 0.025;
              mouseForceY += swirlY * 0.025;
            }
          }
        }

        // Natural noise wind drift
        const windX = Math.sin(time * 0.4 + firefly.seed) * 0.015;
        const windY = Math.cos(time * 0.25 + firefly.seed) * 0.015;

        // Apply forces
        firefly.vx += sepX + alignX + cohX + mouseForceX + windX;
        firefly.vy += sepY + alignY + cohY + mouseForceY + windY;
        firefly.vz += sepZ + alignZ + cohZ + mouseForceZ;

        // Limit speed
        const speed = Math.sqrt(firefly.vx * firefly.vx + firefly.vy * firefly.vy + firefly.vz * firefly.vz);
        const maxSpeed = mouse.isPresent ? 2.0 : 0.8;
        if (speed > maxSpeed) {
          firefly.vx = (firefly.vx / speed) * maxSpeed;
          firefly.vy = (firefly.vy / speed) * maxSpeed;
          firefly.vz = (firefly.vz / speed) * maxSpeed;
        }

        // Apply velocities
        firefly.x += firefly.vx;
        firefly.y += firefly.vy;
        firefly.z += firefly.vz;

        // Motion trail tracking
        if (!firefly.trail) firefly.trail = [];
        firefly.trail.unshift({ x: firefly.x, y: firefly.y, z: firefly.z });
        if (firefly.trail.length > 5) {
          firefly.trail.pop();
        }

        // Boundaries wrapping
        if (firefly.x < -200) firefly.x = width + 200;
        if (firefly.x > width + 200) firefly.x = -200;
        if (firefly.y < -200) firefly.y = height + 200;
        if (firefly.y > height + 200) firefly.y = -200;
        if (firefly.z < 0) firefly.z = 1000;
        if (firefly.z > 1000) firefly.z = 0;
      }

      // Sort fireflies by depth (z desc: far to near)
      const sortedFireflies = [...fireflies].sort((a, b) => b.z - a.z);

      // Interleave rendering of forest layers and fireflies for 3D depth parallax
      let drawnBgTrees = false;
      let drawnMidTrees = false;
      let drawnFgTrees = false;

      // Draw synaptic connections between close-proximity fireflies in similar depth slices (neural intelligence network)
      let connections = 0;
      for (let i = 0; i < sortedFireflies.length; i++) {
        const a = sortedFireflies[i];
        if (a.z > 700) continue; // too far to connect
        const scaleA = FL / (FL + a.z);
        const projXA = centerX + (a.x - centerX) * scaleA;
        const projYA = centerY + (a.y - centerY) * scaleA;

        for (let j = i + 1; j < sortedFireflies.length; j++) {
          if (connections > 35) break; // limit to avoid clutter
          const b = sortedFireflies[j];
          if (Math.abs(a.z - b.z) > 130) continue;

          const scaleB = FL / (FL + b.z);
          const projXB = centerX + (b.x - centerX) * scaleB;
          const projYB = centerY + (b.y - centerY) * scaleB;

          const dx = projXA - projXB;
          const dy = projYA - projYB;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120) {
            connections++;
            const alpha = (1 - dist / 120) * 0.12 * (1 - a.z / 900);
            ctx.beginPath();
            ctx.moveTo(projXA, projYA);
            ctx.lineTo(projXB, projYB);
            ctx.strokeStyle = a.glowColor;
            ctx.globalAlpha = alpha;
            ctx.lineWidth = 0.5 * scaleA;
            ctx.stroke();
            ctx.globalAlpha = 1.0;
          }
        }
      }

      // Draw all fireflies with 3D layers and camera depth
      sortedFireflies.forEach((ff) => {
        // Draw background layer (z > 600)
        if (ff.z <= 600 && !drawnBgTrees) {
          ctx.drawImage(bgCanvas, parallaxBgX, parallaxBgY);
          drawnBgTrees = true;
        }

        // Draw midground layer (z > 300)
        if (ff.z <= 300 && !drawnMidTrees) {
          ctx.drawImage(midCanvas, parallaxMidX, parallaxMidY);
          drawnMidTrees = true;
        }

        // Draw foreground layer (z > 80)
        if (ff.z <= 80 && !drawnFgTrees) {
          ctx.drawImage(fgCanvas, parallaxFgX, parallaxFgY);
          drawnFgTrees = true;
        }

        // Perspective Projection coordinates
        const scale = FL / (FL + ff.z);
        const projX = centerX + (ff.x - centerX) * scale;
        const projY = centerY + (ff.y - centerY) * scale;
        const projR = ff.radius * scale;

        // Pulse logic
        const pulse = 1.0 + Math.sin(time * ff.pulseSpeed + ff.pulseOffset) * 0.45;
        const finalR = projR * pulse;

        // Offscreen check
        if (projX < -50 || projX > width + 50 || projY < -50 || projY > height + 50) return;

        // Draw motion trails
        if (ff.trail && ff.trail.length > 1) {
          ctx.beginPath();
          const startScale = FL / (FL + ff.trail[0].z);
          ctx.moveTo(
            centerX + (ff.trail[0].x - centerX) * startScale,
            centerY + (ff.trail[0].y - centerY) * startScale
          );
          for (let tIdx = 1; tIdx < ff.trail.length; tIdx++) {
            const p = ff.trail[tIdx];
            const pScale = FL / (FL + p.z);
            ctx.lineTo(
              centerX + (p.x - centerX) * pScale,
              centerY + (p.y - centerY) * pScale
            );
          }
          ctx.strokeStyle = ff.glowColor;
          ctx.globalAlpha = 0.15 * (1 - ff.z / 1000);
          ctx.lineWidth = projR * 0.55;
          ctx.stroke();
          ctx.globalAlpha = 1.0;
        }

        // Render cinematic radial gradient glow
        let glowAlpha = 0.8;
        if (ff.z < 60) glowAlpha = 0.15;
        else if (ff.z < 250) glowAlpha = 0.95;
        else if (ff.z < 600) glowAlpha = 0.7;
        else glowAlpha = 0.35;

        const radGrad = ctx.createRadialGradient(projX, projY, 0, projX, projY, finalR * 3.5);
        radGrad.addColorStop(0, "#FFFFFF"); // white hot center
        radGrad.addColorStop(0.12, `${ff.color}${glowAlpha})`);
        radGrad.addColorStop(0.4, `${ff.color}${glowAlpha * 0.3})`);
        radGrad.addColorStop(1, "rgba(0,0,0,0)"); // soft blend outer ring

        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(projX, projY, finalR * 3.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Update and Draw temporary click sparks
      for (let idx = sparks.length - 1; idx >= 0; idx--) {
        const sp = sparks[idx];
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.z += sp.vz;
        sp.vx *= 0.93; // friction
        sp.vy *= 0.93;
        sp.life -= sp.maxLife;

        if (sp.life <= 0) {
          sparks.splice(idx, 1);
          continue;
        }

        const scale = FL / (FL + sp.z);
        const projX = centerX + (sp.x - centerX) * scale;
        const projY = centerY + (sp.y - centerY) * scale;
        const rad = 2.8 * scale * sp.life;

        // Render spark glow
        const radGrad = ctx.createRadialGradient(projX, projY, 0, projX, projY, rad * 3.0);
        radGrad.addColorStop(0, "#FFFFFF");
        radGrad.addColorStop(0.2, sp.glowColor);
        radGrad.addColorStop(1, "rgba(0,0,0,0)");

        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(projX, projY, rad * 3.0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Catch-all to make sure forest layers are drawn even if swarm is empty or z values don't hit the thresholds
      if (!drawnBgTrees) ctx.drawImage(bgCanvas, parallaxBgX, parallaxBgY);
      if (!drawnMidTrees) ctx.drawImage(midCanvas, parallaxMidX, parallaxMidY);
      if (!drawnFgTrees) ctx.drawImage(fgCanvas, parallaxFgX, parallaxFgY);

      // Draw smooth gradient at the bottom of the canvas to dissolve the tree trunks seamlessly
      const fadeHeight = 320;
      const bottomFade = ctx.createLinearGradient(0, height - fadeHeight, 0, height);
      bottomFade.addColorStop(0, "rgba(9, 9, 18, 0)");
      bottomFade.addColorStop(0.3, "rgba(8, 8, 15, 0.5)");
      bottomFade.addColorStop(0.7, "rgba(9, 9, 18, 0.92)");
      bottomFade.addColorStop(1, "rgba(9, 9, 18, 1.0)");

      ctx.fillStyle = bottomFade;
      ctx.fillRect(0, height - fadeHeight, width, fadeHeight);

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      document.body.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("click", handleCanvasClick);
      cancelAnimationFrame(animationId);
    };
  }, [authenticated]);

  // Example Query Chips by Domain
  const domainPrompts: Record<string, { text: string; domain: string }[]> = {
    General: [
      { text: "🌍 Geopolitical risk factors for Southeast Asia supply chains in 2026", domain: "General" },
      { text: "📈 Impact of global inflation rates on retail consumer goods", domain: "General" },
      { text: "⚡ High-efficiency renewable energy grids for decentralized cities", domain: "General" }
    ],
    Business: [
      { text: "📊 B2B SaaS market growth patterns and market share in India 2026", domain: "Business" },
      { text: "💼 AI agent adoption trends in Fortune 500 financial enterprises", domain: "Business" },
      { text: "🦄 Growth analysis of direct-to-consumer ecommerce in Southeast Asia", domain: "Business" }
    ],
    Research: [
      { text: "🔬 Latest breakthroughs in computational protein folding and therapeutics", domain: "Research" },
      { text: "🌌 Dark matter detection experiments and cosmological simulations", domain: "Research" },
      { text: "🧠 Cognitive neural interfaces and brain-computer communication models", domain: "Research" }
    ],
    Technical: [
      { text: "💻 Edge computing architecture patterns for low-latency IoT grids", domain: "Technical" },
      { text: "🔒 Zero-knowledge proof protocols for decentralized identity verification", domain: "Technical" },
      { text: "⚙️ Rust vs C++ performance metrics for safety-critical hardware runtimes", domain: "Technical" }
    ]
  };

  const handleChipClick = (chip: { text: string; domain: string }) => {
    setQuery(chip.text);
    setDomain(chip.domain);
    setError("");
  };

  const startPipelineSimulation = () => {
    if (simStage !== "idle") return;
    
    const stages = [
      { name: "planner" as const, log: "▶ [PLANNER] Received query. Creating hierarchical decomposition tree. Setting up 3 parallel search paths..." },
      { name: "researchers" as const, log: "▶ [RESEARCHERS] Crawling the live web. Web Crawler A, B, and C executing parallel Tavily requests..." },
      { name: "critic" as const, log: "▶ [CRITIC] Commencing adversarial check. Flagging sources, checking validation dates, and identifying logical anomalies..." },
      { name: "validator" as const, log: "▶ [VALIDATOR] Resolving discrepancies. Cross-referencing contradictions and assigning confidence level of 65%..." },
      { name: "writer" as const, log: "▶ [WRITER] Consolidating validated findings. Translating text blocks and rendering final localized report." }
    ];

    let current = 0;
    setSimStage(stages[0].name);
    setSimLog(stages[0].log);

    const interval = setInterval(() => {
      current++;
      if (current < stages.length) {
        setSimStage(stages[current].name);
        setSimLog(stages[current].log);
      } else {
        clearInterval(interval);
        setSimStage("idle");
        setSimLog("✔ Swarm run simulation complete. High-fidelity intelligence report synthesized successfully!");
      }
    }, 2800);
  };

  const isStageActive = (stage: "planner" | "researchers" | "critic" | "validator" | "writer") => {
    if (simStage !== "idle") {
      return simStage === stage;
    }
    return hoveredStage === stage;
  };

  const handleHoverStage = (stage: "planner" | "researchers" | "critic" | "validator" | "writer" | null) => {
    if (simStage !== "idle") return;
    setHoveredStage(stage);
    if (stage === "planner") {
      setSimLog("Planner: Breaks complex, ambiguous questions down into discrete, parallel research strategies.");
    } else if (stage === "researchers") {
      setSimLog("Researchers: Scrape search engines, crawl active URLs, extract text, and compile raw source links.");
    } else if (stage === "critic") {
      setSimLog("Critic: Inspects source trust, flags timeline bias, challenges claims, and identifies unstated assumptions.");
    } else if (stage === "validator") {
      setSimLog("Validator: Resolves logical conflict, filters hallucinations, cross-references sources, and scores confidence.");
    } else if (stage === "writer") {
      setSimLog("Writer: Reconciles all validated intelligence feeds and synthesizes structured localized markdown reports.");
    } else {
      setSimLog("Hover over any node or click 'Simulate Run' to trigger the adversarial pipeline.");
    }
  };

  // Domain configuration helper
  const domainOptions = [
    { name: "General", icon: Globe },
    { name: "Business", icon: Brain },
    { name: "Research", icon: BookOpen },
    { name: "Technical", icon: Cpu }
  ];

  // Pipeline Agents data
  const pipelineAgents = [
    { icon: "🗺️", name: "PLANNER", desc: "Breaks your question into sub-tasks", color: "text-[#8B5CF6]" },
    { icon: "🔍", name: "RESEARCHER A", desc: "Searches the live web", color: "text-[#06B6D4]" },
    { icon: "🔍", name: "RESEARCHER B", desc: "Searches the live web", color: "text-[#14B8A6]" },
    { icon: "🔍", name: "RESEARCHER C", desc: "Searches the live web", color: "text-[#38BDF8]" },
    { icon: "⚔️", name: "CRITIC", desc: "Challenges every finding", color: "text-[#F59E0B]" },
    { icon: "✅", name: "VALIDATOR", desc: "Cross-checks for contradictions", color: "text-[#10B981]" },
    { icon: "✍️", name: "WRITER", desc: "Scores confidence + writes report", color: "text-[#E0FFFA]" }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08080F] text-[#F0F0FF] flex items-center justify-center font-mono">
        SECURITY VERIFYING AUTHORIZATION TOKEN...
      </div>
    );
  }

  // Staggered child variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      }
    }
  } as const;

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  } as const;

  return (
    <div className="relative min-h-screen bg-[#08080F] text-[#F0F0FF] overflow-x-hidden flex flex-col font-sans">

      {/* 1. HERO SECTION */}
      <section className="relative min-h-screen flex flex-col justify-between items-center px-4 sm:px-6 pt-24 pb-12 z-10">

        {/* Canvas graph */}
        <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none opacity-85" />

        {/* Smooth bottom gradient transition to blend with section 2 */}
        <div className="absolute bottom-0 left-0 right-0 h-80 hero-bottom-fade pointer-events-none z-[1]" />


        {/* Central Hero Body */}
        <div className="w-full max-w-4xl flex-1 flex flex-col items-center justify-center text-center mt-12 md:mt-0 relative z-10">

          {/* Eyebrow badge */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent-cyan/30 bg-accent-cyan/5 text-accent-cyan font-mono text-[11px] tracking-widest uppercase mb-8 shadow-[0_0_15px_rgba(255,170,0,0.05)] animate-[pulse_2s_infinite]"
          >
            <span>⬡</span> MULTI-AGENT INTELLIGENCE
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="font-display font-extrabold tracking-tight leading-none text-center mb-6"
          >
            <motion.span variants={itemVariants} className="block text-5xl sm:text-7xl md:text-8xl text-[#F0F0FF]">
              The Swarm
            </motion.span>
            <motion.span
              variants={itemVariants}
              className="block text-5xl sm:text-7xl md:text-8xl bg-clip-text text-transparent bg-gradient-to-r from-accent-cyan to-accent-purple mt-2"
            >
              Thinks Together.
            </motion.span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="text-text-secondary text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-10"
          >
            Drop any hard question. Seven specialist agents plan, research, debate, and deliver a confidence-scored intelligence report — in under 3 minutes.
          </motion.p>

          {/* Form / Query Input Container */}
          {/* Form / Query Input Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="w-full max-w-[680px] flex flex-col gap-4 mb-10"
          >
            {authenticated ? (
              <>
                {/* Main Textarea Wrapper */}
                <form onSubmit={handleSubmit} className="flex flex-col w-full relative">
                  <div className="relative group border border-border-subtle hover:border-accent-cyan/40 focus-within:border-accent-cyan/80 focus-within:shadow-[0_0_25px_rgba(255,170,0,0.15)] rounded-2xl bg-bg-surface/60 backdrop-blur-md transition-all duration-300">

                    {/* Voice Input Mic Button */}
                    {speechSupported && (
                      <button
                        type="button"
                        onClick={toggleVoice}
                        disabled={submitting}
                        className={`absolute top-3 right-3 z-20 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 cursor-pointer group/mic ${isListening
                          ? "bg-accent-cyan/20 border border-accent-cyan/60 shadow-[0_0_18px_rgba(255,170,0,0.35)] animate-pulse"
                          : "bg-bg-surface/50 border border-border-subtle hover:border-accent-cyan/40 hover:bg-accent-cyan/10 hover:shadow-[0_0_12px_rgba(255,170,0,0.15)]"
                          }`}
                        title={isListening ? "Stop listening" : "Speak your query"}
                        aria-label={isListening ? "Stop voice input" : "Start voice input"}
                      >
                        {isListening ? (
                          <MicOff size={15} className="text-accent-cyan" />
                        ) : (
                          <Mic size={15} className="text-text-secondary group-hover/mic:text-accent-cyan transition-colors" />
                        )}
                      </button>
                    )}

                    {/* Listening/Transcribing indicator */}
                    <AnimatePresence>
                      {isListening && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="absolute top-3 right-14 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent-cyan/10 border border-accent-cyan/30"
                        >
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-cyan opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-cyan"></span>
                          </span>
                          <span className="font-mono text-[9px] text-accent-cyan tracking-wider">RECORDING...</span>
                        </motion.div>
                      )}
                      {isTranscribing && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="absolute top-3 right-14 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent-purple/10 border border-accent-purple/30 animate-pulse"
                        >
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-purple opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-purple"></span>
                          </span>
                          <span className="font-mono text-[9px] text-accent-purple tracking-wider">TRANSCRIBING...</span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <textarea
                      ref={textareaRef}
                      className="w-full h-32 p-5 pr-14 bg-transparent text-[#F0F0FF] placeholder:text-text-muted focus:outline-none resize-none font-sans text-sm sm:text-base leading-relaxed"
                      placeholder={
                        isListening
                          ? "Recording your voice... Speak your query and click the mic button again to finish."
                          : isTranscribing
                            ? "Transcribing with Gemini API... please wait a moment."
                            : "Ask anything complex... e.g. 'Should I launch a B2B SaaS in India in 2026?'"
                      }
                      value={query}
                      onChange={(e) => {
                        if (e.target.value.length <= 500) {
                          setQuery(e.target.value);
                          setError("");
                        }
                      }}
                      disabled={submitting || isListening || isTranscribing}
                    />

                    {/* Counter & Action */}
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none">
                      {/* Counter */}
                      <span className={`font-mono text-[10px] ${query.length > 450 ? "text-accent-red font-bold animate-pulse" : "text-text-muted"}`}>
                        {query.length} / 500
                      </span>

                      {/* Submit button */}
                      <button
                        type="submit"
                        disabled={submitting}
                        className="pointer-events-auto h-9 px-4 rounded-xl font-sans font-bold text-xs bg-accent-cyan text-[#08080F] border border-accent-cyan shadow-[0_0_15px_rgba(255,170,0,0.3)] hover:shadow-[0_0_25px_rgba(255,170,0,0.5)] transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                      >
                        {submitting ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-[#08080F] border-t-transparent rounded-full animate-spin"></div>
                            RUNNING
                          </>
                        ) : (
                          <>
                            Run Swarm
                            <ArrowRight size={12} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>

                {/* Error notifications */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="flex items-center gap-2 text-accent-red font-mono text-xs bg-red-950/20 border border-red-900/30 px-3.5 py-2.5 rounded-xl text-left"
                    >
                      <ShieldAlert size={14} className="shrink-0" />
                      <span>{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Success notifications */}
                {success && (
                  <div className="w-full text-left text-xs font-mono text-confidence-high bg-emerald-950/20 border border-emerald-900/30 px-4 py-2.5 rounded-xl">
                    {success}
                  </div>
                )}

                {/* Domain Pill Selectors */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-bg-surface/20 border border-border-subtle p-3 rounded-xl backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-text-secondary tracking-wider">DOMAIN:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {domainOptions.map((pill) => {
                        const IconComp = pill.icon;
                        const isActive = domain === pill.name;
                        return (
                          <button
                            key={pill.name}
                            type="button"
                            onClick={() => setDomain(pill.name)}
                            className={`flex items-center gap-1 px-3 py-1 rounded-full font-mono text-[10px] border transition-all cursor-pointer uppercase ${isActive
                              ? "bg-accent-cyan border-accent-cyan text-[#08080F] font-bold shadow-[0_0_8px_rgba(255,170,0,0.25)]"
                              : "border-border-subtle bg-bg-surface/50 text-text-secondary hover:text-[#F0F0FF] hover:border-text-secondary"
                              }`}
                          >
                            <IconComp size={10} />
                            {pill.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* Unlock Interface Lock Card */
              <div className="w-full p-6 sm:p-8 rounded-2xl border border-accent-cyan/15 bg-[#0E0E1A]/40 backdrop-blur-md text-center flex flex-col items-center gap-4 relative overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
                <div className="absolute -top-12 -right-12 w-28 h-28 rounded-full bg-accent-cyan/5 blur-[30px]" />

                <div className="w-11 h-11 rounded-xl bg-accent-cyan/10 border border-accent-cyan/20 flex items-center justify-center text-accent-cyan shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                  <Lock size={18} />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-lg text-[#F0F0FF]">Unlock Swarm Reasoning Panel</h3>
                  <p className="font-sans text-xs text-text-secondary mt-1.5 max-w-sm mx-auto leading-relaxed">
                    Sign in to initialize research campaigns, view real-time agent debate streams, and synthesize confidence-scored reports.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => router.push("/auth")}
                  className="mt-1.5 px-5 py-2.5 rounded-full font-sans font-bold text-xs bg-accent-cyan text-[#08080F] border border-accent-cyan shadow-[0_0_15px_rgba(255,170,0,0.25)] hover:shadow-[0_0_25px_rgba(255,170,0,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center gap-1.5"
                >
                  Authenticate & Enter Panel
                  <ArrowRight size={13} className="text-[#08080F]" />
                </button>
              </div>
            )}

            {/* Example chips below input */}
            <div className="text-left mt-2">
              <span className="font-mono text-[9px] text-text-muted tracking-widest uppercase block mb-2">
                Quick Swarm Prompts:
              </span>
              <div className="flex flex-col gap-2">
                {(domainPrompts[domain] || domainPrompts["General"]).map((chip, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      if (authenticated) {
                        handleChipClick(chip);
                      } else {
                        router.push("/auth");
                      }
                    }}
                    className="w-full text-left text-xs p-3 rounded-xl border border-border-subtle bg-bg-surface/30 hover:bg-bg-surface/70 hover:border-accent-cyan/30 transition-all font-sans text-text-secondary hover:text-[#F0F0FF] flex items-center gap-2 group cursor-pointer"
                  >
                    <span className="text-accent-cyan font-mono text-[10px] group-hover:scale-125 transition-transform">⬡</span>
                    <span>{chip.text}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Stats / Social proof row */}
          <div className="flex items-center gap-4 mt-8 font-mono text-[11px] text-text-secondary">
            <span>7 Specialist Agents</span>
            <span className="text-text-muted">|</span>
            <span>Adversarial Validation</span>
            <span className="text-text-muted">|</span>
            <span>Confidence-Scored Output</span>
          </div>


        </div>

        {/* Scroll indicator - Bottom */}
        <div className="relative z-10 w-full flex justify-center text-text-muted mt-8">
          <motion.a
            href="#how-it-works"
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="flex flex-col items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-text-secondary hover:text-accent-cyan transition-colors"
          >
            <span>DISCOVER THE SWARM</span>
            <ChevronDown size={14} />
          </motion.a>
        </div>

      </section>

      {/* 2. SECTION 2: HOW IT WORKS — "THE SWARM PIPELINE" */}
      <section id="how-it-works" className="relative w-full py-28 section-pipeline-bg border-b border-border-subtle z-10">

        {/* Subtle glow background */}
        <div className="absolute inset-0 pointer-events-none z-0 opacity-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-r from-accent-cyan to-accent-purple blur-[120px] rounded-full" />
        </div>

        <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6">
          {/* Section label */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="h-[1px] w-8 bg-accent-cyan/30" />
            <span className="font-mono text-xs text-accent-cyan tracking-widest uppercase">
              HOW NEXUS WORKS
            </span>
            <div className="h-[1px] w-8 bg-accent-cyan/30" />
          </div>

          <h2 className="font-display font-extrabold text-3xl sm:text-5xl text-center text-[#F0F0FF] mb-16">
            Seven agents. One answer. Zero black boxes.
          </h2>

          {/* Swarm Pipeline Graph View */}
          <div className="w-full mt-12 flex flex-col items-center">

            {/* Desktop Horizontal Swarm Flow */}
            <div className="hidden lg:flex flex-row items-center justify-center gap-3 w-full">

              {/* Planner Card */}
              <AgentCard
                icon="🗺️"
                name="Planner"
                desc="Breaks question to tasks"
                accent="#8B5CF6"
                isActive={isStageActive("planner")}
                onHover={() => handleHoverStage("planner")}
                onLeave={() => handleHoverStage(null)}
              />

              {/* Connector lines structure */}
              <div className="flex flex-col justify-between h-[180px] w-8 relative">
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 32 180" fill="none">
                  {/* Neon Glow Underlays */}
                  {isStageActive("planner") && (
                    <>
                      <path d="M0,90 Q16,90 16,30 L32,30" stroke="#8B5CF6" strokeWidth="4" className="opacity-30 blur-[2px]" />
                      <path d="M0,90 L32,90" stroke="#8B5CF6" strokeWidth="4" className="opacity-30 blur-[2px]" />
                      <path d="M0,90 Q16,90 16,150 L32,150" stroke="#8B5CF6" strokeWidth="4" className="opacity-30 blur-[2px]" />
                    </>
                  )}
                  {/* Core lines */}
                  <path
                    d="M0,90 Q16,90 16,30 L32,30"
                    stroke={isStageActive("planner") ? "#8B5CF6" : "rgba(255,255,255,0.06)"}
                    strokeWidth={isStageActive("planner") ? "2" : "1.5"}
                    strokeDasharray={isStageActive("planner") ? "5" : "0"}
                    className={isStageActive("planner") ? "animate-flow" : "transition-colors duration-300"}
                  />
                  <path
                    d="M0,90 L32,90"
                    stroke={isStageActive("planner") ? "#8B5CF6" : "rgba(255,255,255,0.06)"}
                    strokeWidth={isStageActive("planner") ? "2" : "1.5"}
                    strokeDasharray={isStageActive("planner") ? "5" : "0"}
                    className={isStageActive("planner") ? "animate-flow" : "transition-colors duration-300"}
                  />
                  <path
                    d="M0,90 Q16,90 16,150 L32,150"
                    stroke={isStageActive("planner") ? "#8B5CF6" : "rgba(255,255,255,0.06)"}
                    strokeWidth={isStageActive("planner") ? "2" : "1.5"}
                    strokeDasharray={isStageActive("planner") ? "5" : "0"}
                    className={isStageActive("planner") ? "animate-flow" : "transition-colors duration-300"}
                  />
                </svg>
              </div>

              {/* Researchers Column (Parallel Rows) */}
              <div className="flex flex-col gap-4">
                <AgentCard
                  icon="🔍"
                  name="Researcher A"
                  desc="Crawls the live web"
                  accent="#06B6D4"
                  isActive={isStageActive("researchers")}
                  onHover={() => handleHoverStage("researchers")}
                  onLeave={() => handleHoverStage(null)}
                />
                <AgentCard
                  icon="🔍"
                  name="Researcher B"
                  desc="Crawls the live web"
                  accent="#14B8A6"
                  isActive={isStageActive("researchers")}
                  onHover={() => handleHoverStage("researchers")}
                  onLeave={() => handleHoverStage(null)}
                />
                <AgentCard
                  icon="🔍"
                  name="Researcher C"
                  desc="Crawls the live web"
                  accent="#38BDF8"
                  isActive={isStageActive("researchers")}
                  onHover={() => handleHoverStage("researchers")}
                  onLeave={() => handleHoverStage(null)}
                />
              </div>

              {/* Connector from Researchers to Critic */}
              <div className="flex flex-col justify-between h-[180px] w-8 relative">
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 32 180" fill="none">
                  {/* Neon Glow Underlays */}
                  {isStageActive("researchers") && (
                    <>
                      <path d="M0,30 Q16,30 16,90 L32,90" stroke="#06B6D4" strokeWidth="4" className="opacity-30 blur-[2px]" />
                      <path d="M0,90 L32,90" stroke="#14B8A6" strokeWidth="4" className="opacity-30 blur-[2px]" />
                      <path d="M0,150 Q16,150 16,90 L32,90" stroke="#38BDF8" strokeWidth="4" className="opacity-30 blur-[2px]" />
                    </>
                  )}
                  {/* Core lines */}
                  <path
                    d="M0,30 Q16,30 16,90 L32,90"
                    stroke={isStageActive("researchers") ? "#06B6D4" : "rgba(255,255,255,0.06)"}
                    strokeWidth={isStageActive("researchers") ? "2" : "1.5"}
                    strokeDasharray={isStageActive("researchers") ? "5" : "0"}
                    className={isStageActive("researchers") ? "animate-flow" : "transition-colors duration-300"}
                  />
                  <path
                    d="M0,90 L32,90"
                    stroke={isStageActive("researchers") ? "#14B8A6" : "rgba(255,255,255,0.06)"}
                    strokeWidth={isStageActive("researchers") ? "2" : "1.5"}
                    strokeDasharray={isStageActive("researchers") ? "5" : "0"}
                    className={isStageActive("researchers") ? "animate-flow" : "transition-colors duration-300"}
                  />
                  <path
                    d="M0,150 Q16,150 16,90 L32,90"
                    stroke={isStageActive("researchers") ? "#38BDF8" : "rgba(255,255,255,0.06)"}
                    strokeWidth={isStageActive("researchers") ? "2" : "1.5"}
                    strokeDasharray={isStageActive("researchers") ? "5" : "0"}
                    className={isStageActive("researchers") ? "animate-flow" : "transition-colors duration-300"}
                  />
                </svg>
              </div>

              {/* Critic Card */}
              <AgentCard
                icon="⚔️"
                name="Critic"
                desc="Challenges every claim"
                accent="#F59E0B"
                isActive={isStageActive("critic")}
                onHover={() => handleHoverStage("critic")}
                onLeave={() => handleHoverStage(null)}
              />

              {/* Connector to Validator */}
              <div className="w-8 flex items-center justify-center">
                <svg width="32" height="10" viewBox="0 0 32 10" fill="none">
                  {isStageActive("critic") && (
                    <line x1="0" y1="5" x2="32" y2="5" stroke="#F59E0B" strokeWidth="4" className="opacity-30 blur-[2px]" />
                  )}
                  <line
                    x1="0"
                    y1="5"
                    x2="32"
                    y2="5"
                    stroke={isStageActive("critic") ? "#F59E0B" : "rgba(255,255,255,0.06)"}
                    strokeWidth={isStageActive("critic") ? "2" : "1.5"}
                    strokeDasharray={isStageActive("critic") ? "5" : "0"}
                    className={isStageActive("critic") ? "animate-flow" : "transition-colors duration-300"}
                  />
                </svg>
              </div>

              {/* Validator Card */}
              <AgentCard
                icon="✅"
                name="Validator"
                desc="Contradiction cross-checks"
                accent="#10B981"
                isActive={isStageActive("validator")}
                onHover={() => handleHoverStage("validator")}
                onLeave={() => handleHoverStage(null)}
              />

              {/* Connector to Writer */}
              <div className="w-8 flex items-center justify-center">
                <svg width="32" height="10" viewBox="0 0 32 10" fill="none">
                  {isStageActive("validator") && (
                    <line x1="0" y1="5" x2="32" y2="5" stroke="#10B981" strokeWidth="4" className="opacity-30 blur-[2px]" />
                  )}
                  <line
                    x1="0"
                    y1="5"
                    x2="32"
                    y2="5"
                    stroke={isStageActive("validator") ? "#10B981" : "rgba(255,255,255,0.06)"}
                    strokeWidth={isStageActive("validator") ? "2" : "1.5"}
                    strokeDasharray={isStageActive("validator") ? "5" : "0"}
                    className={isStageActive("validator") ? "animate-flow" : "transition-colors duration-300"}
                  />
                </svg>
              </div>

              {/* Writer Card */}
              <AgentCard
                icon="✍️"
                name="Writer"
                desc="Synthesizes output"
                accent="#E0FFFA"
                isActive={isStageActive("writer")}
                onHover={() => handleHoverStage("writer")}
                onLeave={() => handleHoverStage(null)}
              />

            </div>

            {/* Mobile Vertical Swarm Flow */}
            <div className="flex lg:hidden flex-col items-center gap-6 w-full max-w-sm">
              <AgentCard
                icon="🗺️"
                name="Planner"
                desc="Breaks question to tasks"
                accent="#8B5CF6"
                isActive={isStageActive("planner")}
                onHover={() => handleHoverStage("planner")}
                onLeave={() => handleHoverStage(null)}
              />

              <svg width="2" height="30" fill="none" className="overflow-visible">
                <line
                  x1="1"
                  y1="0"
                  x2="1"
                  y2="30"
                  stroke={isStageActive("planner") ? "#8B5CF6" : "rgba(255,255,255,0.06)"}
                  strokeWidth={isStageActive("planner") ? "2" : "1.5"}
                  strokeDasharray={isStageActive("planner") ? "4" : "0"}
                  className={isStageActive("planner") ? "animate-flow" : "transition-colors duration-300"}
                />
              </svg>

              <div className="flex flex-col gap-4 w-full">
                <AgentCard
                  icon="🔍"
                  name="Researcher A"
                  desc="Crawls the live web"
                  accent="#06B6D4"
                  isActive={isStageActive("researchers")}
                  onHover={() => handleHoverStage("researchers")}
                  onLeave={() => handleHoverStage(null)}
                />
                <AgentCard
                  icon="🔍"
                  name="Researcher B"
                  desc="Crawls the live web"
                  accent="#14B8A6"
                  isActive={isStageActive("researchers")}
                  onHover={() => handleHoverStage("researchers")}
                  onLeave={() => handleHoverStage(null)}
                />
                <AgentCard
                  icon="🔍"
                  name="Researcher C"
                  desc="Crawls the live web"
                  accent="#38BDF8"
                  isActive={isStageActive("researchers")}
                  onHover={() => handleHoverStage("researchers")}
                  onLeave={() => handleHoverStage(null)}
                />
              </div>

              <svg width="2" height="30" fill="none" className="overflow-visible">
                <line
                  x1="1"
                  y1="0"
                  x2="1"
                  y2="30"
                  stroke={isStageActive("researchers") ? "#06B6D4" : "rgba(255,255,255,0.06)"}
                  strokeWidth={isStageActive("researchers") ? "2" : "1.5"}
                  strokeDasharray={isStageActive("researchers") ? "4" : "0"}
                  className={isStageActive("researchers") ? "animate-flow" : "transition-colors duration-300"}
                />
              </svg>

              <AgentCard
                icon="⚔️"
                name="Critic"
                desc="Challenges every claim"
                accent="#F59E0B"
                isActive={isStageActive("critic")}
                onHover={() => handleHoverStage("critic")}
                onLeave={() => handleHoverStage(null)}
              />

              <svg width="2" height="30" fill="none" className="overflow-visible">
                <line
                  x1="1"
                  y1="0"
                  x2="1"
                  y2="30"
                  stroke={isStageActive("critic") ? "#F59E0B" : "rgba(255,255,255,0.06)"}
                  strokeWidth={isStageActive("critic") ? "2" : "1.5"}
                  strokeDasharray={isStageActive("critic") ? "4" : "0"}
                  className={isStageActive("critic") ? "animate-flow" : "transition-colors duration-300"}
                />
              </svg>

              <AgentCard
                icon="✅"
                name="Validator"
                desc="Contradiction cross-checks"
                accent="#10B981"
                isActive={isStageActive("validator")}
                onHover={() => handleHoverStage("validator")}
                onLeave={() => handleHoverStage(null)}
              />

              <svg width="2" height="30" fill="none" className="overflow-visible">
                <line
                  x1="1"
                  y1="0"
                  x2="1"
                  y2="30"
                  stroke={isStageActive("validator") ? "#10B981" : "rgba(255,255,255,0.06)"}
                  strokeWidth={isStageActive("validator") ? "2" : "1.5"}
                  strokeDasharray={isStageActive("validator") ? "4" : "0"}
                  className={isStageActive("validator") ? "animate-flow" : "transition-colors duration-300"}
                />
              </svg>

              <AgentCard
                icon="✍️"
                name="Writer"
                desc="Synthesizes output"
                accent="#E0FFFA"
                isActive={isStageActive("writer")}
                onHover={() => handleHoverStage("writer")}
                onLeave={() => handleHoverStage(null)}
              />
            </div>

            {/* Simulation Controls & Console Output */}
            <div className="w-full max-w-4xl mt-12 p-6 border border-border-subtle bg-[#0C0C16]/50 backdrop-blur-md rounded-2xl flex flex-col md:flex-row items-center justify-between gap-5 relative overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.5)] z-20">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,170,0,0.01),transparent_50%)] pointer-events-none" />
              
              <div className="flex flex-col gap-2 text-left flex-1 w-full">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${simStage !== "idle" ? "bg-accent-cyan animate-pulse shadow-[0_0_8px_#FFAA00]" : "bg-text-muted"}`} />
                  <span className="font-mono text-[10px] text-text-secondary uppercase tracking-widest font-extrabold">SWARM SIMULATOR FEED</span>
                </div>
                <div className="font-mono text-xs leading-relaxed min-h-[48px] bg-bg-base/70 p-3 rounded-xl border border-border-subtle/50 flex items-center">
                  <span className={simStage !== "idle" ? "text-accent-cyan" : "text-text-secondary"}>{simLog}</span>
                </div>
              </div>

              <button
                onClick={startPipelineSimulation}
                disabled={simStage !== "idle"}
                className={`px-6 py-3 rounded-xl font-mono text-xs tracking-wider font-extrabold transition-all shrink-0 w-full md:w-auto flex items-center justify-center gap-2 cursor-pointer ${
                  simStage !== "idle"
                    ? "bg-[#141424] border border-border-subtle text-text-muted cursor-not-allowed"
                    : "bg-accent-cyan text-[#08080F] border border-accent-cyan shadow-[0_0_15px_rgba(255,170,0,0.2)] hover:shadow-[0_0_25px_rgba(255,170,0,0.4)] active:scale-95 hover:scale-[1.02]"
                }`}
              >
                <span>{simStage !== "idle" ? "⚡ PROCESSING RUN" : "⚡ SIMULATE PIPELINE FLOW"}</span>
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* 3. SECTION 3: THE CONFIDENCE DIFFERENCE */}
      <section id="confidence-difference" className="relative w-full py-28 z-10 bg-bg-base">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

            {/* Left Column Text */}
            <div className="lg:col-span-6 flex flex-col">
              <span className="font-mono text-xs text-accent-cyan tracking-widest uppercase mb-4 block">
                ADVERSARIAL REDUNDANCY
              </span>
              <h2 className="font-display font-extrabold text-4xl sm:text-5xl text-[#F0F0FF] mb-6 leading-tight">
                AI that tells you what it doesn&apos;t know.
              </h2>
              <p className="font-sans text-text-secondary text-base leading-relaxed">
                Most AI tools give you a confident answer, even when they hallucinate. NEXUS runs an adversarial debate between agents — and tells you exactly which insights are solid, which are uncertain, and which are contested. Built for decisions that matter.
              </p>
            </div>

            {/* Right Column Mock Card Preview */}
            <div className="lg:col-span-6 flex justify-center">
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-md p-6 rounded-2xl border border-accent-cyan/15 bg-bg-surface/50 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.05)] backdrop-blur-md relative"
              >
                {/* Accent glows */}
                <div className="absolute -top-3 -right-3 w-16 h-16 rounded-full bg-accent-cyan/10 blur-[15px]" />

                {/* Mock Insight 1 (High Confidence) */}
                <div className="flex flex-col gap-2.5 pb-5 border-b border-border-subtle">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-900/30 text-confidence-high">
                      🟢 HIGH CONFIDENCE
                    </span>
                  </div>
                  <p className="font-sans text-xs text-text-primary leading-normal italic">
                    &ldquo;Indian SME SaaS market projected to grow 38% YoY through 2027, driven by GST compliance tooling demand.&rdquo;
                  </p>
                  <div className="flex items-center gap-4 font-mono text-[9px] text-text-muted">
                    <span>Sources: 3</span>
                    <span>•</span>
                    <span>Agents agreed: 6/7</span>
                  </div>
                </div>

                {/* Mock Insight 2 (Contested) */}
                <div className="flex flex-col gap-2.5 pt-5 relative rounded-xl border border-accent-amber/20 bg-accent-amber/[0.02] p-4 mt-4 shadow-[0_0_15px_rgba(245,158,11,0.04)] animate-[amberGlow_3s_infinite_ease-in-out]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] font-bold tracking-wider px-2 py-0.5 rounded bg-amber-950/40 border border-amber-900/30 text-accent-amber">
                      🔴 CONTESTED
                    </span>
                  </div>
                  <p className="font-sans text-xs text-text-primary leading-normal italic">
                    &ldquo;Customer acquisition costs below ₹2,000 per SME are achievable in Tier-2 cities.&rdquo;
                  </p>
                  <div className="flex items-center gap-2 font-mono text-[9px] text-confidence-contested bg-red-950/20 border border-red-900/30 px-2 py-1 rounded">
                    <span>⚔️</span>
                    <span>Critic: &ldquo;Evidence is from 2022 data only&rdquo;</span>
                  </div>
                  <div className="flex items-center gap-4 font-mono text-[9px] text-text-muted mt-1">
                    <span>Sources: 2</span>
                    <span>•</span>
                    <span>Agents disagreed: Critic</span>
                  </div>
                </div>

              </motion.div>
            </div>

          </div>
        </div>
      </section>

      {/* 4. FINAL CTA SECTION */}
      <section className="relative w-full py-32 z-10 overflow-hidden bg-gradient-to-b from-[#08080F] to-[#0A0A17]">

        {/* Large radial cyan glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-accent-cyan/10 blur-[160px] rounded-full pointer-events-none z-0" />

        <div className="relative z-10 w-full max-w-4xl mx-auto px-4 text-center">
          <h2 className="font-display font-extrabold text-4xl sm:text-6xl tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-r from-accent-cyan via-[#F0F0FF] to-accent-purple mb-6">
            Ready to unleash the swarm?
          </h2>
          <p className="font-sans text-text-secondary text-base sm:text-lg mb-10 max-w-sm mx-auto">
            First 3 queries free. Sign up today.
          </p>

          <button
            onClick={() => {
              if (authenticated) {
                window.scrollTo({ top: 0, behavior: "smooth" });
                setTimeout(() => {
                  textareaRef.current?.focus();
                }, 300);
              } else {
                router.push("/auth");
              }
            }}
            className="relative h-14 px-8 rounded-full overflow-hidden font-sans font-bold text-sm tracking-wide text-[#08080F] bg-gradient-to-r from-accent-cyan to-[#FF5E00] shadow-[0_0_30px_rgba(255,170,0,0.3)] hover:shadow-[0_0_40px_rgba(255,170,0,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all group cursor-pointer"
          >
            {/* Shimmer sweep */}
            <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white/30 opacity-40 group-hover:animate-[shimmer_0.8s_ease-out]" />

            <span className="relative z-10 flex items-center gap-2">
              Run Your First Query
              <ArrowRight size={16} className="text-[#08080F]" />
            </span>
          </button>
        </div>

      </section>

      {/* 5. FOOTER */}
      <footer className="relative w-full text-center py-8 border-t border-border-subtle text-[10px] font-mono text-text-muted z-10 bg-[#08080F]">
        NEXUS ADVERSARIAL SWARM ENGINE v1.0 • SECURE RUNS • WORKSPACE ACTIVE
      </footer>

      {/* Global Embedded Styles */}
      <style jsx global>{`
        @keyframes amberGlow {
          0%, 100% { border-color: rgba(245, 158, 11, 0.2); box-shadow: 0 0 15px rgba(245, 158, 11, 0.02); }
          50% { border-color: rgba(245, 158, 11, 0.4); box-shadow: 0 0 25px rgba(245, 158, 11, 0.1); }
        }
        @keyframes shimmer {
          0% { left: -100%; }
          100% { left: 200%; }
        }
        @keyframes dash-flow {
          to {
            stroke-dashoffset: -20;
          }
        }
        .animate-flow {
          stroke-dasharray: 4;
          animation: dash-flow 0.8s infinite linear;
        }
        path, line {
          transition: stroke 0.4s ease, stroke-width 0.4s ease, filter 0.4s ease, opacity 0.4s ease;
        }
      `}</style>

    </div>
  );
}

// Agent Card component for pipeline drawing
function AgentCard({
  icon,
  name,
  desc,
  accent,
  isActive,
  onHover,
  onLeave
}: {
  icon: string;
  name: string;
  desc: string;
  accent: string;
  isActive?: boolean;
  onHover?: () => void;
  onLeave?: () => void;
}) {
  return (
    <motion.div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      whileHover={{ y: -6, borderColor: accent }}
      animate={isActive ? {
        borderColor: accent,
        boxShadow: `0 0 25px ${accent}33, inset 0 0 10px ${accent}15`,
        scale: 1.03
      } : {
        borderColor: "rgba(255, 255, 255, 0.06)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        scale: 1
      }}
      transition={{ duration: 0.3 }}
      className="w-[160px] h-[190px] p-4 rounded-xl border bg-bg-surface flex flex-col justify-between text-center select-none cursor-pointer relative transition-all duration-300"
    >
      {/* High-tech glow point */}
      {isActive && (
        <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full animate-pulse" style={{ backgroundColor: accent, boxShadow: `0 0 8px ${accent}` }} />
      )}

      <div className="flex flex-col items-center gap-1.5 mt-1">
        <div className="w-11 h-11 rounded-full bg-bg-base flex items-center justify-center text-lg border border-border-subtle relative transition-all" style={{ borderColor: isActive ? accent : "rgba(255, 255, 255, 0.06)" }}>
          <span>{icon}</span>
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-bg-surface" style={{ backgroundColor: accent }} />
        </div>
        <span className="font-mono text-[10px] tracking-wider font-extrabold text-text-primary uppercase mt-2">
          {name}
        </span>
      </div>
      <p className="font-sans text-[11px] text-text-secondary leading-normal">
        {desc}
      </p>
    </motion.div>
  );
}
