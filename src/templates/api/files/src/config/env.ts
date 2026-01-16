/**
 * Environment Configuration
 *
 * Validates and exports environment variables.
 * Fails fast if required variables are missing.
 *
 * Security notes:
 * - All env vars validated with Zod
 * - Secrets should come from env, never hardcoded
 * - Defaults are safe (restrictive)
 */

import { z } from "zod";

/**
 * Environment schema
 */
const EnvSchema = z.object({
  // Server
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default("127.0.0.1"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // Security
  CORS_ORIGINS: z
    .string()
    .transform((s) => s.split(",").map((o) => o.trim()))
    .default("http://localhost:3000"),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(100),
  RATE_LIMIT_WINDOW: z.string().default("1 minute"),
});

/**
 * Parse and validate environment variables
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
 * Type for environment variables
 */
export type Env = z.infer<typeof EnvSchema>;
