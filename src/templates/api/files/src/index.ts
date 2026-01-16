/**
 * {{projectName}} - API Entry Point
 *
 * Secure Fastify API with built-in security middleware.
 *
 * Security features:
 * - Helmet for HTTP security headers
 * - CORS with explicit origin allowlist
 * - Rate limiting to prevent abuse
 * - Input validation with Zod
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { healthRoutes } from "./routes/health.js";
import { env } from "./config/env.js";

/**
 * Build and configure the Fastify server
 */
async function buildServer() {
  const server = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      // Don't log sensitive headers
      redact: ["req.headers.authorization"],
    },
  });

  // Security: HTTP headers
  await server.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
      },
    },
  });

  // Security: CORS with explicit origins
  await server.register(cors, {
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  });

  // Security: Rate limiting
  await server.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
  });

  // Global error handler - don't leak internal errors
  server.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    // Don't expose internal error details in production
    const message =
      env.NODE_ENV === "production"
        ? "Internal server error"
        : error.message;

    reply.status(error.statusCode ?? 500).send({
      error: {
        code: "INTERNAL_ERROR",
        message,
      },
    });
  });

  // Register routes
  await server.register(healthRoutes, { prefix: "/health" });

  return server;
}

/**
 * Start the server
 */
async function main() {
  const server = await buildServer();

  try {
    await server.listen({
      port: env.PORT,
      host: env.HOST,
    });

    console.log(`Server running at http://${env.HOST}:${env.PORT}`);
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
}

main();
