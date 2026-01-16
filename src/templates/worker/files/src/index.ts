/**
 * {{projectName}} - Background Worker
 *
 * BullMQ worker for processing background jobs.
 *
 * Security notes:
 * - Redis connection uses TLS in production
 * - Job data validated with Zod
 * - Graceful shutdown on SIGTERM
 */

import { Worker, Queue } from "bullmq";
import { env, redisConnection } from "./config/env.js";
import { processJob, JobDataSchema } from "./jobs/example.js";

/**
 * Create the worker
 */
function createWorker() {
  const worker = new Worker(
    env.QUEUE_NAME,
    async (job) => {
      console.log(`Processing job ${job.id}: ${job.name}`);

      // Validate job data
      const data = JobDataSchema.parse(job.data);

      // Process the job
      const result = await processJob(data);

      console.log(`Completed job ${job.id}`);
      return result;
    },
    {
      connection: redisConnection,
      concurrency: env.WORKER_CONCURRENCY,
    }
  );

  // Error handling
  worker.on("failed", (job, error) => {
    console.error(`Job ${job?.id} failed:`, error.message);
  });

  worker.on("error", (error) => {
    console.error("Worker error:", error);
  });

  return worker;
}

/**
 * Graceful shutdown
 */
async function shutdown(worker: Worker) {
  console.log("Shutting down worker...");

  // Close the worker gracefully
  await worker.close();

  console.log("Worker shut down");
  process.exit(0);
}

/**
 * Main entry point
 */
async function main() {
  console.log(`Starting {{projectName}} worker...`);
  console.log(`Queue: ${env.QUEUE_NAME}`);
  console.log(`Concurrency: ${env.WORKER_CONCURRENCY}`);

  const worker = createWorker();

  // Graceful shutdown handlers
  process.on("SIGTERM", () => shutdown(worker));
  process.on("SIGINT", () => shutdown(worker));

  console.log("Worker is running. Waiting for jobs...");
}

main().catch((error) => {
  console.error("Failed to start worker:", error);
  process.exit(1);
});
