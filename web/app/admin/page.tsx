"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import axios from "axios";
import {
  Shield,
  ChevronDown,
  ChevronRight,
  Database,
  Trash2,
  Users,
  LayoutGrid,
  ArrowLeft,
  Sparkles,
  Copy,
  Search,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import {
  getAdminBootstrap,
  adminDeleteUser,
  adminDeleteDatabase,
  type AdminBootstrap,
  type AdminDatabaseRow,
  type AdminUserRow,
} from "@/lib/api";

export default function AdminPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<AdminBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [danger, setDanger] = useState<
    | { kind: "user"; user: AdminUserRow; dbs: AdminDatabaseRow[] }
    | { kind: "db"; db: AdminDatabaseRow }
    | null
  >(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const b = await getAdminBootstrap();
      setData(b);
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 403) {
        toast.error("Admin only — this area is for operators you trust.");
        router.replace("/dashboard");
        return;
      }
      toast.error("Could not load the fleet. Check the API and try again.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    void load();
  }, [authLoading, user, router, load]);

  const userIds = useMemo(
    () => new Set(data?.users.map((u) => u.user_id) ?? []),
    [data]
  );

  const orphanDbs = useMemo(
    () => data?.databases.filter((d) => !userIds.has(d.user_id)) ?? [],
    [data, userIds]
  );

  const byUser = useMemo(() => {
    if (!data) return new Map<string, AdminDatabaseRow[]>();
    const m = new Map<string, AdminDatabaseRow[]>();
    for (const u of data.users) m.set(u.user_id, []);
    for (const d of data.databases) {
      let list = m.get(d.user_id);
      if (!list) {
        list = [];
        m.set(d.user_id, list);
      }
      list.push(d);
    }
    for (const list of m.values()) {
      list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    return m;
  }, [data]);

  const filteredUsers = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.users;
    return data.users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) || u.user_id.toLowerCase().includes(q)
    );
  }, [data, search]);

  const toggle = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyConn = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Connection URL copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const confirmDeleteUser = async () => {
    if (!danger || danger.kind !== "user") return;
    const uid = danger.user.user_id;
    try {
      const r = await adminDeleteUser(uid);
      toast.success(
        r.databases_removed
          ? `Removed user and ${r.databases_removed} database record(s) · S3 prefix cleared`
          : "User removed · S3 prefix cleared"
      );
      setDanger(null);
      setExpanded((e) => {
        const n = { ...e };
        delete n[uid];
        return n;
      });
      await load();
    } catch {
      toast.error("Could not remove that user");
    }
  };

  const confirmDeleteDb = async () => {
    if (!danger || danger.kind !== "db") return;
    const id = danger.db.db_id;
    try {
      await adminDeleteDatabase(id);
      toast.success(`Deleted "${danger.db.name}" · memory + S3 objects under prefix`);
      setDanger(null);
      await load();
    } catch {
      toast.error("Could not delete that database");
    }
  };

  if (authLoading || (!loading && !user)) return null;

  const userCount = data?.users.length ?? 0;
  const dbCount = data?.databases.length ?? 0;
  const avg =
    userCount === 0 ? "0" : (dbCount / userCount).toFixed(1);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 z-40 bg-background/85 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm tracking-tight">
                  db-host
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase tracking-wider border-violet-500/35 bg-violet-500/10 text-violet-300"
                >
                  Admin
                </Badge>
              </div>
            </div>
            <Separator orientation="vertical" className="h-5 bg-border hidden sm:block" />
            <span className="text-xs text-muted-foreground hidden sm:inline truncate">
              Fleet control
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground"
              onClick={() => router.push("/dashboard")}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Dashboard
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground"
              onClick={logout}
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-10 page-enter">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-10"
        >
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Run the whole show
          </h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-xl">
            Every account and every distributed database in one place. Deletes
            are real: Backboard memories go away and S3 prefixes are scrubbed.
          </p>
        </motion.div>

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 rounded-xl border border-border bg-card animate-pulse"
              />
            ))}
          </div>
        )}

        {!loading && data && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
              {[
                {
                  label: "Humans onboard",
                  value: userCount,
                  icon: Users,
                  hint: "registered accounts",
                  i: 0,
                },
                {
                  label: "Databases live",
                  value: dbCount,
                  icon: Database,
                  hint: "across all tenants",
                  i: 1,
                },
                {
                  label: "Avg DBs / user",
                  value: avg,
                  icon: LayoutGrid,
                  hint: "fleet density",
                  i: 2,
                },
              ].map((stat) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: stat.i * 0.06 }}
                >
                  <Card className="border-border bg-card/80 overflow-hidden relative ring-1 ring-violet-500/10">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent pointer-events-none" />
                    <CardContent className="p-4 relative">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                            {stat.label}
                          </p>
                          <p className="text-2xl font-semibold tabular-nums mt-1">
                            {stat.value}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {stat.hint}
                          </p>
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-violet-500/15 flex items-center justify-center">
                          <stat.icon className="w-5 h-5 text-violet-400" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Filter by email or user id…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-10 bg-card border-border"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 shrink-0 border-border active:scale-[0.97]"
                onClick={() => void load()}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Refresh fleet
              </Button>
            </div>

            {filteredUsers.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-xl border border-dashed border-border bg-card/40 py-20 text-center px-6"
              >
                <div className="inline-flex w-16 h-16 rounded-2xl bg-violet-500/10 items-center justify-center mb-4 db-icon-float">
                  <Users className="w-7 h-7 text-violet-400/80" />
                </div>
                <h2 className="font-semibold text-lg">Nobody matches that filter</h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                  Try a shorter search, or clear the box to see the full roster.
                </p>
                <Button
                  variant="outline"
                  className="mt-6"
                  onClick={() => setSearch("")}
                >
                  Clear search
                </Button>
              </motion.div>
            )}

            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {filteredUsers.map((u, idx) => {
                  const dbs = byUser.get(u.user_id) ?? [];
                  const open = expanded[u.user_id] ?? false;
                  return (
                    <motion.div
                      key={u.user_id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.25, delay: idx * 0.03 }}
                    >
                      <Card className="border-border bg-card overflow-hidden transition-all duration-200 hover:border-violet-500/25 hover:shadow-lg hover:shadow-violet-500/5">
                        <CardContent className="p-0">
                          <button
                            type="button"
                            onClick={() => toggle(u.user_id)}
                            className="w-full flex items-center gap-3 p-4 text-left hover:bg-violet-500/[0.03] transition-colors"
                          >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 flex items-center justify-center text-sm font-semibold text-violet-200 shrink-0">
                              {u.email.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{u.email}</p>
                              <p className="text-[11px] text-muted-foreground font-mono truncate">
                                {u.user_id}
                              </p>
                            </div>
                            <Badge variant="outline" className="border-border text-xs shrink-0">
                              {dbs.length} db{dbs.length !== 1 ? "s" : ""}
                            </Badge>
                            <div className="text-muted-foreground shrink-0">
                              {open ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </div>
                          </button>

                          <AnimatePresence initial={false}>
                            {open && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.28 }}
                                className="overflow-hidden border-t border-border"
                              >
                                <div className="p-4 pt-3 space-y-3 bg-black/20">
                                  {dbs.length === 0 ? (
                                    <p className="text-sm text-muted-foreground py-2">
                                      No databases yet — clean slate.
                                    </p>
                                  ) : (
                                    <ul className="space-y-2">
                                      {dbs.map((db) => (
                                        <li
                                          key={db.db_id}
                                          className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-border/80 bg-background/50 px-3 py-2.5"
                                        >
                                          <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <Database className="w-3.5 h-3.5 text-cyan-400/90 shrink-0" />
                                            <span className="font-medium text-sm truncate">
                                              {db.name}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground shrink-0">
                                              {db.region}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1 shrink-0">
                                            <Button
                                              variant="ghost"
                                              size="icon-sm"
                                              className="h-8 w-8 text-muted-foreground hover:text-cyan-400"
                                              title="Copy connection URL"
                                              onClick={() => void copyConn(db.connection_url)}
                                            >
                                              <Copy className="w-3.5 h-3.5" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="icon-sm"
                                              className="h-8 w-8 text-destructive hover:text-destructive"
                                              title="Delete database"
                                              onClick={() =>
                                                setDanger({ kind: "db", db })
                                              }
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                          </div>
                                        </li>
                                      ))}
                                    </ul>
                                  )}

                                  <div className="flex justify-end pt-1">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-destructive border-destructive/30 hover:bg-destructive/10 active:scale-[0.97] gap-2"
                                      onClick={() =>
                                        setDanger({ kind: "user", user: u, dbs })
                                      }
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      Remove user &amp; wipe prefix
                                    </Button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {orphanDbs.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-12 space-y-3"
              >
                <h2 className="text-sm font-semibold flex items-center gap-2 text-amber-400/90">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Orphaned databases
                </h2>
                <p className="text-xs text-muted-foreground">
                  These entries reference a user id that no longer exists in Backboard.
                  You can delete them to clean S3 and the registry.
                </p>
                <Card className="border-amber-500/25 bg-amber-500/[0.03]">
                  <CardContent className="p-4 space-y-2">
                    {orphanDbs.map((db) => (
                      <div
                        key={db.db_id}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-border/80 bg-background/50 px-3 py-2.5"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{db.name}</p>
                          <p className="text-[11px] text-muted-foreground font-mono truncate">
                            {db.user_id}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive shrink-0"
                          onClick={() => setDanger({ kind: "db", db })}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                          Delete
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.section>
            )}

            {userCount > 0 && dbCount === 0 && (
              <p className="text-center text-sm text-muted-foreground mt-10">
                No databases in the fleet yet — your people haven&apos;t spun any up.
              </p>
            )}
          </>
        )}
      </main>

      <Dialog open={!!danger} onOpenChange={(o) => !o && setDanger(null)}>
        <DialogContent className="sm:max-w-md border-border bg-card">
          <DialogHeader>
            <DialogTitle>
              {danger?.kind === "user"
                ? "Remove this account?"
                : "Delete this database?"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground space-y-2">
              {danger?.kind === "user" && (
                <>
                  <span className="block">
                    <strong className="text-foreground">{danger.user.email}</strong>{" "}
                    will lose access. {danger.dbs.length} database record
                    {danger.dbs.length !== 1 ? "s" : ""} will be removed and all S3
                    keys under{" "}
                    <code className="text-xs text-violet-300">
                      {danger.user.user_id}/
                    </code>{" "}
                    will be deleted.
                  </span>
                </>
              )}
              {danger?.kind === "db" && (
                <span className="block">
                  <strong className="text-foreground">{danger.db.name}</strong> for{" "}
                  <strong className="text-foreground">{danger.db.owner_email}</strong>
                  — the registry entry and S3 objects under its prefix disappear.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDanger(null)}>
              Cancel
            </Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-[0.97]"
              onClick={() => {
                if (danger?.kind === "user") void confirmDeleteUser();
                if (danger?.kind === "db") void confirmDeleteDb();
              }}
            >
              Confirm delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
