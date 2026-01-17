/**
 * vibe doctor Command
 *
 * Diagnose and fix issues with vibe-code and Claude Code setup.
 *
 * Usage:
 *   vibe doctor           - Run all diagnostics
 *   vibe doctor --fix     - Attempt to fix issues automatically
 *   vibe doctor --json    - Output results as JSON
 *
 * Security notes:
 * - Installation commands require user confirmation
 * - No automatic execution without explicit user consent
 */

import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import {
  runDiagnostics,
  getClaudeInstallInfo,
  checkForUpdates,
  installClaudeCode,
  getInstallInstructions,
  getUpdateInstructions,
  type DiagnosticReport,
  type DiagnosticCheck,
} from "../core/claude-integration.js";
import { isProjectInitialized, loadConfig } from "../core/config-manager.js";
import { ExitCode } from "../types/index.js";
import { resolve } from "path";

/**
 * Options for the doctor command
 */
export interface DoctorOptions {
  fix?: boolean | undefined;
  json?: boolean | undefined;
}

/**
 * Format a single diagnostic check for display
 */
function formatCheck(check: DiagnosticCheck): string {
  const statusIcon =
    check.status === "pass"
      ? chalk.green("✓")
      : check.status === "warn"
        ? chalk.yellow("⚠")
        : chalk.red("✗");

  const statusColor =
    check.status === "pass"
      ? chalk.green
      : check.status === "warn"
        ? chalk.yellow
        : chalk.red;

  let output = `${statusIcon} ${chalk.white.bold(check.name)}: ${statusColor(check.message)}\n`;

  if (check.details) {
    output += chalk.gray(`    ${check.details}\n`);
  }

  if (check.fix && check.status !== "pass") {
    output += chalk.cyan(`    Fix: ${check.fix}\n`);
  }

  return output;
}

/**
 * Format the overall status
 */
function formatOverallStatus(status: DiagnosticReport["overallStatus"]): string {
  switch (status) {
    case "healthy":
      return chalk.green.bold("✓ All systems healthy");
    case "degraded":
      return chalk.yellow.bold("⚠ Some issues detected");
    case "unhealthy":
      return chalk.red.bold("✗ Critical issues found");
  }
}

/**
 * Display the diagnostic report
 */
function displayReport(report: DiagnosticReport): void {
  process.stdout.write("\n");
  process.stdout.write(chalk.white.bold("🩺 vibe-code Health Check\n"));
  process.stdout.write(chalk.gray("─".repeat(50) + "\n\n"));

  // Display each check
  for (const check of report.checks) {
    process.stdout.write(formatCheck(check));
    process.stdout.write("\n");
  }

  // Display overall status
  process.stdout.write(chalk.gray("─".repeat(50) + "\n"));
  process.stdout.write(formatOverallStatus(report.overallStatus) + "\n\n");

  // Display Claude Code info summary
  if (report.claudeInfo.installed) {
    process.stdout.write(chalk.white.bold("Claude Code Info:\n"));
    process.stdout.write(chalk.gray(`  Path:     ${report.claudeInfo.path}\n`));
    process.stdout.write(chalk.gray(`  Version:  ${report.claudeInfo.version ?? "unknown"}\n`));
    process.stdout.write(chalk.gray(`  Install:  ${report.claudeInfo.installMethod}\n`));
    process.stdout.write(
      chalk.gray(`  Auth:     ${report.claudeInfo.authenticated ? "yes" : "no"}\n`)
    );
    process.stdout.write("\n");
  }
}

/**
 * Attempt to fix issues
 */
async function attemptFixes(report: DiagnosticReport): Promise<void> {
  const failedChecks = report.checks.filter((c) => c.status === "fail" && c.fix);

  if (failedChecks.length === 0) {
    process.stdout.write(chalk.green("No fixable issues found.\n"));
    return;
  }

  process.stdout.write(chalk.white.bold("\n🔧 Attempting to fix issues...\n\n"));

  // Check if Claude Code needs to be installed
  if (!report.claudeInfo.installed) {
    const { shouldInstall } = await inquirer.prompt<{ shouldInstall: boolean }>([
      {
        type: "confirm",
        name: "shouldInstall",
        message: "Claude Code is not installed. Would you like to install it now?",
        default: true,
      },
    ]);

    if (shouldInstall) {
      const { installMethod } = await inquirer.prompt<{ installMethod: "npm" | "brew" }>([
        {
          type: "list",
          name: "installMethod",
          message: "Choose installation method:",
          choices: [
            { name: "npm (recommended)", value: "npm" },
            { name: "Homebrew (macOS)", value: "brew" },
          ],
          default: "npm",
        },
      ]);

      const spinner = ora("Installing Claude Code...").start();

      const result = await installClaudeCode(installMethod);

      if (result.success) {
        spinner.succeed("Claude Code installed successfully!");
        process.stdout.write(chalk.cyan("\nNext step: Run 'claude auth login' to authenticate.\n"));
      } else {
        spinner.fail("Installation failed");
        process.stdout.write(chalk.red(`Error: ${result.error.message}\n`));
        process.stdout.write(chalk.yellow("\nManual installation:\n"));
        process.stdout.write(getInstallInstructions());
      }
    }
  }

  // Check for authentication
  if (report.claudeInfo.installed && !report.claudeInfo.authenticated) {
    process.stdout.write(chalk.yellow("\n⚠ Authentication required\n"));
    process.stdout.write(chalk.white("Run the following command to authenticate:\n"));
    process.stdout.write(chalk.cyan("  claude auth login\n\n"));
  }
}

