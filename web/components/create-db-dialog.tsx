"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Loader2,
  Database,
  Copy,
  Cloud,
  Server,
  ExternalLink,
  ChevronRight,
  Check,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
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
import {
  createDatabase,
  byoSetup,
  type CreateDatabaseResult,
  type Database as DB,
  type BYOSetupResponse,
} from "@/lib/api";

const AWS_REGIONS = [
  { value: "us-east-1", label: "us-east-1 — N. Virginia" },
  { value: "us-east-2", label: "us-east-2 — Ohio" },
  { value: "us-west-1", label: "us-west-1 — N. California" },
  { value: "us-west-2", label: "us-west-2 — Oregon" },
  { value: "eu-west-1", label: "eu-west-1 — Ireland" },
  { value: "eu-west-2", label: "eu-west-2 — London" },
  { value: "eu-central-1", label: "eu-central-1 — Frankfurt" },
  { value: "ap-southeast-1", label: "ap-southeast-1 — Singapore" },
  { value: "ap-southeast-2", label: "ap-southeast-2 — Sydney" },
  { value: "ap-northeast-1", label: "ap-northeast-1 — Tokyo" },
];

type Step = "form" | "byo_deploy" | "byo_connect" | "api_key";
type StorageMode = "platform" | "byo";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (db: DB) => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function ValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-black/40 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-xs font-mono text-foreground/90 truncate">{value}</p>
      </div>
      <CopyButton text={value} />
    </div>
  );
}

const slideVariants = {
  enter: (dir: number) => ({ x: dir * 28, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: -dir * 28, opacity: 0 }),
};

