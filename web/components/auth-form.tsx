"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { signup, signin } from "@/lib/api";
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
    <div className="w-full max-w-sm space-y-8">
      {/* Mobile logo */}
      <div className="flex lg:hidden items-center gap-3 mb-8">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
          <span className="text-white font-bold text-sm">db</span>
        </div>
        <span className="font-semibold text-lg tracking-tight">db-host</span>
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
            className="bg-white/5 border-border focus:ring-2 focus:ring-primary/30"
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
            className="bg-white/5 border-border focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <Button
          type="submit"
          className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-medium transition-all active:scale-[0.97]"
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
          className="text-primary hover:underline font-medium transition-colors"
        >
          {mode === "signin" ? "Sign up" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
