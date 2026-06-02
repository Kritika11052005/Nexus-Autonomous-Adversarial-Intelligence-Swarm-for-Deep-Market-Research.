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

  // Fetch initial details and connect SSE
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
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
    { name: "Planner", id: "planner", color: "#8B5CF6", desc: "Orchestrating search tasks" },
    { name: "Researcher Alpha", id: "researcher_a", color: "#06B6D4", desc: "Tavily web crawler A" },
    { name: "Researcher Beta", id: "researcher_b", color: "#14B8A6", desc: "Tavily web crawler B" },
    { name: "Researcher Gamma", id: "researcher_c", color: "#38BDF8", desc: "Tavily web crawler C" },
    { name: "Critic", id: "critic", color: "#F59E0B", desc: "Adversarial factual spotter" },
    { name: "Validator", id: "validator", color: "#10B981", desc: "Trust & scoring model" },
    { name: "Reconciler", id: "reconciler", color: "#E0FFFA", desc: "Report synth & localization" }
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

  return (
    <div className="relative min-h-screen bg-bg-base text-text-primary flex flex-col justify-between overflow-hidden">

      {/* Bioluminescent floating particle */}
      <div className="absolute top-[30%] left-[20%] w-2 h-2 rounded-full bg-cyan-400 opacity-20 blur-[2px] animate-pulse"></div>

      {/* Header */}
      <header className="relative w-full max-w-6xl mx-auto flex items-center justify-between py-4 px-4 sm:px-6 border-b border-border-subtle z-10">
        <div className="flex items-center gap-3">
          <button
            aria-label="button"
            onClick={() => router.push("/")}
            className="p-2 border border-border-subtle rounded-lg bg-bg-surface text-text-secondary hover:text-text-primary hover:border-text-secondary transition-all cursor-pointer"
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
            <span className={`px-2 py-0.5 rounded-full border ${status === "complete" ? "border-confidence-high text-confidence-high" : (status === "failed" ? "border-confidence-contested text-confidence-contested" : "border-agent-planner text-agent-planner animate-pulse")
              }`}>
              {status.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="p-2 border border-border-subtle rounded-lg bg-bg-surface text-text-secondary hover:text-text-primary transition-all cursor-pointer"
              title="Copy session link"
            >
              <Share2 size={16} />
            </button>

            {status === "complete" && (
              <button
                onClick={handleExportPDF}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-confidence-high bg-bg-surface text-confidence-high text-xs font-mono hover:bg-confidence-high/15 transition-all cursor-pointer"
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
        <div className="w-full border border-border-subtle bg-bg-surface p-4 rounded-xl mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[0_0_12px_rgba(0,255,209,0.02)]">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full border border-agent-planner flex items-center justify-center text-xs font-mono bg-bg-base text-agent-planner shrink-0">⬡</div>
            <p className="font-sans text-sm sm:text-base leading-relaxed text-text-primary italic">&ldquo;{query}&rdquo;</p>
          </div>
          {status === "complete" && (
            <div className="font-mono text-xs text-right bg-bg-base border border-border-subtle px-3 py-1.5 rounded-lg shrink-0 w-full sm:w-auto">
              <span className="text-text-secondary">Confidence Score: </span>
              <span className="text-confidence-high font-bold">{confidence}%</span>
            </div>
          )}
        </div>

        {/* Global Notifications */}
        {copied && (
          <div className="w-full mb-4 text-center text-xs font-mono text-confidence-high bg-emerald-950/20 border border-emerald-900/30 py-2 rounded-xl">
            ✓ Session share URL copied to clipboard successfully!
          </div>
        )}

        {/* Mobile Swipeable Tab Selector (<1024px Viewports) */}
        <div className="lg:hidden flex border-b border-border-subtle mb-6 gap-2">
          <button
            onClick={() => setActiveTab("terminal")}
            className={`flex-1 pb-3 text-xs font-mono text-center border-b-2 transition-all cursor-pointer ${activeTab === "terminal" ? "border-agent-planner text-text-primary" : "border-transparent text-text-secondary"
              }`}
          >
            Terminal Feed
          </button>
          <button
            onClick={() => setActiveTab("graph")}
            className={`flex-1 pb-3 text-xs font-mono text-center border-b-2 transition-all cursor-pointer ${activeTab === "graph" ? "border-agent-planner text-text-primary" : "border-transparent text-text-secondary"
              }`}
          >
            Swarm Map
          </button>
          <button
            onClick={() => setActiveTab("report")}
            className={`flex-1 pb-3 text-xs font-mono text-center border-b-2 transition-all cursor-pointer ${activeTab === "report" ? "border-agent-planner text-text-primary" : "border-transparent text-text-secondary"
              }`}
          >
            Report Synthesized
          </button>
        </div>

        {/* Multi-Service Grid Panels (Desktop View: Side by Side) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Left panel: Terminals or Graph Maps */}
          <div className={`col-span-1 lg:col-span-6 flex flex-col gap-6 ${activeTab !== "terminal" && activeTab !== "graph" ? "hidden lg:flex" : ""}`}>

            {/* Terminal logs panel */}
            <div className={`border border-border-subtle bg-bg-surface rounded-xl flex flex-col h-[32rem] overflow-hidden ${activeTab === "graph" ? "hidden lg:flex" : ""}`}>
              <div className="border-b border-border-subtle bg-bg-raised/40 px-4 py-3 flex items-center gap-2">
                <Terminal size={14} className="text-text-code" />
                <span className="font-mono text-xs text-text-code uppercase">Live Swarm Log Streams</span>
              </div>
              <div className="flex-1 p-4 overflow-y-auto font-mono text-xs flex flex-col gap-2.5 bg-bg-base/30 scroll-smooth">
                {logs.length === 0 ? (
                  <div className="text-text-secondary animate-pulse">Waiting for swarm startup triggers...</div>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="flex flex-col gap-1 border-b border-border-subtle/25 pb-2">
                      <div className="flex items-center justify-between text-[10px] text-text-muted">
                        <span className="uppercase" style={{ color: agents.find(a => a.name.toLowerCase().includes(log.agent.toLowerCase().split(" ")[0]))?.color || "#8b5cf6" }}>
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
            <div className={`border border-border-subtle bg-bg-surface rounded-xl p-6 flex flex-col items-center justify-between h-[32rem] ${activeTab === "terminal" ? "hidden lg:flex" : ""}`}>
              <div className="w-full text-left border-b border-border-subtle/50 pb-3 mb-4">
                <span className="font-mono text-xs text-text-secondary block">SWARM TOPOLOGY STATE</span>
                <span className="font-display font-semibold text-sm">7 Specialized Adversarial Nodes</span>
              </div>

              {/* Responsive SVG Map canvas */}
              <div className="relative w-full flex-1 flex items-center justify-center">
                <svg className="w-full h-full min-h-[220px]" viewBox="0 0 400 320">
                  {/* Connection paths */}
                  <g stroke="#1E1E3A" strokeWidth="2">
                    <line x1="200" y1="50" x2="80" y2="120" className={isAgentActive("planner") || isAgentActive("researcher_a") ? "animate-flow" : ""} style={{ stroke: isAgentActive("planner") ? "#8b5cf6" : "#1e1e3a" }} />
                    <line x1="200" y1="50" x2="200" y2="120" className={isAgentActive("planner") || isAgentActive("researcher_b") ? "animate-flow" : ""} style={{ stroke: isAgentActive("planner") ? "#8b5cf6" : "#1e1e3a" }} />
                    <line x1="200" y1="50" x2="320" y2="120" className={isAgentActive("planner") || isAgentActive("researcher_c") ? "animate-flow" : ""} style={{ stroke: isAgentActive("planner") ? "#8b5cf6" : "#1e1e3a" }} />
                    <line x1="80" y1="120" x2="200" y2="200" className={isAgentActive("researcher_a") || isAgentActive("critic") ? "animate-flow" : ""} />
                    <line x1="200" y1="120" x2="200" y2="200" className={isAgentActive("researcher_b") || isAgentActive("critic") ? "animate-flow" : ""} />
                    <line x1="320" y1="120" x2="200" y2="200" className={isAgentActive("researcher_c") || isAgentActive("critic") ? "animate-flow" : ""} />
                    <line x1="200" y1="200" x2="200" y2="260" className={isAgentActive("critic") || isAgentActive("validator") ? "animate-flow" : ""} />
                  </g>

                  {/* Planner Node */}
                  <circle cx="200" cy="50" r="16" fill="#08080f" stroke={isAgentActive("planner") ? "#8b5cf6" : "#1e1e3a"} strokeWidth="2" className={isAgentActive("planner") ? "animate-glow" : ""} />
                  <text x="200" y="54" fill="#E8E8F0" fontSize="9" fontFamily="monospace" textAnchor="middle">PLN</text>

                  {/* Researcher Nodes */}
                  <circle cx="80" cy="120" r="14" fill="#08080f" stroke={isAgentActive("researcher_a") ? "#06B6D4" : "#1E1E3A"} strokeWidth="2" className={isAgentActive("researcher_a") ? "animate-glow" : ""} />
                  <text x="80" y="123" fill="#E8E8F0" fontSize="8" fontFamily="monospace" textAnchor="middle">RS_A</text>

                  <circle cx="200" cy="120" r="14" fill="#08080f" stroke={isAgentActive("researcher_b") ? "#14B8A6" : "#1E1E3A"} strokeWidth="2" className={isAgentActive("researcher_b") ? "animate-glow" : ""} />
                  <text x="200" y="123" fill="#E8E8F0" fontSize="8" fontFamily="monospace" textAnchor="middle">RS_B</text>

                  <circle cx="320" cy="120" r="14" fill="#08080f" stroke={isAgentActive("researcher_c") ? "#38BDF8" : "#1E1E3A"} strokeWidth="2" className={isAgentActive("researcher_c") ? "animate-glow" : ""} />
                  <text x="320" y="123" fill="#E8E8F0" fontSize="8" fontFamily="monospace" textAnchor="middle">RS_C</text>

                  {/* Critic Node */}
                  <circle cx="200" cy="200" r="16" fill="#08080f" stroke={isAgentActive("critic") ? "#F59E0B" : "#1E1E3A"} strokeWidth="2" className={isAgentActive("critic") ? "animate-glow" : ""} />
                  <text x="200" y="204" fill="#E8E8F0" fontSize="9" fontFamily="monospace" textAnchor="middle">CRT</text>

                  {/* Validator Node */}
                  <circle cx="200" cy="265" r="16" fill="#08080f" stroke={isAgentActive("validator") ? "#10B981" : "#1E1E3A"} strokeWidth="2" className={isAgentActive("validator") ? "animate-glow" : ""} />
                  <text x="200" y="269" fill="#E8E8F0" fontSize="9" fontFamily="monospace" textAnchor="middle">VAL</text>
                </svg>

                {/* Status Overlay */}
                <div className="absolute bottom-2 left-2 flex flex-col gap-1 font-mono text-[9px] text-text-secondary bg-bg-base/80 p-2 border border-border-subtle rounded">
                  {agents.map((a) => (
                    <div key={a.id} className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: a.color, boxShadow: isAgentActive(a.id) ? `0 0 6px ${a.color}` : "none" }}></div>
                      <span className={isAgentActive(a.id) ? "text-text-primary font-bold" : ""}>{a.name.toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right panel: Final markdown report */}
          <div className={`col-span-1 lg:col-span-6 flex flex-col gap-6 ${activeTab !== "report" ? "hidden lg:flex" : ""}`}>

            <div className="border border-border-subtle bg-bg-surface rounded-xl h-[32rem] overflow-hidden flex flex-col">

              {/* Report title tab */}
              <div className="border-b border-border-subtle bg-bg-raised/40 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-confidence-high" />
                  <span className="font-mono text-xs text-text-primary uppercase">Synthesized Swarm Report</span>
                </div>
                {status !== "complete" && (
                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-agent-critic animate-pulse bg-yellow-950/20 border border-yellow-900/30 px-2 py-0.5 rounded">
                    <Flame size={10} className="shrink-0" />
                    <span>SYNTHESIS IN PROGRESS...</span>
                  </div>
                )}
              </div>

              {/* Report markdown document canvas */}
              <div className="flex-1 p-6 overflow-y-auto bg-bg-base/15 leading-relaxed text-sm select-text">
                {status !== "complete" ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 gap-3">
                    <Cpu size={32} className="text-agent-planner animate-spin" />
                    <h3 className="font-display font-semibold text-text-primary">Assembling Swarm Intelligence</h3>
                    <p className="text-text-secondary text-xs max-w-sm">
                      Planner, Researchers (A/B/C), Critic, and Validator are processing findings. A localized deep report will render automatically when complete.
                    </p>
                  </div>
                ) : (
                  <div id="report-export-target" className="prose prose-invert max-w-none text-text-primary font-sans">

                    {/* Localized notification */}
                    <div className="mb-6 flex items-center gap-2 text-confidence-high font-mono text-xs bg-emerald-950/20 border border-emerald-900/30 px-3 py-2 rounded-lg">
                      <Globe size={14} />
                      <span>The report is translated and generated in the detected language.</span>
                    </div>

                    {/* PDF header details */}
                    <div className="hidden pdf-only flex-col gap-2 border-b border-border-subtle pb-4 mb-6">
                      <span className="font-mono text-xs text-agent-planner">NEXUS — ADVERSARIAL SWARM INTELLIGENCE SYSTEM</span>
                      <h1 className="text-2xl font-bold font-display">{query}</h1>
                      <span className="font-mono text-xs text-text-muted">Session: {sessionId} • Confidence: {confidence}%</span>
                    </div>

                    <div className="markdown-body whitespace-pre-line font-sans text-text-primary text-sm sm:text-base leading-relaxed">
                      {report?.full_markdown}
                    </div>

                    {/* Discovered findings sub-panel */}
                    <div className="mt-8 pt-6 border-t border-border-subtle/50">
                      <h3 className="font-display font-semibold text-sm uppercase text-text-secondary mb-3">Validated Claims:</h3>
                      <div className="flex flex-col gap-2.5">
                        {findings.map((f, i) => (
                          <div key={i} className="p-3 border border-border-subtle/40 bg-bg-surface/50 rounded-lg flex items-start gap-3">
                            <div className="mt-0.5 shrink-0">
                              {f.status === "high" && <CheckCircle size={14} className="text-confidence-high" />}
                              {f.status === "medium" && <AlertTriangle size={14} className="text-confidence-medium" />}
                              {f.status === "contested" && <AlertTriangle size={14} className="text-confidence-contested" />}
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
                            className="p-3 border border-border-subtle/30 bg-bg-surface/30 rounded-lg hover:border-agent-planner/30 hover:bg-bg-surface/60 transition-all block text-xs"
                          >
                            <span className="font-mono text-[9px] text-agent-researcher-a block mb-1 uppercase">{s.domain}</span>
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
