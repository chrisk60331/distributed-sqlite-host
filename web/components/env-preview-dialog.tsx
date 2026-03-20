"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Copy, Download, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getEnvContent } from "@/lib/api";
import type { Database } from "@/lib/api";

interface Props {
  db: Database | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function EnvLine({ line }: { line: string }) {
  if (line.startsWith("#")) {
    return <div className="env-comment">{line}</div>;
  }
  if (line === "") return <div>&nbsp;</div>;
  const eqIdx = line.indexOf("=");
  if (eqIdx === -1) return <div>{line}</div>;
  const key = line.slice(0, eqIdx);
  const val = line.slice(eqIdx + 1);
  return (
    <div>
      <span className="env-key">{key}</span>
      <span className="env-eq">=</span>
      <span className="env-val">{val}</span>
    </div>
  );
}

export default function EnvPreviewDialog({ db, open, onOpenChange }: Props) {
  const [content, setContent] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && db) {
      getEnvContent(db.db_id)
        .then(setContent)
        .catch(() => toast.error("Failed to load .env content"));
    }
  }, [open, db]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${db?.name ?? "db"}.env`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(".env file downloaded");
  };

  if (!db) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <code className="text-cyan-400 font-mono text-base">{db.name}.env</code>
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            No AWS keys — your app talks to db-host over HTTP. Paste the JWT from sign-in into{" "}
            <code className="text-xs text-cyan-400">DB_HOST_TOKEN</code>. Keep this file out of git.
          </DialogDescription>
        </DialogHeader>

        {/* Code block */}
        <div className="rounded-xl border border-border bg-black/60 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-white/3">
            <span className="text-xs text-muted-foreground font-mono">{db.name}.env</span>
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
            </div>
          </div>
          <div className="p-4 env-code overflow-x-auto">
            {content
              ? content.split("\n").map((line, i) => <EnvLine key={i} line={line} />)
              : <div className="text-muted-foreground animate-pulse">Loading…</div>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            className="flex-1 border-border gap-2"
            onClick={handleCopy}
          >
            {copied ? (
              <><Check className="w-4 h-4 text-green-400" /> Copied!</>
            ) : (
              <><Copy className="w-4 h-4" /> Copy</>
            )}
          </Button>
          <Button
            className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white gap-2 active:scale-[0.97] transition-all"
            onClick={handleDownload}
          >
            <Download className="w-4 h-4" />
            Download .env
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