/**
 * Check for updates and display info
 */
async function displayUpdateInfo(): Promise<void> {
  const spinner = ora("Checking for updates...").start();

  const updateResult = await checkForUpdates();

  if (!updateResult.success) {
    spinner.warn("Unable to check for updates");
    return;
  }

  const { current, latest, updateAvailable } = updateResult.data;

  if (updateAvailable) {
    spinner.warn(`Update available: ${current} → ${latest}`);

    const info = await getClaudeInstallInfo();
    process.stdout.write(chalk.cyan(`  Update command: ${getUpdateInstructions(info.installMethod)}\n\n`));
  } else {
    spinner.succeed(`Claude Code is up to date (${current})`);
  }
}

/**
 * Check project-specific health
 */
async function checkProjectHealth(): Promise<DiagnosticCheck[]> {
  const checks: DiagnosticCheck[] = [];
  const projectRoot = resolve(".");

  // Check if project is initialized
  const initialized = await isProjectInitialized(projectRoot);

  checks.push({
    name: "Project Initialization",
    status: initialized ? "pass" : "warn",
    message: initialized
      ? "Project is initialized with vibe-code"
      : "Project not initialized",
    details: initialized ? undefined : "Run 'vibe init' to initialize this project",
    fix: initialized ? undefined : "vibe init",
  });

  if (initialized) {
    // Check config validity
    const configResult = await loadConfig(projectRoot);

    checks.push({
      name: "Configuration",
      status: configResult.success ? "pass" : "fail",
      message: configResult.success
        ? `Mode: ${configResult.data.mode}`
        : "Configuration error",
      details: configResult.success ? undefined : configResult.error.message,
    });

    // Check CLAUDE.md exists
    const { existsSync } = await import("fs");
    const claudeMdExists = existsSync(resolve(projectRoot, "CLAUDE.md"));

    checks.push({
      name: "CLAUDE.md",
      status: claudeMdExists ? "pass" : "warn",
      message: claudeMdExists ? "CLAUDE.md exists" : "CLAUDE.md not found",
      details: claudeMdExists
        ? undefined
        : "CLAUDE.md will be regenerated on next 'vibe start'",
    });
  }

  return checks;
}

/**
 * Execute the doctor command
 */
export async function doctorCommand(options: DoctorOptions = {}): Promise<void> {
  // Run diagnostics
  const spinner = ora("Running diagnostics...").start();

  const report = await runDiagnostics();

  // Add project-specific checks
  const projectChecks = await checkProjectHealth();
  report.checks.push(...projectChecks);

  // Recalculate overall status
  const hasFailure = report.checks.some((c) => c.status === "fail");
  const hasWarning = report.checks.some((c) => c.status === "warn");
  report.overallStatus = hasFailure ? "unhealthy" : hasWarning ? "degraded" : "healthy";

  spinner.stop();

  // Output as JSON if requested
  if (options.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    process.exit(report.overallStatus === "unhealthy" ? ExitCode.GENERAL_ERROR : ExitCode.SUCCESS);
    return;
  }

  // Display the report
  displayReport(report);

  // Check for updates
  if (report.claudeInfo.installed) {
    await displayUpdateInfo();
  }

  // Attempt fixes if requested
  if (options.fix) {
    await attemptFixes(report);
  } else if (report.overallStatus !== "healthy") {
    process.stdout.write(chalk.gray("Run 'vibe doctor --fix' to attempt automatic fixes.\n\n"));
  }

  // Exit with appropriate code
  process.exit(
    report.overallStatus === "unhealthy" ? ExitCode.GENERAL_ERROR : ExitCode.SUCCESS
  );
}
