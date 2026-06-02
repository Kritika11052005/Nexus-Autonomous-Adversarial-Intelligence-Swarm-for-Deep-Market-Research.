import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="h-full scroll-smooth">
      <body className="min-h-full bg-bg-base text-text-primary antialiased flex flex-col">
        {children}
      </body>
    </html>
  );
}
