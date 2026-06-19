/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, LogOut, CreditCard } from "lucide-react";
import axios from "axios";
import { StaggeredMenu } from "../StaggeredMenu/StaggeredMenu";

const SCROLL_THRESHOLD = 60;

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // User auth state
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("free");
  const [submitting, setSubmitting] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    const checkAuthAndFetchSessions = async () => {
      const token = localStorage.getItem("access_token");
      if (token) {
        setAuthenticated(true);
        setEmail(localStorage.getItem("user_email") || "user@example.com");
        setPlan(localStorage.getItem("user_plan") || "free");

        try {
          const apiURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
          const res = await axios.get(`${apiURL}/sessions`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setSessions(res.data);
        } catch (err) {
          console.error("Error fetching sessions in navbar:", err);
        }
      } else {
        setAuthenticated(false);
        setSessions([]);
      }
    };

    checkAuthAndFetchSessions();
    window.addEventListener("storage", checkAuthAndFetchSessions);
    return () => window.removeEventListener("storage", checkAuthAndFetchSessions);
  }, [pathname]);

  const handleLogout = () => {
    localStorage.clear();
    setAuthenticated(false);
    window.dispatchEvent(new Event("storage"));
    router.push("/auth");
  };

  const handleUpgrade = async () => {
    setSubmitting(true);
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
      console.error(err);
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > SCROLL_THRESHOLD);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Do not render navbar on auth, login, and register pages
  if (
    pathname?.startsWith("/auth") ||
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/register")
  ) {
    return null;
  }

  const navLinks = [
    { label: "How It Works", href: "#how-it-works" },
    { label: "Adversarial Redundancy", href: "#confidence-difference" },
  ];

  return (
    <>
      <motion.nav
        layout
        animate={scrolled ? "scrolled" : "top"}
        variants={{
          top: {
            width: "100%",
            top: 0,
            borderRadius: 0,
            backgroundColor: "rgba(0,0,0,0)",
            backdropFilter: "blur(0px)",
            borderColor: "rgba(255,170,0,0)",
            boxShadow: "none",
            padding: "20px 40px",
          },
          scrolled: {
            width: "min(520px, 90vw)",
            top: 16,
            borderRadius: 9999,
            backgroundColor: "rgba(8, 8, 15, 0.72)",
            backdropFilter: "blur(24px) saturate(180%)",
            borderColor: "rgba(255, 170, 0, 0.15)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,170,0,0.06), 0 0 20px rgba(255,170,0,0.04)",
            padding: "10px 20px",
          },
        }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{
          position: "fixed",
          zIndex: 50,
          left: 0,
          right: 0,
          marginLeft: "auto",
          marginRight: "auto",
          borderStyle: "solid",
          borderWidth: scrolled ? "1px" : "0px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Left: Logo */}
        <Link href="/" className="flex items-center gap-2 cursor-pointer z-50">
          <HexIcon />
          <motion.span
            animate={{
              opacity: scrolled ? 0 : 1,
              width: scrolled ? 0 : "auto",
              pointerEvents: scrolled ? "none" : "auto",
            }}
            transition={{ duration: 0.3 }}
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 20,
              color: "#F0F0FF",
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            NEXUS
          </motion.span>
        </Link>

        {/* Center: Nav Links */}
        <div className="hidden md:flex items-center gap-6">
          {pathname === "/" && navLinks.map((link) => (
            <NavLink key={link.label} label={link.label} href={link.href} scrolled={scrolled} />
          ))}
        </div>

        {/* Right: Actions / Live Status + CTA */}
        <div className="flex items-center gap-4 z-50">
          {/* Swarm Online Indicator - Only visible at top (scrolled = false), on desktop, and when NOT authenticated */}
          {!scrolled && !authenticated && (
            <div className="hidden md:flex items-center gap-2">
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                style={{ width: 7, height: 7, borderRadius: "50%", background: "#FFAA00" }}
              />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#44445A", letterSpacing: "0.05em" }}>
                SWARM ONLINE
              </span>
            </div>
          )}

          {/* CTA / User Info */}
          {authenticated ? (
            <div className="flex items-center gap-2.5 bg-bg-surface/50 border border-border-subtle backdrop-blur-md rounded-full px-3.5 py-1.5 transition-all shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
              <div className="flex flex-col text-right font-mono text-[9px] leading-tight">
                <span className="text-[#F0F0FF] max-w-[80px] sm:max-w-[120px] truncate">{email}</span>
                <span className={plan === "pro" ? "text-accent-cyan font-bold" : "text-text-muted"}>
                  {plan.toUpperCase()} TIER
                </span>
              </div>
              {plan === "free" && !scrolled && (
                <button
                  onClick={handleUpgrade}
                  disabled={submitting}
                  className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-accent-cyan/15 border border-accent-cyan/40 text-accent-cyan text-[9px] font-mono hover:bg-accent-cyan/25 transition-all cursor-pointer font-bold"
                >
                  <CreditCard size={9} />
                  UPGRADE
                </button>
              )}
              <button
                onClick={handleLogout}
                className="p-1 border border-border-subtle rounded-md bg-bg-surface hover:text-[#EF4444] transition-colors cursor-pointer"
                title="Log Out"
                aria-label="log out"
              >
                <LogOut size={10} />
              </button>
            </div>
          ) : (
            <CTAButton scrolled={scrolled} onClick={() => router.push("/auth")} />
          )}

          {/* Hamburger Menu - Only visible on mobile when NOT authenticated, and only when NOT scrolled */}
          {!scrolled && !authenticated && (
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
          )}

          {authenticated && (
            <div className="ml-2">
              <StaggeredMenu
                isFixed={false}
                items={sessions.map((s) => ({
                  label: s.query_text.length > 25 ? s.query_text.slice(0, 23) + "..." : s.query_text,
                  ariaLabel: `View session: ${s.query_text}`,
                  link: `/run/${s.session_id}`
                }))}
                accentColor="#FFAA00"
                colors={['#08080f', '#101024', '#151530']}
              />
            </div>
          )}
        </div>
      </motion.nav>

      {/* Mobile Full-Screen Overlay Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              backgroundColor: "rgba(8, 8, 15, 0.95)",
              backdropFilter: "blur(12px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-6 right-6 p-2 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              aria-label="Close menu"
            >
              <X size={24} />
            </button>

            {/* Menu Links */}
            <nav className="flex flex-col items-center gap-8">
              {navLinks.map((link, index) => (
                <motion.a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.4 }}
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 24,
                    fontWeight: 700,
                    color: "#F0F0FF",
                    textDecoration: "none",
                  }}
                  whileHover={{ color: "#FFAA00", scale: 1.05 }}
                >
                  {link.label}
                </motion.a>
              ))}

              <motion.button
                onClick={() => {
                  setMobileMenuOpen(false);
                  router.push("/auth");
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: navLinks.length * 0.1, duration: 0.4 }}
                className="mt-4 px-8 py-3 rounded-full border border-accent-cyan bg-accent-cyan text-[#08080F] font-bold font-sans hover:bg-transparent hover:text-accent-cyan transition-all duration-300"
              >
                Try NEXUS
              </motion.button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function HexIcon() {
  return (
    <motion.div
      animate={{ scale: [1, 1.15, 1] }}
      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      style={{ display: "flex", alignItems: "center" }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18">
        <polygon
          points="9,1 16,5 16,13 9,17 2,13 2,5"
          fill="none"
          stroke="#FFAA00"
          strokeWidth="1.5"
        />
        <polygon
          points="9,5 13,7 13,11 9,13 5,11 5,7"
          fill="rgba(255,170,0,0.2)"
          stroke="none"
        />
      </svg>
    </motion.div>
  );
}

function NavLink({ label, href, scrolled }: { label: string; href: string; scrolled: boolean }) {
  return (
    <motion.a
      href={href}
      style={{
        position: "relative",
        fontSize: scrolled ? 13 : 14,
        fontFamily: "var(--font-sans)",
        color: "#8888AA",
        textDecoration: "none",
      }}
      whileHover={{ color: "#F0F0FF" }}
      transition={{ duration: 0.2 }}
    >
      {label}
      <motion.span
        initial={{ scaleX: 0 }}
        whileHover={{ scaleX: 1 }}
        style={{
          position: "absolute",
          bottom: -4,
          left: 0,
          right: 0,
          height: 2,
          background: "#FFAA00",
          borderRadius: 99,
          transformOrigin: "left",
        }}
      />
    </motion.a>
  );
}

function CTAButton({ scrolled, onClick }: { scrolled: boolean; onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ backgroundColor: "rgba(255,170,0,0.1)", borderColor: "#FFAA00" }}
      style={{
        padding: scrolled ? "6px 14px" : "8px 18px",
        borderRadius: 9999,
        border: "1px solid rgba(255,170,0,0.4)",
        background: "transparent",
        color: "#FFAA00",
        fontFamily: "var(--font-sans)",
        fontSize: scrolled ? 12 : 13,
        cursor: "pointer",
        transition: "all 0.2s ease",
      }}
    >
      Try NEXUS
    </motion.button>
  );
}
