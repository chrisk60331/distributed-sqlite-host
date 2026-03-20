"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Plus, LogOut, Database, Sparkles, Shield, Play } from "lucide-react";
import { isAxiosError } from "axios";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import DbCard from "@/components/db-card";
import CreateDbDialog from "@/components/create-db-dialog";
import EnvPreviewDialog from "@/components/env-preview-dialog";
import { useAuth } from "@/hooks/use-auth";
import {
  checkAdminAccess,
  listDatabases,
  executeDatabaseScript,
  type Database as DB,
} from "@/lib/api";

const QUICKSTART_STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS hello (id INTEGER PRIMARY KEY, msg TEXT)",
  "INSERT INTO hello (msg) VALUES ('Hello, world')",
  "SELECT msg FROM hello WHERE id = 1",
  "SELECT id, msg FROM hello ORDER BY id DESC LIMIT 5",
];

export default function DashboardPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [databases, setDatabases] = useState<DB[]>([]);
  const [dbsLoading, setDbsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [envDb, setEnvDb] = useState<DB | null>(null);
  const [envOpen, setEnvOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [demoDbId, setDemoDbId] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoOutput, setDemoOutput] = useState<string | null>(null);

  const fetchDatabases = useCallback(async () => {
    try {
      const dbs = await listDatabases();
      setDatabases(dbs);
    } catch {
      toast.error("Failed to load databases");
    } finally {
      setDbsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    fetchDatabases();
    void checkAdminAccess().then(setIsAdmin);
  }, [authLoading, user, router, fetchDatabases]);

  useEffect(() => {
    if (databases.length === 0) {
      setDemoDbId(null);
      return;
    }
    setDemoDbId((id) => {
      if (id && databases.some((d) => d.db_id === id)) return id;
      return databases[0].db_id;
    });
  }, [databases]);

  const handleCreated = (db: DB) => {
    setDatabases((prev) => [db, ...prev]);
    // Immediately open env preview so user gets their connection string
    setEnvDb(db);
    setEnvOpen(true);
  };

  const handleDeleted = (db_id: string) => {
    setDatabases((prev) => prev.filter((d) => d.db_id !== db_id));
  };

  const handleEnvClick = (db: DB) => {
    setEnvDb(db);
    setEnvOpen(true);
  };

  const handleRunDemo = async () => {
    if (!demoDbId) return;
    setDemoLoading(true);
    setDemoOutput(null);
    try {
      const { steps } = await executeDatabaseScript(demoDbId, QUICKSTART_STATEMENTS);
      const last = [...steps].reverse().find((s) => s != null);
      if (!last || last.rows.length === 0) {
        setDemoOutput("");
        return;
      }
      const lines = last.rows.map((row) =>
        row.map((cell) => String(cell ?? "")).join("\t")
      );
      setDemoOutput(lines.join("\n"));
    } catch (e: unknown) {
      const detail =
        isAxiosError(e) && e.response?.data &&
        typeof (e.response.data as { detail?: unknown }).detail === "string"
          ? (e.response.data as { detail: string }).detail
          : "Request failed — check DB_HOST_TOKEN and the API.";
      toast.error(detail);
    } finally {
      setDemoLoading(false);
    }
  };

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-40 bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <span className="text-white font-bold text-xs">db</span>
            </div>
            <span className="font-semibold text-sm tracking-tight">db-host</span>
            <Separator orientation="vertical" className="h-4 bg-border" />
            <span className="text-sm text-muted-foreground">Dashboard</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:block">{user.email}</span>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs border-violet-500/30 bg-violet-500/5 text-violet-300 hover:text-violet-200 hover:bg-violet-500/10 active:scale-[0.97]"
                onClick={() => router.push("/admin")}
              >
                <Shield className="w-3.5 h-3.5" />
                Admin
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground text-xs"
              onClick={logout}
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Page title + CTA */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Your databases</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {databases.length === 0 && !dbsLoading
                ? "Create your first distributed SQLite database to get started."
                : `${databases.length} database${databases.length !== 1 ? "s" : ""} · S3-backed`}
            </p>
          </div>
          <Button
            className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white active:scale-[0.97] transition-all"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="w-4 h-4" />
            New database
          </Button>
        </div>

        {/* Loading skeleton */}
        {dbsLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-44 rounded-xl border border-border bg-card animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!dbsLoading && databases.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            {/* Floating illustration */}
            <div className="db-icon-float mb-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/15 to-cyan-500/10 border border-blue-500/20 flex items-center justify-center">
                <Database className="w-9 h-9 text-blue-400/70" />
              </div>
            </div>

            <h2 className="text-xl font-semibold">No databases yet</h2>
            <p className="text-muted-foreground text-sm mt-2 max-w-sm">
              Create a distributed SQLite database in seconds. You'll get a ready-to-use{" "}
              <code className="text-cyan-400 text-xs">.env</code> file with your connection string.
            </p>

            <Button
              className="mt-6 gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white active:scale-[0.97] transition-all"
              onClick={() => setCreateOpen(true)}
            >
              <Sparkles className="w-4 h-4" />
              Create your first database
            </Button>
          </motion.div>
        )}

        {/* Database grid */}
        {!dbsLoading && databases.length > 0 && (
          <AnimatePresence>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {databases.map((db, i) => (
                <DbCard
                  key={db.db_id}
                  db={db}
                  index={i}
                  onDeleted={handleDeleted}
                  onEnvClick={handleEnvClick}
                />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* How to connect (shown after first DB exists) */}
        {!dbsLoading && databases.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-10 rounded-xl border border-border bg-card p-6"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between mb-3">
              <h3 className="font-semibold text-sm">Hello world · db-host-client</h3>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                {databases.length > 1 && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="shrink-0">Run on</span>
                    <select
                      value={demoDbId ?? ""}
                      onChange={(e) => setDemoDbId(e.target.value)}
                      className="rounded-md border border-border bg-black/40 px-2 py-1.5 font-mono text-[11px] text-foreground max-w-[200px] sm:max-w-xs"
                    >
                      {databases.map((d) => (
                        <option key={d.db_id} value={d.db_id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!demoDbId || demoLoading}
                  className="gap-1.5 text-xs shrink-0"
                  onClick={() => void handleRunDemo()}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  {demoLoading ? "Running…" : "Run it"}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              <strong className="font-medium text-foreground/90">Run it</strong> calls{" "}
              <code className="text-cyan-400/90">POST /execute</code> with your dashboard session (same SQL
              as the snippet). From your app, install{" "}
              <code className="text-cyan-400/90">db-host-client</code>, set{" "}
              <code className="text-cyan-400/90">DB_HOST_DATABASE_API_KEY</code> from your downloaded{" "}
              <code className="text-cyan-400/90">.env</code>, and open{" "}
              <code className="text-cyan-400/90">distributed_sqlite</code> via STS-backed{" "}
              <code className="text-cyan-400/90">boto3_session</code> — no mutating{" "}
              <code className="text-cyan-400/90">AWS_*</code>.
            </p>
            <pre className="text-xs font-mono text-muted-foreground bg-black/40 rounded-lg p-4 overflow-x-auto">
{`import os

from sqlalchemy import text

from db_host_client.client import connect

# pip install /path/to/db_host/sdk
# Use DB_HOST_* from your downloaded .env (API key: once at create, or POST …/api-key).

API_KEY = os.environ["DB_HOST_DATABASE_API_KEY"]
BASE = os.environ["DB_HOST_API_URL"].rstrip("/")

with connect(api_key=API_KEY, api_base_url=BASE) as engine:
    with engine.begin() as conn:
        conn.execute(
            text("CREATE TABLE IF NOT EXISTS hello (id INTEGER PRIMARY KEY, msg TEXT)")
        )
        conn.execute(text("INSERT INTO hello (msg) VALUES ('Hello, world')"))
        msg = conn.execute(text("SELECT id, msg FROM hello ORDER BY id DESC LIMIT 5")).fetchall()
        for row in msg:
            print(row)
`}
            </pre>
            {demoOutput !== null && (
              <div className="mt-4">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Output</p>
                <pre className="text-xs font-mono text-cyan-400/90 bg-black/40 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">
                  {demoOutput}
                </pre>
              </div>
            )}
          </motion.div>
        )}
      </main>

      {/* Dialogs */}
      <CreateDbDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
      <EnvPreviewDialog
        db={envDb}
        open={envOpen}
        onOpenChange={setEnvOpen}
      />
    </div>
  );
}
