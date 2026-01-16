/**
 * Environment Configuration
 *
 * Security notes:
 * - Redis password should come from environment
 * - TLS enabled in production
 */

import { z } from "zod";
import { type RedisOptions } from "ioredis";

/**
 * Environment schema
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Redis
  REDIS_HOST: z.string().default("127.0.0.1"),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS: z.enum(["true", "false"]).default("false"),

  // Worker
  QUEUE_NAME: z.string().default("default"),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(5),
});

/**
 * Parse and validate environment
 */
function parseEnv() {
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    console.error("Invalid environment configuration:");
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

/**
 * Validated environment variables
 */
export const env = parseEnv();

/**
 * Redis connection configuration
 */
export const redisConnection: RedisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  tls: env.REDIS_TLS === "true" ? {} : undefined,
  maxRetriesPerRequest: null, // Required for BullMQ
};
