/**
 * Health Check Routes
 *
 * Provides endpoints for monitoring and readiness checks.
 *
 * Security notes:
 * - No sensitive information exposed
 * - Safe for public access
 */

import type { FastifyPluginAsync } from "fastify";

/**
 * Health response schema
 */
interface HealthResponse {
  status: "ok" | "error";
  timestamp: string;
  uptime: number;
}

/**
 * Health check routes
 */
export const healthRoutes: FastifyPluginAsync = async (server) => {
  /**
   * Basic health check
   * GET /health
   */
  server.get("/", async (): Promise<HealthResponse> => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  /**
   * Readiness check
   * GET /health/ready
   *
   * Use this for Kubernetes readiness probes.
   * Add database/cache checks here.
   */
  server.get("/ready", async (request, reply): Promise<HealthResponse> => {
    // Add your readiness checks here:
    // - Database connection
    // - Cache connection
    // - External service availability

    const isReady = true; // Replace with actual checks

    if (!isReady) {
      reply.status(503);
      return {
        status: "error",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
    }

    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  /**
   * Liveness check
   * GET /health/live
   *
   * Use this for Kubernetes liveness probes.
   * Should always return 200 if the process is running.
   */
  server.get("/live", async (): Promise<HealthResponse> => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });
};
