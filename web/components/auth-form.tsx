"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { signup, signin } from "@/lib/api";
import BrandMark from "@/components/brand-mark";
import { Loader2 } from "lucide-react";

type Mode = "signin" | "signup";

export default function AuthForm() {
  const { login } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleMode = () => {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = mode === "signup"
        ? await signup(email, password)
        : await signin(email, password);
      login(data);
      toast.success(mode === "signup" ? "Account created! Welcome aboard." : "Welcome back!");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Something went wrong. Please try again.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-8">
      {/* Mobile logo */}
      <div className="flex lg:hidden mb-2 justify-center sm:justify-start">
        <BrandMark priority size={40} wordmarkClassName="font-semibold text-lg tracking-tight" />
      </div>

      {/* Header */}
      <div>
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
          >
            <h2 className="text-2xl font-bold">
              {mode === "signin" ? "Sign in to your account" : "Create your account"}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {mode === "signin"
                ? "Enter your credentials to access your databases."
                : "Get started for free. No credit card required."}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="bg-white/[0.06] border-border/90 transition-[box-shadow,border-color] duration-200 focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:border-primary/40"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className="bg-white/[0.06] border-border/90 transition-[box-shadow,border-color] duration-200 focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:border-primary/40"
          />
        </div>

        <Button
          type="submit"
          className="w-full bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white font-medium shadow-[0_8px_28px_-8px_rgba(234,88,12,0.55)] hover:shadow-[0_12px_32px_-8px_rgba(234,88,12,0.65)] transition-[transform,box-shadow,filter] duration-200 active:scale-[0.98]"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : mode === "signin" ? (
            "Sign in"
          ) : (
            "Create account"
          )}
        </Button>
      </form>

      {/* Toggle */}
      <p className="text-sm text-center text-muted-foreground">
        {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={toggleMode}
          className="text-primary font-medium rounded-sm px-1 -mx-0.5 underline-offset-4 hover:underline hover:text-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {mode === "signin" ? "Sign up" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
