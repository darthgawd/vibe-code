/**
 * Example Job Processor
 *
 * Template for job processing logic.
 *
 * Security notes:
 * - All job data validated with Zod
 * - No eval or dynamic code execution
 * - Errors don't leak sensitive info
 */

import { z } from "zod";

/**
 * Job data schema - validate all incoming data
 */
export const JobDataSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(["send-email", "generate-report", "cleanup"]),
  payload: z.record(z.unknown()).optional(),
});

export type JobData = z.infer<typeof JobDataSchema>;

/**
 * Job result type
 */
export interface JobResult {
  success: boolean;
  message: string;
  data?: unknown;
}

/**
 * Process a job
 */
export async function processJob(data: JobData): Promise<JobResult> {
  switch (data.action) {
    case "send-email":
      return sendEmail(data);

    case "generate-report":
      return generateReport(data);

    case "cleanup":
      return cleanup(data);

    default: {
      // Exhaustive check
      const _exhaustive: never = data.action;
      throw new Error(`Unknown action: ${_exhaustive}`);
    }
  }
}

/**
 * Send email job handler
 */
async function sendEmail(data: JobData): Promise<JobResult> {
  // TODO: Implement email sending
  console.log(`Sending email for user ${data.userId}`);

  // Simulate work
  await sleep(1000);

  return {
    success: true,
    message: "Email sent",
  };
}

/**
 * Generate report job handler
 */
async function generateReport(data: JobData): Promise<JobResult> {
  // TODO: Implement report generation
  console.log(`Generating report for user ${data.userId}`);

  // Simulate work
  await sleep(2000);

  return {
    success: true,
    message: "Report generated",
    data: { reportId: crypto.randomUUID() },
  };
}

/**
 * Cleanup job handler
 */
async function cleanup(data: JobData): Promise<JobResult> {
  // TODO: Implement cleanup logic
  console.log(`Running cleanup for user ${data.userId}`);

  // Simulate work
  await sleep(500);

  return {
    success: true,
    message: "Cleanup completed",
  };
}

/**
 * Helper: Sleep for ms milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
