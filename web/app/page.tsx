"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthForm from "@/components/auth-form";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("db_host_token");
    if (token) router.replace("/dashboard");
  }, [router]);

  return (
    <main className="min-h-screen bg-background flex">
      {/* Left panel — brand */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden border-r border-border">
        {/* Ambient glows */}
        <div className="glow-blob absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="glow-blob absolute -bottom-32 -right-16 w-80 h-80 rounded-full bg-cyan-500/15 blur-3xl" style={{ animationDelay: "2s" }} />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
            <span className="text-white font-bold text-sm">db</span>
          </div>
          <span className="font-semibold text-lg tracking-tight">db-host</span>
        </div>

        {/* Hero content */}
        <div className="relative z-10 space-y-8">
          {/* Floating DB illustration */}
          <div className="db-icon-float inline-flex">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
              <ellipse cx="40" cy="20" rx="32" ry="10" fill="url(#grad1)" opacity="0.9" />
              <rect x="8" y="20" width="64" height="40" fill="url(#grad2)" opacity="0.5" />
              <ellipse cx="40" cy="60" rx="32" ry="10" fill="url(#grad1)" opacity="0.9" />
              <ellipse cx="40" cy="40" rx="32" ry="10" fill="url(#grad1)" opacity="0.7" />
              <defs>
                <linearGradient id="grad1" x1="0" y1="0" x2="80" y2="0" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#3b82f6" />
                  <stop offset="1" stopColor="#22d3ee" />
                </linearGradient>
                <linearGradient id="grad2" x1="0" y1="0" x2="0" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#3b82f6" stopOpacity="0.3" />
                  <stop offset="1" stopColor="#22d3ee" stopOpacity="0.1" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-bold leading-tight">
              Distributed SQLite,{" "}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                instantly hosted
              </span>
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed max-w-md">
              Get a production-ready SQLite database backed by S3 in seconds. Drop in a{" "}
              <code className="text-cyan-400 font-mono text-sm bg-white/5 px-1.5 py-0.5 rounded">.env</code>{" "}
              file and start building.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2">
            {["S3-backed durability", "SQLAlchemy compatible", "Zero config", "LocalStack ready"].map((f) => (
              <span
                key={f}
                className="text-xs px-3 py-1.5 rounded-full border border-border bg-white/5 text-muted-foreground"
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div className="relative z-10 border border-border rounded-xl p-5 bg-white/3 backdrop-blur-sm">
          <p className="text-sm text-muted-foreground italic">
            "Spun up a distributed database and had it running with my existing SQLAlchemy models in under 5 minutes."
          </p>
          <div className="mt-3 flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400" />
            <span className="text-xs text-muted-foreground">Early adopter</span>
          </div>
        </div>
      </div>

      {/* Right panel — auth form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <AuthForm />
      </div>
    </main>
  );
}
