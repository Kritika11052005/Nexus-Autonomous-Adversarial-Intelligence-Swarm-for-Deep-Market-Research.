"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldAlert, ArrowRight, Sparkles } from "lucide-react";
import axios from "axios";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const apiURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await axios.post(`${apiURL}/auth/login`, {
        email,
        password
      });

      // Save tokens
      localStorage.setItem("access_token", response.data.access_token);
      localStorage.setItem("refresh_token", response.data.refresh_token);
      localStorage.setItem("user_email", response.data.email);
      localStorage.setItem("user_plan", response.data.plan);

      // Redirect home
      router.push("/");
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Authentication failed. Incorrect email or password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-bg-base text-text-primary flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-[20%] right-[30%] w-96 h-96 rounded-full bg-violet-800/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[20%] left-[30%] w-96 h-96 rounded-full bg-cyan-800/10 blur-[120px] pointer-events-none"></div>

      <div className="relative w-full max-w-md border border-border-subtle bg-bg-surface p-8 rounded-2xl shadow-[0_0_24px_rgba(0,255,209,0.03)] z-10">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border-subtle bg-bg-surface text-text-code font-mono text-xs mb-3">
            <Sparkles size={12} className="text-agent-planner animate-pulse" />
            SECURE LOGIN
          </div>
          <h1 className="font-display text-2xl font-bold tracking-wider uppercase mb-1">
            NEXUS ACCESS
          </h1>
          <p className="text-text-secondary text-sm">
            Sign in to start adversarial swarms.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-xs text-text-secondary uppercase">
              // Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              disabled={loading}
              className="w-full px-4 py-2.5 rounded-xl border border-border-subtle bg-bg-base text-text-primary focus:outline-none focus:border-agent-planner transition-all text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-xs text-text-secondary uppercase">
              // Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              className="w-full px-4 py-2.5 rounded-xl border border-border-subtle bg-bg-base text-text-primary focus:outline-none focus:border-agent-planner transition-all text-sm"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-confidence-contested font-mono text-xs bg-red-950/20 border border-red-900/30 px-3 py-2.5 rounded-xl">
              <ShieldAlert size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-display font-semibold text-sm transition-all border border-agent-planner ${
              loading
                ? "bg-bg-surface border-border-subtle text-text-muted cursor-wait"
                : "bg-bg-surface text-text-primary hover:bg-agent-planner/10 shadow-[0_0_12px_rgba(139,92,246,0.15)] hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] cursor-pointer"
            }`}
          >
            {loading ? "VERIFYING ENCRYPTED SESSION..." : "START SWARM PASS"}
            {!loading && <ArrowRight size={14} className="text-agent-planner" />}
          </button>
        </form>

        {/* Footer Link */}
        <div className="text-center mt-6 pt-4 border-t border-border-subtle/50">
          <span className="text-text-secondary text-xs">Don&apos;t have an account? </span>
          <Link
            href="/register"
            className="text-xs font-mono text-agent-planner hover:underline"
          >
            // REGISTER NEW PORTAL
          </Link>
        </div>
      </div>
    </div>
  );
}
