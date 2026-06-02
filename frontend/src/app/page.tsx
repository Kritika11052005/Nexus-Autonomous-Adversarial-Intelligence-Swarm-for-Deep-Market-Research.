/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Brain, ShieldAlert, Sparkles, BookOpen, Cpu, Globe, Lock, LogOut, CreditCard, ChevronRight } from "lucide-react";
import axios from "axios";

export default function Home() {
  const router = useRouter();

  // Auth state
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("free");

  // Form state
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("General");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Custom Settings (Locked for Free tier, editable for Pro)
  const [settings, setSettings] = useState({
    model: "gemini-3.5-flash",
    search_depth: 5,
    planner_temp: 0.2,
    critic_temp: 0.7
  });

  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    // Check if token exists in localStorage
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAuthenticated(true);
      setEmail(localStorage.getItem("user_email") || "user@example.com");
      setPlan(localStorage.getItem("user_plan") || "free");
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.clear();
    router.push("/login");
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

  // Check if redirecting from a successful checkout session
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("upgrade_success") === "true") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlan("pro");
      localStorage.setItem("user_plan", "pro");
      setSuccess("Your account has been successfully upgraded to NEXUS PRO! Enjoy unlimited multi-agent runs.");
      // Clean query params
      router.replace("/");
    }
  }, [router]);

  const examples = [
    {
      text: "क्या 2026 में भारत में स्टार्टअप्स को सेमीकंडक्टर निर्माण पर ध्यान देना चाहिए?",
      domain: "Business"
    },
    {
      text: "Should a B2B SaaS startup target Indian SMEs in 2026?",
      domain: "Business"
    },
    {
      text: "What are the primary geopolitical hurdles for Southeast Asian semiconductor supply chains in 2025?",
      domain: "Technical"
    }
  ];

  const handleExampleClick = (example: typeof examples[0]) => {
    setQuery(example.text);
    setDomain(example.domain);
    setError("");
  };

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
          settings: plan === "pro" ? settings : { model: "gemini-3.5-flash", search_depth: 3 }
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

  const domainPills = [
    { name: "General", icon: Globe },
    { name: "Business", icon: Brain },
    { name: "Research", icon: BookOpen },
    { name: "Technical", icon: Cpu }
  ];

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-bg-base text-text-primary flex items-center justify-center font-mono">
        SECURITY VERIFYING AUTHORIZATION TOKEN...
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-bg-base text-text-primary flex flex-col items-center justify-between p-4 sm:p-6 overflow-hidden">

      {/* Bioluminescent Background Glows */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[20%] left-[15%] w-2 h-2 rounded-full bg-cyan-400 opacity-20 blur-[2px] animate-[pulse_6s_infinite_ease-in-out]"></div>
        <div className="absolute top-[65%] left-[85%] w-1.5 h-1.5 rounded-full bg-violet-400 opacity-25 blur-[1px] animate-[pulse_4s_infinite_ease-in-out_1s]"></div>
        <div className="absolute top-[30%] right-[20%] w-1 h-1 rounded-full bg-cyan-300 opacity-30 blur-[1px] animate-[pulse_5s_infinite_ease-in-out_0.5s]"></div>
      </div>

      {/* Navigation Header */}
      <header className="relative w-full max-w-5xl flex items-center justify-between py-4 border-b border-border-subtle z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 flex items-center justify-center border border-agent-planner rounded-lg bg-bg-surface text-agent-planner shadow-[0_0_12px_rgba(139,92,246,0.3)]">
            <span className="font-display font-semibold text-lg">⬡</span>
          </div>
          <span className="font-display font-bold text-xl tracking-wider uppercase text-text-primary">
            Nexus
          </span>
        </div>

        {/* User Account Controls */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col text-right font-mono text-xs">
            <span className="text-text-primary">{email}</span>
            <span className={plan === "pro" ? "text-agent-researcher-a animate-pulse" : "text-text-muted"}>
              PLAN: {plan.toUpperCase()}
            </span>
          </div>

          {plan === "free" && (
            <button
              onClick={handleUpgrade}
              disabled={submitting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-agent-researcher-a bg-bg-surface text-agent-researcher-a text-xs font-mono font-semibold shadow-[0_0_10px_rgba(6,182,212,0.15)] hover:bg-agent-researcher-a/10 transition-all cursor-pointer"
            >
              <CreditCard size={12} />
              UPGRADE PRO
            </button>
          )}

          <button
            onClick={handleLogout}
            className="p-2 border border-border-subtle rounded-lg bg-bg-surface text-text-secondary hover:text-confidence-contested transition-colors cursor-pointer"
            title="Log Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative w-full max-w-3xl flex flex-col items-center justify-center flex-1 z-10 py-8 sm:py-12">

        {/* Brand Banner */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border-subtle bg-bg-surface text-text-code font-mono text-xs mb-4">
            <Sparkles size={12} className="text-agent-researcher-a animate-pulse" />
            ENTERPRISE SWARM LIVE ENGINES
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-text-primary via-text-primary to-text-secondary">
            Adversarial Multi-Agent Swarm
          </h1>
          <p className="text-text-secondary text-sm sm:text-base max-w-xl mx-auto">
            Drop any complex question in Hindi, English, or any other language. A self-organizing pipeline of 7 specialized AI agents will plan, research, debate, and output a validated markdown report.
          </p>
        </div>

        {/* Global Notifications */}
        {success && (
          <div className="w-full mb-4 flex items-center gap-2 text-confidence-high font-mono text-xs bg-emerald-950/20 border border-emerald-900/30 px-3 py-2 rounded-xl">
            <span>{success}</span>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div className="relative group border border-border-subtle hover:border-agent-planner focus-within:border-agent-planner focus-within:shadow-[0_0_18px_rgba(139,92,246,0.15)] rounded-xl bg-bg-surface transition-all duration-300">
            <textarea
              className="w-full h-32 p-4 pr-12 bg-transparent text-text-primary placeholder-text-muted focus:outline-none resize-none font-sans text-sm sm:text-base leading-relaxed"
              placeholder="क्या 2026 में भारत में स्टार्टअप्स को सेमीकंडक्टर निर्माण पर ध्यान देना चाहिए? / Ask NEXUS to investigate..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setError("");
              }}
              disabled={submitting}
            />
            <div className="absolute bottom-3 right-3 flex items-center gap-3">
              <span className={`font-mono text-xs ${query.length > 500 ? "text-confidence-contested" : "text-text-muted"}`}>
                {query.length}/500
              </span>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-confidence-contested font-mono text-xs bg-red-950/20 border border-red-900/30 px-3 py-2.5 rounded-xl">
              <ShieldAlert size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Settings Toggle Controls */}
          <div className="w-full border border-border-subtle rounded-xl bg-bg-surface overflow-hidden transition-all duration-300">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-mono text-text-secondary hover:text-text-primary hover:bg-bg-raised/40 transition-colors"
            >
              <span> ADVANCED AGENT CONFIGURATIONS</span>
              <ChevronRight size={14} className={`transform transition-transform ${showSettings ? "rotate-90" : ""}`} />
            </button>

            {showSettings && (
              <div className="p-4 border-t border-border-subtle bg-bg-base/40 flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Model Choice */}
                  <div className="flex flex-col gap-1.5 relative">
                    <label className="font-mono text-xs text-text-secondary flex items-center gap-1.5">
                      Agent LLM Model:
                      {plan !== "pro" && <Lock size={10} className="text-agent-critic" />}
                    </label>
                    <select
                      aria-label="select"
                      disabled={plan !== "pro"}
                      value={settings.model}
                      onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-surface text-xs text-text-primary focus:outline-none"
                    >
                      <option value="gemini-3.5-flash">Gemini 3.5 Flash (Fast)</option>
                      <option value="gemini-3.5-pro">Gemini 3.5 Pro (Deep Reasoning)</option>
                    </select>
                  </div>

                  {/* Search count */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-xs text-text-secondary flex items-center gap-1.5">
                      Search depth limit (Tavily):
                      {plan !== "pro" && <Lock size={10} className="text-agent-critic" />}
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        aria-label="input"
                        type="range"
                        min="3"
                        max="10"
                        disabled={plan !== "pro"}
                        value={settings.search_depth}
                        onChange={(e) => setSettings({ ...settings, search_depth: parseInt(e.target.value) })}
                        className="w-full accent-agent-planner"
                      />
                      <span className="font-mono text-xs text-text-primary shrink-0">{settings.search_depth} result(s)</span>
                    </div>
                  </div>
                </div>
                {plan !== "pro" && (
                  <div className="text-center text-[10px] font-mono text-agent-critic bg-yellow-950/20 border border-yellow-900/30 py-1.5 rounded-lg">
                    🔒 These controllers are locked under FREE Tier. Please Upgrade to PRO for custom swarm metrics.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Domain Selector & Submit Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">

            {/* Domain Pills */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <span className="font-mono text-xs text-text-secondary mr-1"> DOMAIN:</span>
              {domainPills.map((pill) => {
                const IconComponent = pill.icon;
                const isActive = domain === pill.name;
                return (
                  <button
                    key={pill.name}
                    type="button"
                    onClick={() => setDomain(pill.name)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs border transition-all cursor-pointer ${isActive
                      ? "bg-bg-raised border-agent-planner text-text-primary shadow-[0_0_8px_rgba(139,92,246,0.2)]"
                      : "border-border-subtle bg-bg-surface text-text-secondary hover:text-text-primary hover:border-text-secondary"
                      }`}
                  >
                    <IconComponent size={12} className={isActive ? "text-agent-planner" : ""} />
                    {pill.name.toUpperCase()}
                  </button>
                );
              })}
            </div>

            {/* Run Button */}
            <button
              type="submit"
              disabled={submitting}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-display font-semibold text-sm transition-all duration-300 border border-agent-planner text-text-primary cursor-pointer ${submitting
                ? "bg-bg-surface cursor-wait border-border-subtle"
                : "bg-bg-surface shadow-[0_0_12px_rgba(139,92,246,0.25)] hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:bg-agent-planner/10"
                }`}
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-agent-planner border-t-transparent rounded-full animate-spin"></div>
                  DEPLOYING PIPELINE...
                </>
              ) : (
                <>
                  <Search size={16} className="text-agent-planner" />
                  LAUNCH SWARM PASS
                </>
              )}
            </button>
          </div>
        </form>

        {/* Examples section */}
        <div className="w-full mt-10 border-t border-border-subtle/50 pt-6">
          <span className="block font-mono text-xs text-text-secondary mb-3 uppercase tracking-wider">
            Multilingual Research Templates (English/Hindi):
          </span>
          <div className="flex flex-col gap-2.5">
            {examples.map((example, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleExampleClick(example)}
                className="w-full text-left text-sm p-3 rounded-lg border border-border-subtle/30 bg-bg-surface/50 hover:bg-bg-surface hover:border-agent-planner/40 transition-all font-sans leading-relaxed flex items-start gap-2.5 text-text-secondary hover:text-text-primary group cursor-pointer"
              >
                <span className="font-mono text-xs text-agent-planner mt-0.5 group-hover:animate-pulse">⬡</span>
                <span>{example.text}</span>
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative w-full max-w-5xl text-center py-6 border-t border-border-subtle/30 text-xs font-mono text-text-muted z-10">
        NEXUS ADVERSARIAL SWARM ENGINE v1.0 • PRODUCTION WORKSPACE • SECURE RUNS
      </footer>
    </div>
  );
}
