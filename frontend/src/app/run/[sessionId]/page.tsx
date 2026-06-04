/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Terminal, Cpu, Share2, Download, AlertTriangle, CheckCircle, Flame, FileText, Globe } from "lucide-react";
import axios from "axios";

interface EventLog {
  timestamp: string;
  agent: string;
  message: string;
  data: any;
}

export default function SwarmRun() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  // Session State
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("pending");
  const [confidence, setConfidence] = useState(0);
  const [report, setReport] = useState<any>(null);
  const [findings, setFindings] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [logs, setLogs] = useState<EventLog[]>([]);

  // UI state
  const [activeTab, setActiveTab] = useState("terminal"); // "terminal" | "graph" | "report"
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Bioluminescent firefly background animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const fireflies: any[] = [];
    const count = 75;
    const colors = [
      "rgba(255, 170, 0, ",  // Warm amber-orange
      "rgba(255, 215, 0, ",  // Neon gold
      "rgba(224, 255, 0, "   // Yellow-green glow
    ];
    
    for (let i = 0; i < count; i++) {
      fireflies.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 1.8 + 0.8,
        pulseSpeed: 0.02 + Math.random() * 0.03,
        pulseOffset: Math.random() * Math.PI * 2,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }

    let time = 0;
    let animationId: number;

    const animate = () => {
      time += 0.015;
      ctx.clearRect(0, 0, width, height);

      fireflies.forEach((ff) => {
        ff.x += ff.vx;
        ff.y += ff.vy;

        // Wrap boundaries
        if (ff.x < 0) ff.x = width;
        if (ff.x > width) ff.x = 0;
        if (ff.y < 0) ff.y = height;
        if (ff.y > height) ff.y = 0;

        const pulse = 1.0 + Math.sin(time * ff.pulseSpeed + ff.pulseOffset) * 0.4;
        const rad = ff.radius * pulse;

        // Draw radial glow
        const grad = ctx.createRadialGradient(ff.x, ff.y, 0, ff.x, ff.y, rad * 4);
        grad.addColorStop(0, "#FFFFFF");
        grad.addColorStop(0.15, `${ff.color}0.7)`);
        grad.addColorStop(0.4, `${ff.color}0.2)`);
        grad.addColorStop(1, "rgba(0,0,0,0)");

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(ff.x, ff.y, rad * 4, 0, Math.PI * 2);
        ctx.fill();
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  // Fetch initial details and connect SSE
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/auth");
      return;
    }

    const apiURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    const fetchSession = async () => {
      try {
        const res = await axios.get(`${apiURL}/sessions/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setQuery(res.data.query_text);
        setStatus(res.data.status);
        setConfidence(res.data.confidence_score);
        setFindings(res.data.findings || []);
        setSources(res.data.sources || []);
        setReport(res.data.report);
        setLogs(res.data.agent_events || []);
      } catch (err) {
        console.error("Could not fetch session info:", err);
      }
    };

    fetchSession();

    // Connect SSE Event Stream
    const eventSource = new EventSource(`${apiURL}/sessions/${sessionId}/stream`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "log") {
        setLogs((prev) => {
          // Prevent duplicates
          if (prev.some((l) => l.timestamp === data.event.timestamp && l.agent === data.event.agent)) {
            return prev;
          }
          return [...prev, data.event];
        });
      } else if (data.type === "status") {
        setStatus(data.status);
        fetchSession(); // Refetch complete report
        eventSource.close(); // Cleanly close connection to prevent EventSource from auto-reconnecting
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE stream error:", err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [sessionId, router]);

  // Scroll to bottom of terminal
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Share session link
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Export report to PDF
  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const element = document.getElementById("report-export-target");
      if (!element) {
        console.error("Export element not found");
        return;
      }
      const opt = {
        margin: 1,
        filename: `NEXUS-Report-${sessionId.slice(0, 8)}.pdf`,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#08080f" },
        jsPDF: { unit: "in", format: "letter", orientation: "portrait" as const }
      };
      await html2pdf().from(element).set(opt).save();
    } catch (err) {
      console.error("PDF Export error:", err);
    } finally {
      setExporting(false);
    }
  };

  // SVG Multi-Agent Nodes list
  const agents = [
    { name: "Planner", id: "planner", color: "#FFAA00", desc: "Orchestrating search tasks" },
    { name: "Researcher Alpha", id: "researcher_a", color: "#F59E0B", desc: "Tavily web crawler A" },
    { name: "Researcher Beta", id: "researcher_b", color: "#EAB308", desc: "Tavily web crawler B" },
    { name: "Researcher Gamma", id: "researcher_c", color: "#FBBF24", desc: "Tavily web crawler C" },
    { name: "Critic", id: "critic", color: "#FF5E00", desc: "Adversarial factual spotter" },
    { name: "Validator", id: "validator", color: "#F97316", desc: "Trust & scoring model" },
    { name: "Reconciler", id: "reconciler", color: "#FEF08A", desc: "Report synth & localization" }
  ];

  // Helper to determine agent activation glow
  const isAgentActive = (agentId: string) => {
    if (status === "complete") return false;
    if (status === "pending" && agentId === "planner") return true;

    const activeLog = logs[logs.length - 1];
    if (!activeLog) return false;
    const currentAgent = activeLog.agent.toLowerCase();

    if (currentAgent.includes("planner") && agentId === "planner") return true;
    if (currentAgent.includes("alpha") && agentId === "researcher_a") return true;
    if (currentAgent.includes("beta") && agentId === "researcher_b") return true;
    if (currentAgent.includes("gamma") && agentId === "researcher_c") return true;
    if (currentAgent.includes("critic") && agentId === "critic") return true;
    if (currentAgent.includes("validator") && agentId === "validator") return true;
    if (currentAgent.includes("reconciler") && agentId === "reconciler") return true;

    return false;
  };

  const renderMarkdown = (markdown: string) => {
    if (!markdown) return null;
    
    const lines = markdown.split("\n");
    const elements: React.ReactNode[] = [];
    
    const parseInline = (text: string) => {
      const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
      return parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="font-bold text-accent-cyan">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return <code key={i} className="bg-bg-raised px-1.5 py-0.5 rounded font-mono text-xs text-accent-cyan border border-border-subtle">{part.slice(1, -1)}</code>;
        }
        return part;
      });
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed === "---") {
        elements.push(<hr key={`hr-${i}`} className="my-6 border-border-subtle/50" />);
        continue;
      }

      if (trimmed.startsWith("# ")) {
        elements.push(
          <h1 key={`h1-${i}`} className="text-2xl sm:text-3xl font-display font-bold mt-8 mb-4 text-[#F0F0FF] border-b border-border-subtle/30 pb-2 tracking-wide">
            {parseInline(trimmed.slice(2))}
          </h1>
        );
        continue;
      }

      if (trimmed.startsWith("## ")) {
        elements.push(
          <h2 key={`h2-${i}`} className="text-xl sm:text-2xl font-display font-semibold mt-6 mb-3 text-accent-cyan tracking-wide">
            {parseInline(trimmed.slice(3))}
          </h2>
        );
        continue;
      }

      if (trimmed.startsWith("### ")) {
        elements.push(
          <h3 key={`h3-${i}`} className="text-lg sm:text-xl font-display font-semibold mt-4 mb-2 text-[#E8E8F0] tracking-wide">
            {parseInline(trimmed.slice(4))}
          </h3>
        );
        continue;
      }

      if (trimmed.startsWith("> ")) {
        const content = trimmed.slice(2);
        const alertMatch = content.match(/^\[!(IMPORTANT|NOTE|WARNING|TIP|CAUTION)\]/i);
        if (alertMatch) {
          const alertType = alertMatch[1].toUpperCase();
          const innerText = content.replace(alertMatch[0], "").trim();
          let borderClass = "border-accent-cyan bg-accent-cyan/5 text-accent-cyan";
          if (alertType === "IMPORTANT" || alertType === "WARNING" || alertType === "CAUTION") {
            borderClass = "border-accent-purple bg-accent-purple/5 text-accent-purple";
          }
          elements.push(
            <div key={`alert-${i}`} className={`my-4 p-4 border-l-4 rounded-r-xl ${borderClass} font-sans text-sm`}>
              {parseInline(innerText)}
            </div>
          );
        } else {
          elements.push(
            <blockquote key={`bq-${i}`} className="my-4 pl-4 border-l-4 border-accent-cyan/50 italic text-text-secondary leading-relaxed bg-bg-surface/30 py-1 pr-2 rounded-r">
              {parseInline(content)}
            </blockquote>
          );
        }
        continue;
      }

      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        elements.push(
          <li key={`ul-li-${i}`} className="ml-6 list-disc mb-1.5 text-text-primary pl-1">
            {parseInline(trimmed.slice(2))}
          </li>
        );
        continue;
      }

      const olMatch = trimmed.match(/^(\d+)\.\s(.*)/);
      if (olMatch) {
        elements.push(
          <li key={`ol-li-${i}`} className="ml-6 list-decimal mb-1.5 text-text-primary pl-1">
            {parseInline(olMatch[2])}
          </li>
        );
        continue;
      }

      if (!trimmed) {
        elements.push(<div key={`empty-${i}`} className="h-3" />);
        continue;
      }

      elements.push(
        <p key={`p-${i}`} className="mb-3 text-text-primary leading-relaxed text-sm sm:text-base">
          {parseInline(trimmed)}
        </p>
      );
    }

    return elements;
  };

  return (
    <div className="relative min-h-screen bg-[#08080F] text-text-primary flex flex-col justify-between overflow-x-hidden">

      {/* Bioluminescent canvas background */}
      <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none opacity-50" />

      {/* Header */}
      <header className="relative w-full max-w-6xl mx-auto flex items-center justify-between py-4 px-4 sm:px-6 border-b border-border-subtle z-10">
        <div className="flex items-center gap-3">
          <button
            aria-label="button"
            onClick={() => router.push("/")}
            className="p-2 border border-border-subtle rounded-lg bg-bg-surface text-text-secondary hover:text-accent-cyan hover:border-accent-cyan/40 transition-all cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <span className="font-mono text-[10px] text-text-secondary block">ACTIVE PIPELINE RUN</span>
            <span className="font-display font-bold text-sm tracking-wide uppercase text-text-primary">
              SESSION: {sessionId.slice(0, 8)}
            </span>
          </div>
        </div>

        {/* Global Pipeline Indicators */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 font-mono text-xs">
            <span className="text-text-secondary">Global State:</span>
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${
              status === "complete" 
                ? "border-accent-cyan text-accent-cyan bg-accent-cyan/5 shadow-[0_0_10px_rgba(255,170,0,0.1)]" 
                : (status === "failed" 
                  ? "border-accent-purple text-accent-purple bg-accent-purple/5" 
                  : "border-accent-amber text-accent-amber bg-accent-amber/5 animate-pulse")
              }`}>
              {status.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="p-2 border border-border-subtle rounded-lg bg-bg-surface text-text-secondary hover:text-accent-cyan hover:border-accent-cyan/30 transition-all cursor-pointer"
              title="Copy session link"
            >
              <Share2 size={16} />
            </button>

            {status === "complete" && (
              <button
                onClick={handleExportPDF}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent-cyan bg-bg-surface text-accent-cyan text-xs font-mono hover:bg-accent-cyan/15 hover:shadow-[0_0_12px_rgba(255,170,0,0.12)] transition-all cursor-pointer"
              >
                <Download size={14} />
                {exporting ? "EXPORTING..." : "EXPORT PDF"}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Layout Grid */}
      <main className="relative flex-1 w-full max-w-6xl mx-auto p-4 sm:p-6 z-10">

        {/* Active Query Banner */}
        <div className="w-full border border-accent-cyan/15 bg-bg-surface p-4 rounded-xl mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[0_0_15px_rgba(255,170,0,0.04)]">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full border border-accent-cyan flex items-center justify-center text-xs font-mono bg-bg-base text-accent-cyan shrink-0">⬡</div>
            <p className="font-sans text-sm sm:text-base leading-relaxed text-text-primary italic">&ldquo;{query}&rdquo;</p>
          </div>
          {status === "complete" && (
            <div className="font-mono text-xs text-right bg-bg-base border border-border-subtle px-3 py-1.5 rounded-lg shrink-0 w-full sm:w-auto">
              <span className="text-text-secondary">Confidence Score: </span>
              <span className="text-accent-cyan font-bold">{confidence}%</span>
            </div>
          )}
        </div>

        {/* Global Notifications */}
        {copied && (
          <div className="w-full mb-4 text-center text-xs font-mono text-accent-cyan bg-accent-cyan/5 border border-accent-cyan/15 py-2 rounded-xl">
            ✓ Session share URL copied to clipboard successfully!
          </div>
        )}

        {/* Mobile Swipeable Tab Selector (<1024px Viewports) */}
        <div className="lg:hidden flex border-b border-border-subtle mb-6 gap-2">
          <button
            onClick={() => setActiveTab("terminal")}
            className={`flex-1 pb-3 text-xs font-mono text-center border-b-2 transition-all cursor-pointer ${activeTab === "terminal" ? "border-accent-cyan text-text-primary" : "border-transparent text-text-secondary"
              }`}
          >
            Terminal Feed
          </button>
          <button
            onClick={() => setActiveTab("graph")}
            className={`flex-1 pb-3 text-xs font-mono text-center border-b-2 transition-all cursor-pointer ${activeTab === "graph" ? "border-accent-cyan text-text-primary" : "border-transparent text-text-secondary"
              }`}
          >
            Swarm Map
          </button>
          <button
            onClick={() => setActiveTab("report")}
            className={`flex-1 pb-3 text-xs font-mono text-center border-b-2 transition-all cursor-pointer ${activeTab === "report" ? "border-accent-cyan text-text-primary" : "border-transparent text-text-secondary"
              }`}
          >
            Report Synthesized
          </button>
        </div>

        {/* Multi-Service Grid Panels (Desktop View: Side by Side) */}
        {/* Monitoring Dashboard Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mb-6">

          {/* Terminal logs panel */}
          <div className={`col-span-1 lg:col-span-6 border border-border-subtle bg-bg-surface rounded-xl flex flex-col h-[28rem] overflow-hidden ${activeTab !== "terminal" ? "hidden lg:flex" : ""}`}>
            <div className="border-b border-border-subtle bg-bg-raised/40 px-4 py-3 flex items-center gap-2">
              <Terminal size={14} className="text-accent-cyan" />
              <span className="font-mono text-xs text-accent-cyan uppercase">Live Swarm Log Streams</span>
            </div>
            <div className="flex-1 p-4 overflow-y-auto font-mono text-xs flex flex-col gap-2.5 bg-bg-base/30 scroll-smooth">
              {logs.length === 0 ? (
                <div className="text-text-secondary animate-pulse">Waiting for swarm startup triggers...</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="flex flex-col gap-1 border-b border-border-subtle/25 pb-2">
                    <div className="flex items-center justify-between text-[10px] text-text-muted">
                      <span className="uppercase" style={{ color: agents.find(a => a.name.toLowerCase().includes(log.agent.toLowerCase().split(" ")[0]))?.color || "#FFAA00" }}>
                        {log.agent}
                      </span>
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-text-primary leading-relaxed">{log.message}</p>
                  </div>
                ))
              )}
              <div ref={terminalEndRef}></div>
            </div>
          </div>

          {/* SVG Swarm Node Graph Map */}
          <div className={`col-span-1 lg:col-span-6 border border-border-subtle bg-bg-surface rounded-xl p-6 flex flex-col items-center justify-between h-[28rem] overflow-hidden ${activeTab !== "graph" ? "hidden lg:flex" : ""}`}>
            <div className="w-full text-left border-b border-border-subtle/50 pb-3">
              <span className="font-mono text-xs text-text-secondary block">SWARM TOPOLOGY STATE</span>
              <span className="font-display font-semibold text-sm">7 Specialized Adversarial Nodes</span>
            </div>

            {/* Responsive SVG Map canvas */}
            <div className="relative w-full flex-1 flex items-center justify-center py-2">
              <svg className="w-full h-full max-h-[290px]" viewBox="0 0 400 320">
                {/* SVG connection path glow overlays */}
                <g strokeWidth="4.5" fill="none" className="opacity-25 blur-[2.5px]">
                  {isAgentActive("planner") && (
                    <>
                      <line x1="200" y1="30" x2="80" y2="100" stroke="#FFAA00" />
                      <line x1="200" y1="30" x2="200" y2="100" stroke="#FFAA00" />
                      <line x1="200" y1="30" x2="320" y2="100" stroke="#FFAA00" />
                    </>
                  )}
                  {isAgentActive("researcher_a") && <line x1="80" y1="100" x2="200" y2="170" stroke="#F59E0B" />}
                  {isAgentActive("researcher_b") && <line x1="200" y1="100" x2="200" y2="170" stroke="#EAB308" />}
                  {isAgentActive("researcher_c") && <line x1="320" y1="100" x2="200" y2="170" stroke="#FBBF24" />}
                  {isAgentActive("critic") && <line x1="200" y1="170" x2="200" y2="230" stroke="#FF5E00" />}
                  {isAgentActive("validator") && <line x1="200" y1="230" x2="200" y2="290" stroke="#F97316" />}
                </g>

                {/* Connection paths */}
                <g strokeWidth="1.8" fill="none">
                  {/* Planner to Researchers */}
                  <line
                    x1="200"
                    y1="30"
                    x2="80"
                    y2="100"
                    className={isAgentActive("planner") ? "animate-flow" : ""}
                    stroke={isAgentActive("planner") ? "#FFAA00" : "rgba(255, 255, 255, 0.05)"}
                  />
                  <line
                    x1="200"
                    y1="30"
                    x2="200"
                    y2="100"
                    className={isAgentActive("planner") ? "animate-flow" : ""}
                    stroke={isAgentActive("planner") ? "#FFAA00" : "rgba(255, 255, 255, 0.05)"}
                  />
                  <line
                    x1="200"
                    y1="30"
                    x2="320"
                    y2="100"
                    className={isAgentActive("planner") ? "animate-flow" : ""}
                    stroke={isAgentActive("planner") ? "#FFAA00" : "rgba(255, 255, 255, 0.05)"}
                  />

                  {/* Researchers to Critic */}
                  <line
                    x1="80"
                    y1="100"
                    x2="200"
                    y2="170"
                    className={isAgentActive("researcher_a") ? "animate-flow" : ""}
                    stroke={isAgentActive("researcher_a") ? "#F59E0B" : "rgba(255, 255, 255, 0.05)"}
                  />
                  <line
                    x1="200"
                    y1="100"
                    x2="200"
                    y2="170"
                    className={isAgentActive("researcher_b") ? "animate-flow" : ""}
                    stroke={isAgentActive("researcher_b") ? "#EAB308" : "rgba(255, 255, 255, 0.05)"}
                  />
                  <line
                    x1="320"
                    y1="100"
                    x2="200"
                    y2="170"
                    className={isAgentActive("researcher_c") ? "animate-flow" : ""}
                    stroke={isAgentActive("researcher_c") ? "#FBBF24" : "rgba(255, 255, 255, 0.05)"}
                  />

                  {/* Critic to Validator */}
                  <line
                    x1="200"
                    y1="170"
                    x2="200"
                    y2="230"
                    className={isAgentActive("critic") ? "animate-flow" : ""}
                    stroke={isAgentActive("critic") ? "#FF5E00" : "rgba(255, 255, 255, 0.05)"}
                  />

                  {/* Validator to Reconciler */}
                  <line
                    x1="200"
                    y1="230"
                    x2="200"
                    y2="290"
                    className={isAgentActive("validator") ? "animate-flow" : ""}
                    stroke={isAgentActive("validator") ? "#F97316" : "rgba(255, 255, 255, 0.05)"}
                  />
                </g>

                {/* Nodes with custom active drop-shadow filters */}
                {/* Planner Node */}
                <circle
                  cx="200"
                  cy="30"
                  r="15"
                  fill="#08080f"
                  stroke={isAgentActive("planner") ? "#FFAA00" : "rgba(255, 255, 255, 0.1)"}
                  strokeWidth="2"
                  style={{ filter: isAgentActive("planner") ? "drop-shadow(0 0 10px rgba(255, 170, 0, 0.5))" : "none", transition: "all 0.3s" }}
                />
                <text x="200" y="33.5" fill="#E8E8F0" fontSize="8" fontFamily="monospace" textAnchor="middle" className="select-none">PLN</text>

                {/* Researcher Nodes */}
                <circle
                  cx="80"
                  cy="100"
                  r="14"
                  fill="#08080f"
                  stroke={isAgentActive("researcher_a") ? "#F59E0B" : "rgba(255, 255, 255, 0.1)"}
                  strokeWidth="2"
                  style={{ filter: isAgentActive("researcher_a") ? "drop-shadow(0 0 10px rgba(245, 158, 11, 0.5))" : "none", transition: "all 0.3s" }}
                />
                <text x="80" y="103" fill="#E8E8F0" fontSize="8" fontFamily="monospace" textAnchor="middle" className="select-none">RS_A</text>

                <circle
                  cx="200"
                  cy="100"
                  r="14"
                  fill="#08080f"
                  stroke={isAgentActive("researcher_b") ? "#EAB308" : "rgba(255, 255, 255, 0.1)"}
                  strokeWidth="2"
                  style={{ filter: isAgentActive("researcher_b") ? "drop-shadow(0 0 10px rgba(234, 179, 8, 0.5))" : "none", transition: "all 0.3s" }}
                />
                <text x="200" y="103" fill="#E8E8F0" fontSize="8" fontFamily="monospace" textAnchor="middle" className="select-none">RS_B</text>

                <circle
                  cx="320"
                  cy="100"
                  r="14"
                  fill="#08080f"
                  stroke={isAgentActive("researcher_c") ? "#FBBF24" : "rgba(255, 255, 255, 0.1)"}
                  strokeWidth="2"
                  style={{ filter: isAgentActive("researcher_c") ? "drop-shadow(0 0 10px rgba(251, 191, 36, 0.5))" : "none", transition: "all 0.3s" }}
                />
                <text x="320" y="103" fill="#E8E8F0" fontSize="8" fontFamily="monospace" textAnchor="middle" className="select-none">RS_C</text>

                {/* Critic Node */}
                <circle
                  cx="200"
                  cy="170"
                  r="15"
                  fill="#08080f"
                  stroke={isAgentActive("critic") ? "#FF5E00" : "rgba(255, 255, 255, 0.1)"}
                  strokeWidth="2"
                  style={{ filter: isAgentActive("critic") ? "drop-shadow(0 0 10px rgba(255, 94, 0, 0.5))" : "none", transition: "all 0.3s" }}
                />
                <text x="200" y="173.5" fill="#E8E8F0" fontSize="8" fontFamily="monospace" textAnchor="middle" className="select-none">CRT</text>

                {/* Validator Node */}
                <circle
                  cx="200"
                  cy="230"
                  r="15"
                  fill="#08080f"
                  stroke={isAgentActive("validator") ? "#F97316" : "rgba(255, 255, 255, 0.1)"}
                  strokeWidth="2"
                  style={{ filter: isAgentActive("validator") ? "drop-shadow(0 0 10px rgba(249, 115, 22, 0.5))" : "none", transition: "all 0.3s" }}
                />
                <text x="200" y="233.5" fill="#E8E8F0" fontSize="8" fontFamily="monospace" textAnchor="middle" className="select-none">VAL</text>

                {/* Reconciler Node */}
                <circle
                  cx="200"
                  cy="290"
                  r="15"
                  fill="#08080f"
                  stroke={isAgentActive("reconciler") ? "#FEF08A" : "rgba(255, 255, 255, 0.1)"}
                  strokeWidth="2"
                  style={{ filter: isAgentActive("reconciler") ? "drop-shadow(0 0 10px rgba(254, 240, 138, 0.5))" : "none", transition: "all 0.3s" }}
                />
                <text x="200" y="293.5" fill="#E8E8F0" fontSize="8" fontFamily="monospace" textAnchor="middle" className="select-none">REC</text>
              </svg>
            </div>

            {/* Status Legend */}
            <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 pt-4 mt-2 border-t border-border-subtle/30 font-mono text-[9px] text-text-secondary">
              {agents.map((a) => (
                <div key={a.id} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color, boxShadow: isAgentActive(a.id) ? `0 0 8px ${a.color}` : "none", transition: "all 0.3s" }}></div>
                  <span className={`line-clamp-1 transition-colors ${isAgentActive(a.id) ? "text-accent-cyan font-bold" : ""}`}>{a.name.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Bottom Section: Synthesized Swarm Report */}
        <div className={`w-full border border-border-subtle bg-bg-surface rounded-xl overflow-hidden flex flex-col ${activeTab !== "report" ? "hidden lg:flex" : ""}`}>

          {/* Report title tab */}
          <div className="border-b border-border-subtle bg-bg-raised/40 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-accent-cyan" />
              <span className="font-mono text-xs text-accent-cyan uppercase">Synthesized Swarm Report</span>
            </div>
            {status !== "complete" && (
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-accent-purple animate-pulse bg-accent-purple/5 border border-accent-purple/20 px-2 py-0.5 rounded">
                <Flame size={10} className="shrink-0" />
                <span>SYNTHESIS IN PROGRESS...</span>
              </div>
            )}
          </div>

          {/* Report markdown document canvas */}
          <div className="p-6 bg-bg-base/15 leading-relaxed text-sm select-text">
            {status !== "complete" ? (
              <div className="py-20 flex flex-col items-center justify-center text-center p-6 gap-3">
                <Cpu size={32} className="text-accent-cyan animate-spin" />
                <h3 className="font-display font-semibold text-text-primary">Assembling Swarm Intelligence</h3>
                <p className="text-text-secondary text-xs max-w-sm">
                  Planner, Researchers (A/B/C), Critic, and Validator are processing findings. A localized deep report will render automatically when complete.
                </p>
              </div>
            ) : (
              <div id="report-export-target" className="prose prose-invert max-w-none text-text-primary font-sans">

                {/* Localized notification */}
                <div className="mb-6 flex items-center gap-2 text-accent-cyan font-mono text-xs bg-accent-cyan/5 border border-accent-cyan/20 px-3 py-2 rounded-lg">
                  <Globe size={14} />
                  <span>The report is translated and generated in the detected language.</span>
                </div>

                {/* PDF header details */}
                <div className="hidden pdf-only flex-col gap-2 border-b border-border-subtle pb-4 mb-6">
                  <span className="font-mono text-xs text-accent-cyan">NEXUS — ADVERSARIAL SWARM INTELLIGENCE SYSTEM</span>
                  <h1 className="text-2xl font-bold font-display">{query}</h1>
                  <span className="font-mono text-xs text-text-muted">Session: {sessionId} • Confidence: {confidence}%</span>
                </div>

                <div className="markdown-body font-sans text-text-primary text-sm sm:text-base leading-relaxed">
                  {renderMarkdown(report?.full_markdown)}
                </div>

                {/* Discovered findings sub-panel */}
                <div className="mt-8 pt-6 border-t border-border-subtle/50">
                  <h3 className="font-display font-semibold text-sm uppercase text-text-secondary mb-3">Validated Claims:</h3>
                  <div className="flex flex-col gap-2.5">
                    {findings.map((f, i) => (
                      <div key={i} className="p-3 border border-accent-cyan/15 bg-[#0E0E1A]/40 rounded-lg flex items-start gap-3">
                        <div className="mt-0.5 shrink-0">
                          {f.status === "high" && <CheckCircle size={14} className="text-accent-cyan" />}
                          {f.status === "medium" && <AlertTriangle size={14} className="text-accent-amber" />}
                          {f.status === "contested" && <AlertTriangle size={14} className="text-accent-purple" />}
                        </div>
                        <div>
                          <p className="text-xs text-text-primary leading-normal">{f.claim}</p>
                          <span className="font-mono text-[9px] text-text-secondary block mt-1 uppercase">Source: {f.agent}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Discovered references sub-panel */}
                <div className="mt-6">
                  <h3 className="font-display font-semibold text-sm uppercase text-text-secondary mb-3">Web Citations:</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {sources.map((s, i) => (
                      <a
                        key={i}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 border border-border-subtle/30 bg-bg-surface/30 rounded-lg hover:border-accent-cyan/30 hover:bg-bg-surface/60 transition-all block text-xs"
                      >
                        <span className="font-mono text-[9px] text-accent-cyan block mb-1 uppercase">{s.domain}</span>
                        <span className="font-sans font-semibold text-text-primary block line-clamp-1 hover:underline">{s.title || s.url}</span>
                        <p className="text-[10px] text-text-secondary mt-1 line-clamp-2 leading-relaxed">{s.snippet}</p>
                      </a>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative w-full max-w-6xl mx-auto text-center py-6 border-t border-border-subtle/30 text-xs font-mono text-text-muted z-10">
        NEXUS ADVERSARIAL SWARM ENGINE v1.0 • SECURE END-TO-END FLOWS
      </footer>
    </div>
  );
}
