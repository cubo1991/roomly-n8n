/**
 * Shared event definitions for the SSE dashboard channel.
 * Published by the backend, consumed by the dashboard browser client.
 */

export const DASHBOARD_CHANNEL = "roomly:dashboard" as const;

export type DashboardEvent =
  | {
      type: "NEW_RESERVATION";
      code: string;
      guestName: string;
      room: string;
    }
  | {
      type: "RESERVATION_UPDATED";
      code: string;
    }
  | {
      type: "RESERVATION_CANCELLED";
      code: string;
    };
