"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Cloud, Database, Zap, Lock, ShieldCheck, Activity, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import AuthForm from "@/components/auth-form";

const features = [
  { icon: Cloud, label: "S3-backed durability" },
  { icon: Database, label: "SQLAlchemy compatible" },
  { icon: Zap, label: "Zero config" },
  { icon: Lock, label: "LocalStack ready" },
];

const stats = [
  { value: "< 50ms", label: "Cold start" },
  { value: "11 9s", label: "S3 durability" },
  { value: "1 file", label: ".env setup" },
];

export default function Home() {
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("db_host_token");
    if (token) router.replace("/dashboard");
  }, [router]);

  return (
    <main className="bg-background lg:h-screen lg:overflow-hidden flex flex-col relative page-enter">

      {/* ── Ambient background ─────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="glow-blob absolute -top-48 -left-24 w-[600px] h-[600px] rounded-full bg-amber-500/12 blur-[100px]" />
        <div className="glow-blob absolute top-1/2 -right-32 w-96 h-96 rounded-full bg-sky-500/10 blur-[80px]" style={{ animationDelay: "2.2s" }} />
        <div className="glow-blob absolute -bottom-32 left-1/3 w-80 h-80 rounded-full bg-orange-600/8 blur-[80px]" style={{ animationDelay: "1s" }} />
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage: `radial-gradient(circle, oklch(1 0 0 / 38%) 1px, transparent 1px)`,
            backgroundSize: "28px 28px",
            maskImage: "radial-gradient(ellipse 65% 65% at 25% 35%, black 10%, transparent 78%)",
          }}
        />
      </div>

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="relative z-20 flex items-center justify-between px-8 xl:px-12 h-14 shrink-0 border-b border-border/50 bg-background/60 backdrop-blur-md">
        <div className="landing-stagger flex items-center gap-2.5" style={{ "--i": 0 } as CSSProperties}>
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-xl bg-amber-400/25 blur-md scale-110" />
            <Image
              src="/brand/logo.png"
              alt="LightLoft"
              width={28}
              height={28}
              className="relative rounded-xl object-contain"
              priority
            />
          </div>
          <span className="font-semibold text-sm tracking-tight text-foreground/90">LightLoft</span>
        </div>

        <div className="landing-stagger flex items-center gap-3" style={{ "--i": 1 } as CSSProperties}>
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/8 text-emerald-400 text-[11px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            All systems operational
          </div>
          <Button
            onClick={() => setAuthOpen(true)}
            className="h-8 px-4 text-sm font-medium bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white shadow-[0_6px_20px_-6px_rgba(234,88,12,0.5)] hover:shadow-[0_8px_26px_-6px_rgba(234,88,12,0.65)] transition-all duration-200 active:scale-[0.97]"
          >
            Sign in
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      </nav>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 flex items-center px-8 xl:px-12 py-8 gap-12 xl:gap-20 min-h-0">

        {/* Left — hero copy */}
        <div className="flex-1 flex flex-col gap-5 min-w-0">

          {/* Badge */}
          <div className="landing-stagger" style={{ "--i": 1 } as CSSProperties}>
            <div className="shimmer-badge inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/8 text-amber-300 text-xs font-medium overflow-hidden w-fit">
              <Activity className="w-3 h-3 shrink-0" />
              Production-grade SQLite · Hosted in S3
            </div>
          </div>

          {/* Headline */}
          <div className="landing-stagger" style={{ "--i": 2 } as CSSProperties}>
            <h1 className="text-4xl xl:text-[2.85rem] 2xl:text-5xl font-bold leading-[1.07] tracking-tight">
              SQLite that sleeps in S3,
              <br />
              <span className="bg-gradient-to-r from-amber-300 via-orange-200 to-sky-300 bg-clip-text text-transparent">
                wakes on your query
              </span>
            </h1>
          </div>

          {/* Subheading */}
          <div className="landing-stagger" style={{ "--i": 3 } as CSSProperties}>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-lg">
              Tenant-isolated SQLite files in object storage. Drop in a{" "}
              <code className="text-cyan-400/90 font-mono text-[12px] bg-white/[0.08] px-1.5 py-0.5 rounded border border-white/10">
                .env
              </code>{" "}
              and your SQLAlchemy models are cloud-connected. Zero infrastructure, production ready.
            </p>
          </div>

          {/* CTAs */}
          <div className="landing-stagger flex items-center gap-3" style={{ "--i": 4 } as CSSProperties}>
            <Button
              onClick={() => setAuthOpen(true)}
              className="h-9 px-5 font-medium bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white shadow-[0_8px_28px_-8px_rgba(234,88,12,0.55)] hover:shadow-[0_12px_32px_-8px_rgba(234,88,12,0.65)] transition-all duration-200 active:scale-[0.97]"
            >
              Start for free
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="inline-flex items-center h-9 px-4 text-sm text-muted-foreground hover:text-foreground hover:bg-white/[0.06] rounded-md transition-colors duration-200"
            >
              Read the docs
            </a>
          </div>

          {/* Stats */}
          <div className="landing-stagger grid grid-cols-3 gap-2.5 max-w-xs" style={{ "--i": 5 } as CSSProperties}>
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="stat-card text-center py-3 px-2 rounded-xl bg-white/[0.03] border border-white/8"
              >
                <div className="text-lg font-bold text-foreground/95 tracking-tight">{stat.value}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Feature chips */}
          <div className="landing-stagger flex flex-wrap gap-2" style={{ "--i": 6 } as CSSProperties}>
            {features.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.label}
                  className="feature-card flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-primary/30 cursor-default text-xs text-muted-foreground hover:text-foreground"
                >
                  <Icon className="w-3 h-3 text-primary shrink-0" />
                  {feat.label}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right — code block + testimonial */}
        <div className="hidden lg:flex flex-col gap-4 w-[380px] xl:w-[420px] shrink-0">

          {/* .env code block */}
          <div className="landing-stagger" style={{ "--i": 2 } as CSSProperties}>
            <div className="rounded-xl border border-white/10 bg-black/50 backdrop-blur-sm overflow-hidden shadow-[0_20px_56px_-14px_rgba(0,0,0,0.7)] group">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/8 bg-white/[0.025]">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/70 group-hover:bg-red-500 transition-colors duration-200" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70 group-hover:bg-yellow-500 transition-colors duration-200" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/70 group-hover:bg-green-500 transition-colors duration-200" />
                </div>
                <span className="text-[11px] text-muted-foreground font-mono ml-2 select-none">.env</span>
              </div>
              <pre className="env-code p-4 leading-relaxed select-none">
                <div><span className="env-comment"># Your LightLoft config</span></div>
                <div><span className="env-key">DB_HOST_URL</span><span className="env-eq">=</span><span className="env-val">https://api.lightloft.io</span></div>
                <div><span className="env-key">DB_HOST_TOKEN</span><span className="env-eq">=</span><span className="env-val">sk_live_••••••••••••</span></div>
                <div><span className="env-key">DB_HOST_TENANT</span><span className="env-eq">=</span><span className="env-val">acme-corp<span className="env-cursor">|</span></span></div>
              </pre>
            </div>
          </div>

          {/* Testimonial */}
          <div className="landing-stagger" style={{ "--i": 4 } as CSSProperties}>
            <div className="relative rounded-xl p-5 border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent backdrop-blur-sm overflow-hidden group">
              <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-tr from-amber-500/5 via-transparent to-sky-500/5" />
              <span className="pointer-events-none absolute top-2 left-3 font-serif text-5xl leading-none text-amber-500/20 select-none" aria-hidden>
                &ldquo;
              </span>
              <p className="relative text-sm text-muted-foreground leading-relaxed pl-5 border-l-2 border-amber-500/40 group-hover:border-amber-500/60 transition-colors duration-300">
                Signed into LightLoft, created a DB, and had my SQLAlchemy models talking to S3-backed SQLite in under five minutes.
              </p>
              <div className="mt-4 flex items-center gap-3 pl-5">
                <div className="relative shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 ring-2 ring-background shadow-[0_0_18px_-2px_rgba(251,146,60,0.5)]" />
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-background" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-foreground/90 block">Early adopter</span>
                  <span className="text-[11px] text-muted-foreground">Shipped in one session</span>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-3 h-3 text-amber-400 fill-current" viewBox="0 0 20 20" aria-hidden>
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Trust strip */}
          <div className="landing-stagger flex items-center justify-center gap-4 text-[11px] text-muted-foreground/55" style={{ "--i": 5 } as CSSProperties}>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3" />
              SSL encrypted
            </div>
            <div className="w-px h-3 bg-border" />
            <div className="flex items-center gap-1.5">
              <Database className="w-3 h-3" />
              S3-backed
            </div>
            <div className="w-px h-3 bg-border" />
            <span>No credit card</span>
          </div>
        </div>
      </div>

      {/* ── Auth modal ───────────────────────────────────────────────────── */}
      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="sm:max-w-sm border-border/80 bg-card/95 backdrop-blur-2xl shadow-[0_40px_80px_-24px_rgba(0,0,0,0.9),inset_0_1px_0_0_oklch(1_0_0/7%)]">
          <DialogTitle className="sr-only">Sign in to LightLoft</DialogTitle>
          <AuthForm />
        </DialogContent>
      </Dialog>
    </main>
  );
}
