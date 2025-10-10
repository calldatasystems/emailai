"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type LogEntry = {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  metadata?: Record<string, any>;
  source?: string;
};

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    // Connect to log stream
    const eventSource = new EventSource("/api/admin/logs/stream");

    eventSource.onmessage = (event) => {
      const newLog: LogEntry = JSON.parse(event.data);
      setLogs((prev) => [newLog, ...prev].slice(0, 500)); // Keep last 500 logs
    };

    eventSource.onerror = () => {
      console.error("Log stream connection error");
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesFilter =
      filter === "" ||
      log.message.toLowerCase().includes(filter.toLowerCase()) ||
      log.source?.toLowerCase().includes(filter.toLowerCase());
    const matchesLevel = levelFilter === "all" || log.level === levelFilter;
    return matchesFilter && matchesLevel;
  });

  const getLevelColor = (level: string) => {
    switch (level) {
      case "error":
        return "destructive";
      case "warn":
        return "yellow";
      case "info":
        return "blue";
      case "debug":
        return "secondary";
      default:
        return "default";
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">System Logs</h1>
        <p className="text-muted-foreground">
          Real-time view of all application activity
        </p>
      </div>

      <Card className="mb-4 p-4">
        <div className="flex items-center gap-4">
          <Input
            placeholder="Search logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1"
          />
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="warn">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="debug">Debug</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={autoScroll ? "default" : "outline"}
            onClick={() => setAutoScroll(!autoScroll)}
          >
            Auto-scroll: {autoScroll ? "ON" : "OFF"}
          </Button>
          <Button variant="outline" onClick={() => setLogs([])}>
            Clear
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="max-h-[70vh] space-y-2 overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No logs to display
            </p>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="border-b border-border pb-2 last:border-0"
              >
                <div className="flex items-start gap-2">
                  <Badge variant={getLevelColor(log.level) as any}>
                    {log.level.toUpperCase()}
                  </Badge>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                      {log.source && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-xs">
                            {log.source}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="mt-1">{log.message}</p>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
