"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Database, MoreHorizontal, FileText, Trash2, Globe, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteDatabase, type Database as DB } from "@/lib/api";

interface Props {
  db: DB;
  index: number;
  onDeleted: (db_id: string) => void;
  onEnvClick: (db: DB) => void;
}

export default function DbCard({ db, index, onDeleted, onEnvClick }: Props) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete "${db.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteDatabase(db.db_id);
      onDeleted(db.db_id);
      toast.success(`Deleted "${db.name}"`);
    } catch {
      toast.error("Failed to delete database");
      setDeleting(false);
    }
  };

  const created = new Date(db.created_at);
  const timeAgo = formatTimeAgo(created);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      style={{ opacity: deleting ? 0.4 : 1 }}
    >
      <Card className="group bg-card border-border hover:border-primary/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            {/* Left */}
            <div className="flex items-start gap-3 min-w-0">
              <div className="mt-0.5 w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center shrink-0 group-hover:from-blue-500/30 group-hover:to-cyan-500/30 transition-all">
                <Database className="w-4 h-4 text-blue-400" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm truncate">{db.name}</h3>
                <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                  {db.db_id.slice(0, 8)}…
                </p>
              </div>
            </div>

            {/* Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
              >
                <MoreHorizontal className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border-border w-44">
                <DropdownMenuItem
                  className="gap-2 cursor-pointer"
                  onClick={() => onEnvClick(db)}
                >
                  <FileText className="w-3.5 h-3.5" />
                  View .env file
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem
                  className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                  onClick={handleDelete}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Meta */}
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <Badge
              variant="outline"
              className="border-green-500/30 bg-green-500/10 text-green-400 text-xs gap-1"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              active
            </Badge>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Globe className="w-3 h-3" />
              {db.region}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {timeAgo}
            </span>
          </div>

          {/* Quick action */}
          <div className="mt-4 pt-4 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="w-full gap-2 text-xs text-muted-foreground hover:text-cyan-400 hover:bg-cyan-500/5 justify-start"
              onClick={() => onEnvClick(db)}
            >
              <FileText className="w-3.5 h-3.5" />
              Download connection .env
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
