"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Loader2, Database, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDatabase, type CreateDatabaseResult, type Database as DB } from "@/lib/api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (db: DB) => void;
}

export default function CreateDbDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "api_key">("form");
  const [created, setCreated] = useState<CreateDatabaseResult | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("form");
      setCreated(null);
      setName("");
    }
  }, [open]);

  const finishAndClose = () => {
    if (!created) return;
    const { api_key: _k, ...db } = created;
    onCreated(db);
    toast.success(`Database "${created.name}" created`);
    onOpenChange(false);
  };

  const copyKey = async () => {
    if (!created?.api_key) return;
    try {
      await navigator.clipboard.writeText(created.api_key);
      toast.success("API key copied");
    } catch {
      toast.error("Could not copy — select and copy manually");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const db = await createDatabase(name.trim().toLowerCase());
      setCreated(db);
      setStep("api_key");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
 "Failed to create database.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <Database className="w-4 h-4 text-white" />
            </div>
            <DialogTitle className="text-lg">Create a database</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground">
            {step === "form" ? (
              <>
                Use the API with a JWT, or use the Python{" "}
                <code className="text-cyan-400 font-mono text-xs bg-white/5 px-1 py-0.5 rounded">
                  db-host-client
                </code>{" "}
                with a per-database API key for direct{" "}
                <code className="text-cyan-400/90 text-xs">distributed_sqlite</code> + S3.
              </>
            ) : (
              <>
                Copy this key now. It is not stored in plain text and cannot be shown again — use{" "}
                <span className="font-mono text-cyan-400/90 text-xs">POST /databases/…/api-key</span>{" "}
                to rotate.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {step === "api_key" && created ? (
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Database API key</Label>
              <div className="flex gap-2">
                <Input readOnly value={created.api_key} className="bg-black/50 border-border font-mono text-xs" />
                <Button type="button" variant="outline" size="icon" onClick={() => void copyKey()} className="shrink-0 border-border">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1 border-border" onClick={finishAndClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="db-name">Database name</Label>
              <Input
                id="db-name"
                placeholder="my-app-db"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                pattern="[a-z][a-z0-9_-]{0,62}"
                title="Lowercase letters, digits, hyphens, underscores. Must start with a letter."
                className="bg-white/5 border-border font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Lowercase letters, digits, <code>-</code> and <code>_</code>. Starts with a letter.
              </p>
            </div>

            {name && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="rounded-lg border border-border bg-black/40 p-3 overflow-hidden"
              >
                <p className="text-xs text-muted-foreground mb-1">API endpoint preview</p>
                <p className="text-xs font-mono text-cyan-400 break-all">
                  {typeof process.env.NEXT_PUBLIC_API_URL === "string"
                    ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")
                    : "…"}
                  /databases/&lt;id&gt;/execute
                </p>
              </motion.div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-border"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white active:scale-[0.97] transition-all"
                disabled={loading || !name}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create database"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
