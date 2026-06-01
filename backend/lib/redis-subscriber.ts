import Redis from "ioredis";

/**
 * Creates a dedicated Redis connection for pub/sub.
 *
 * WHY a separate client: a Redis connection in subscribe mode cannot execute
 * regular commands (GET, SET, PUBLISH, etc.). The shared `redis` client in
 * lib/redis.ts is used by BullMQ and the reservation service for normal ops.
 * Mixing both uses on the same connection would throw ERR_WRONG_TYPE errors.
 *
 * Each call returns a NEW connection — callers are responsible for calling
 * subscriber.quit() when they're done (e.g. on request abort).
 */
export function createRedisSubscriber(): Redis {
  return new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    lazyConnect: false,
    // No maxRetriesPerRequest here — sub connections are long-lived and
    // should retry indefinitely on disconnect.
  });
}
