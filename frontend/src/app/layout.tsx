import type { Metadata } from "next";
import { Syne, DM_Sans, JetBrains_Mono } from "next/font/google";
import Navbar from "@/components/Navbar/Navbar";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["700", "800"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "NEXUS — Adversarial Multi-Agent Intelligence Swarm",
  description: "Drop any complex business or research question. Watch a self-organizing swarm of 7 specialized AI agents plan, research, debate, and deliver a confidence-graded intelligence report.",
  keywords: ["AI Agents", "Adversarial AI", "Swarm Intelligence", "Deep Research", "Market Intelligence", "Multi-Agent Systems"],
  authors: [{ name: "NEXUS Team" }]
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable} ${jetbrainsMono.variable} h-full scroll-smooth`}>
      <body className="min-h-full bg-bg-base text-text-primary antialiased flex flex-col font-sans">
        <Navbar />
        {children}
      </body>
    </html>
  );
}

