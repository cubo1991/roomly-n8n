"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { DashboardEvent } from "@/lib/events";

/**
 * Mounts an EventSource connection to /api/dashboard/events.
 * On every message, calls router.refresh() so Next.js re-runs the Server
 * Components in the current route and the reservation table stays in sync
 * without a full page reload.
 *
 * This component renders nothing — it's a pure side-effect hook wrapper.
 * Mount it once inside the dashboard layout.
 */
export default function LiveUpdates() {
  const router = useRouter();
  // Keep a stable ref so the cleanup in useEffect always closes the right instance.
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    function connect() {
      const es = new EventSource("/api/dashboard/events");
      esRef.current = es;

      es.onmessage = (e: MessageEvent<string>) => {
        try {
          const event = JSON.parse(e.data) as DashboardEvent;
          console.debug("[LiveUpdates] received:", event.type, event.code ?? "");
        } catch {
          // Ignore malformed messages.
        }
        // Re-run all Server Components in the current route.
        // This is the idiomatic Next.js App Router way to refresh server data.
        router.refresh();
      };

      es.onerror = () => {
        // The browser will retry automatically after ~3 s (EventSource spec).
        // No manual reconnection needed.
        esRef.current = null;
      };
    }

    connect();

    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [router]);

  return null;
}
