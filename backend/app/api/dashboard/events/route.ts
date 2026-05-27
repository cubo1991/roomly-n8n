import { NextRequest } from "next/server";
import { createRedisSubscriber } from "@/lib/redis-subscriber";
import { DASHBOARD_CHANNEL } from "@/lib/events";

/**
 * GET /api/dashboard/events
 *
 * Server-Sent Events endpoint. Keeps an HTTP connection open and streams
 * events to the browser as they arrive via Redis pub/sub.
 *
 * The browser connects once (via EventSource in LiveUpdates.tsx) and receives
 * a message every time a reservation is created, updated or cancelled.
 * On each message, the dashboard calls router.refresh() to re-run the
 * Server Components and update the table without a full page reload.
 *
 * Connection lifecycle:
 *   Browser opens EventSource → this handler subscribes to Redis channel
 *   Redis publishes event     → handler streams "data: {...}\n\n" to browser
 *   Browser tab closes        → req.signal aborts → Redis unsub + quit
 */

// Force Node.js runtime — Edge runtime doesn't support ioredis.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const subscriber = createRedisSubscriber();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial comment to flush headers immediately (some proxies buffer).
      controller.enqueue(encoder.encode(": connected\n\n"));

      await subscriber.subscribe(DASHBOARD_CHANNEL);

      subscriber.on("message", (_channel: string, message: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${message}\n\n`));
        } catch {
          // Controller already closed — ignore.
        }
      });

      // Heartbeat every 25 s keeps the connection alive through proxies and
      // load balancers that close idle connections after 30 s.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25_000);

      // Clean up when the client disconnects (tab close, navigation, etc.).
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        subscriber
          .unsubscribe(DASHBOARD_CHANNEL)
          .then(() => subscriber.quit())
          .catch(() => subscriber.disconnect());
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable buffering in nginx / Caddy so events arrive immediately.
      "X-Accel-Buffering": "no",
    },
  });
}