export default function CreateDbDialog({ open, onOpenChange, onCreated }: Props) {
  const [step, setStep] = useState<Step>("form");
  const [dir, setDir] = useState(1);
  const [name, setName] = useState("");
  const [storageMode, setStorageMode] = useState<StorageMode>("platform");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<CreateDatabaseResult | null>(null);

  // BYO fields
  const [byoSetupData, setByoSetupData] = useState<BYOSetupResponse | null>(null);
  const [byoSetupLoading, setByoSetupLoading] = useState(false);
  const [roleArn, setRoleArn] = useState("");
  const [bucketName, setBucketName] = useState("");
  const [bucketRegion, setBucketRegion] = useState("us-east-1");

  useEffect(() => {
    if (!open) {
      setStep("form");
      setDir(1);
      setName("");
      setStorageMode("platform");
      setCreated(null);
      setByoSetupData(null);
      setRoleArn("");
      setBucketName("");
      setBucketRegion("us-east-1");
    }
  }, [open]);

  const advance = (next: Step) => { setDir(1); setStep(next); };
  const back = (prev: Step) => { setDir(-1); setStep(prev); };

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

  // Called from form step when user clicks "Continue" for BYO
  const handleGoToByo = async () => {
    if (!byoSetupData) {
      setByoSetupLoading(true);
      try {
        const s = await byoSetup();
        setByoSetupData(s);
      } catch {
        toast.error("Could not initialize BYO setup — check your connection.");
        return;
      } finally {
        setByoSetupLoading(false);
      }
    }
    advance("byo_deploy");
  };

  // Called from form step when user clicks "Create database" (platform mode)
  const handleCreatePlatform = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const db = await createDatabase(name.trim().toLowerCase());
      setCreated(db);
      advance("api_key");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Failed to create database.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Called from byo_connect step
  const handleCreateByo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleArn.trim() || !bucketName.trim()) return;
    setLoading(true);
    try {
      const db = await createDatabase(name.trim().toLowerCase(), {
        byo_role_arn: roleArn.trim(),
        byo_bucket_name: bucketName.trim(),
        byo_bucket_region: bucketRegion,
      });
      setCreated(db);
      advance("api_key");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Could not validate role — check the ARN, bucket name, and ExternalId in your trust policy.";
      toast.error(msg, { duration: 7000 });
    } finally {
      setLoading(false);
    }
  };

  const iframePolicy = byoSetupData
    ? JSON.stringify(
        {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: { AWS: `arn:aws:iam::${byoSetupData.platform_aws_account_id}:root` },
              Action: "sts:AssumeRole",
              Condition: { StringEquals: { "sts:ExternalId": byoSetupData.external_id } },
            },
          ],
        },
        null,
        2
      )
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md overflow-hidden">
        <AnimatePresence mode="wait" custom={dir}>

          {/* ── Step 1: name + storage choice ─────────────────────── */}
          {step === "form" && (
            <motion.div
              key="form"
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <DialogHeader>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                    <Database className="w-4 h-4 text-white" />
                  </div>
                  <DialogTitle className="text-lg">Create a database</DialogTitle>
                </div>
                <DialogDescription>
                  Choose a name and where your data lives. You can mix storage modes across databases.
                </DialogDescription>
              </DialogHeader>

              <form
                onSubmit={storageMode === "platform" ? handleCreatePlatform : (e) => { e.preventDefault(); void handleGoToByo(); }}
                className="space-y-5 mt-4"
              >
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
                    Lowercase, digits, <code>-</code> and <code>_</code>. Starts with a letter.
                  </p>
                </div>

                {/* Storage choice */}
                <div className="space-y-2">
                  <Label>Storage</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setStorageMode("platform")}
                      className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all duration-150 ${
                        storageMode === "platform"
                          ? "border-amber-500/50 bg-amber-500/8"
                          : "border-border bg-white/[0.02] hover:border-border/80 hover:bg-white/[0.04]"
                      }`}
                    >
                      <Cloud className={`w-4 h-4 ${storageMode === "platform" ? "text-amber-400" : "text-muted-foreground"}`} />
                      <div>
                        <p className={`text-xs font-semibold ${storageMode === "platform" ? "text-amber-300" : "text-foreground/80"}`}>
                          Platform S3
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Zero config</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStorageMode("byo")}
                      className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all duration-150 ${
                        storageMode === "byo"
                          ? "border-sky-500/50 bg-sky-500/8"
                          : "border-border bg-white/[0.02] hover:border-border/80 hover:bg-white/[0.04]"
                      }`}
                    >
                      <Server className={`w-4 h-4 ${storageMode === "byo" ? "text-sky-400" : "text-muted-foreground"}`} />
                      <div>
                        <p className={`text-xs font-semibold ${storageMode === "byo" ? "text-sky-300" : "text-foreground/80"}`}>
                          Your S3 bucket
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">You own the data</p>
                      </div>
                    </button>
                  </div>
                </div>

                {name && storageMode === "platform" && (
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
                    className={`flex-1 text-white active:scale-[0.97] transition-all ${
                      storageMode === "platform"
                        ? "bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400"
                        : "bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500"
                    }`}
                    disabled={loading || byoSetupLoading || !name}
                  >
                    {loading || byoSetupLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : storageMode === "platform" ? (
                      "Create database"
                    ) : (
                      <>
                        Next
                        <ChevronRight className="w-3.5 h-3.5 ml-1" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          )}

          {/* ── Step 2: BYO deploy IAM role ────────────────────────── */}
          {step === "byo_deploy" && byoSetupData && (
            <motion.div
              key="byo_deploy"
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <button
                    type="button"
                    onClick={() => back("form")}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <DialogTitle className="text-lg">Deploy the IAM role</DialogTitle>
                </div>
                <DialogDescription>
                  Grant LightLoft scoped access to your bucket via a cross-account role.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 mt-4">
                <div className="rounded-lg border border-border bg-black/30 p-3 space-y-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Values for your IAM trust policy
                  </p>
                  <ValueRow label="Your External ID" value={byoSetupData.external_id} />
                  <ValueRow label="LightLoft AWS Account" value={byoSetupData.platform_aws_account_id} />
                </div>

                {byoSetupData.cf_launch_url && (
                  <a
                    href={byoSetupData.cf_launch_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 w-full rounded-lg border border-sky-500/30 bg-sky-500/8 hover:bg-sky-500/12 hover:border-sky-500/50 px-4 py-3 transition-all group"
                  >
                    <div>
                      <p className="text-sm font-semibold text-sky-300 group-hover:text-sky-200">
                        Launch CloudFormation stack
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        One-click deploy — ExternalId is pre-filled
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-sky-400 shrink-0" />
                  </a>
                )}

                <details className="group rounded-lg border border-border overflow-hidden">
                  <summary className="flex cursor-pointer select-none items-center justify-between px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <span>Manual IAM trust policy JSON</span>
                    <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="border-t border-border bg-black/40">
                    <div className="flex items-center justify-between px-3 pt-2 pb-1">
                      <p className="text-[10px] text-muted-foreground">Trust policy</p>
                      <CopyButton text={iframePolicy} />
                    </div>
                    <pre className="px-3 pb-3 text-[10px] font-mono text-muted-foreground leading-relaxed overflow-x-auto">
                      {iframePolicy}
                    </pre>
                  </div>
                </details>

                <p className="text-[11px] text-muted-foreground px-0.5">
                  The role also needs <code className="text-cyan-400/90">s3:GetObject</code>,{" "}
                  <code className="text-cyan-400/90">s3:PutObject</code>, and{" "}
                  <code className="text-cyan-400/90">s3:DeleteObject</code> on your bucket prefix.
                </p>
              </div>

              <div className="flex gap-2 mt-5">
                <Button variant="outline" className="flex-1 border-border" onClick={() => back("form")}>
                  Back
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white active:scale-[0.97] transition-all"
                  onClick={() => advance("byo_connect")}
                >
                  I&apos;ve deployed it
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Step 3: BYO connect ─────────────────────────────────── */}
          {step === "byo_connect" && (
            <motion.div
              key="byo_connect"
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <button
                    type="button"
                    onClick={() => back("byo_deploy")}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <DialogTitle className="text-lg">Connect your bucket</DialogTitle>
                </div>
                <DialogDescription>
                  Paste the role ARN from CloudFormation outputs and your bucket details. We&apos;ll
                  validate live then create{" "}
                  <code className="text-cyan-400/90 font-mono text-xs">{name}</code>.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={(e) => void handleCreateByo(e)} className="space-y-4 mt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="role-arn">Role ARN</Label>
                  <Input
                    id="role-arn"
                    value={roleArn}
                    onChange={(e) => setRoleArn(e.target.value)}
                    placeholder="arn:aws:iam::123456789012:role/db-host-byo"
                    required
                    className="bg-white/5 border-border font-mono text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="bucket-name">Bucket name</Label>
                    <Input
                      id="bucket-name"
                      value={bucketName}
                      onChange={(e) => setBucketName(e.target.value)}
                      placeholder="my-sqlite-bucket"
                      required
                      className="bg-white/5 border-border font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bucket-region">Region</Label>
                    <select
                      id="bucket-region"
                      value={bucketRegion}
                      onChange={(e) => setBucketRegion(e.target.value)}
                      className="w-full h-9 rounded-md border border-border bg-white/5 px-3 text-xs text-foreground"
                    >
                      {AWS_REGIONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  We&apos;ll do a live <code className="text-cyan-400/90">AssumeRole</code> to validate,
                  then create the database — this takes a few seconds.
                </p>

                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 border-border"
                    onClick={() => back("byo_deploy")}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading || !roleArn.trim() || !bucketName.trim()}
                    className="flex-1 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white active:scale-[0.97] transition-all"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        Creating…
                      </>
                    ) : (
                      "Validate & create"
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          )}

          {/* ── Step 4: API key reveal ──────────────────────────────── */}
          {step === "api_key" && created && (
            <motion.div
              key="api_key"
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <DialogHeader>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <DialogTitle className="text-lg">Database created</DialogTitle>
                </div>
                <DialogDescription>
                  Copy this key now — it cannot be shown again. Use{" "}
                  <code className="text-cyan-400/90 font-mono text-xs">POST …/api-key</code> to rotate.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div className="space-y-1.5">
                  <Label>Database API key</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={created.api_key}
                      className="bg-black/50 border-border font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => void copyKey()}
                      className="shrink-0 border-border"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {created.bucket !== process.env.NEXT_PUBLIC_API_URL && (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-black/30 px-3 py-2">
                    <Server className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <p className="text-[11px] text-muted-foreground">
                      Stored in your bucket{" "}
                      <code className="text-sky-400/90">{created.bucket}</code>
                    </p>
                  </div>
                )}

                <Button
                  type="button"
                  className="w-full border-border"
                  variant="outline"
                  onClick={finishAndClose}
                >
                  Done
                </Button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
