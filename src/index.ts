#!/usr/bin/env node

/**
 * Vibe Code CLI - Entry Point
 *
 * Security-first CLI wrapper for Claude Code.
 * Injects opinionated prompts and enforces workflows.
 *
 * Security notes:
 * - No eval() or dynamic code execution
 * - All user input validated via Zod
 * - Minimal dependencies, all audited
 */

import { Command } from "commander";
import chalk from "chalk";
import { ExitCode, ModeSchema, type VersionInfo } from "./types/index.js";
import { initCommand, type InitOptions } from "./commands/init.js";
import { startCommand, validateModeOption, type StartOptions } from "./commands/start.js";
import { modeCommand } from "./commands/mode.js";
import {
  configCommand,
  configGetCommand,
  configSetCommand,
  type ConfigOptions,
} from "./commands/config.js";
import { templateCommand, type TemplateOptions } from "./commands/template.js";
import { doctorCommand, type DoctorOptions } from "./commands/doctor.js";
import { setupCommand, type SetupOptions } from "./commands/setup.js";

// Version from package.json - loaded at build time
const VERSION = "0.1.0";

/**
 * Get version information for --version flag
 */
function getVersionInfo(): VersionInfo {
  return {
    version: VERSION,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
  };
}

/**
 * Format version output
 */
function formatVersion(): string {
  const info = getVersionInfo();
  return [
    `vibe-code v${info.version}`,
    `Node.js ${info.nodeVersion}`,
    `${info.platform} ${info.arch}`,
  ].join("\n");
}

/**
 * Display welcome banner
 */
function showBanner(): void {
  const banner = `
${chalk.cyan.bold("┌─────────────────────────────────────┐")}
${chalk.cyan.bold("│")}  ${chalk.white.bold("vibe-code")} ${chalk.gray("- Security-First AI")}    ${chalk.cyan.bold("│")}
${chalk.cyan.bold("│")}  ${chalk.gray("Wrapper for Claude Code")}           ${chalk.cyan.bold("│")}
${chalk.cyan.bold("└─────────────────────────────────────┘")}
`;
  // Using process.stdout for banner display (not console.log)
  process.stdout.write(banner + "\n");
}

/**
 * Main CLI program
 */
function createProgram(): Command {
  const program = new Command();

  program
    .name("vibe")
    .description(
      "Security-first CLI wrapper for Claude Code with opinionated prompts and guardrails"
    )
    .version(formatVersion(), "-v, --version", "Display version information")
    .option("--no-banner", "Suppress the welcome banner")
    .hook("preAction", (thisCommand) => {
      const opts: { banner?: boolean } = thisCommand.opts();
      if (opts.banner !== false) {
        showBanner();
      }
    });

  // Init command
  program
    .command("init")
    .description("Initialize vibe-code in the current project")
    .option("-m, --mode <mode>", "Set initial mode: learning, guided, or expert")
    .option("-f, --force", "Overwrite existing configuration")
    .option("-y, --yes", "Skip prompts and use defaults")
    .action(async (opts: { mode?: string; force?: boolean; yes?: boolean }) => {
      const options: InitOptions = {
        force: opts.force,
        yes: opts.yes,
      };

      // Validate mode if provided
      if (opts.mode !== undefined) {
        const modeResult = ModeSchema.safeParse(opts.mode);
        if (!modeResult.success) {
          process.stderr.write(
            chalk.red(`Invalid mode: "${opts.mode}". Valid modes: learning, guided, expert\n`)
          );
          process.exit(ExitCode.INVALID_ARGUMENT);
          return;
        }
        options.mode = modeResult.data;
      }

      await initCommand(options);
    });

  // Start command
  program
    .command("start")
    .description("Launch Claude Code with vibe-code configuration")
    .option("-m, --mode <mode>", "Set mode: learning, guided, or expert")
    .option("--claude-path <path>", "Custom path to Claude Code executable")
    .option("-r, --regenerate", "Force regenerate CLAUDE.md before starting")
    .action(async (opts: { mode?: string; claudePath?: string; regenerate?: boolean }) => {
      const options: StartOptions = {
        mode: validateModeOption(opts.mode),
        claudePath: opts.claudePath,
        regenerate: opts.regenerate,
      };

      await startCommand(options);
    });

  // Mode command
  program
    .command("mode [newMode]")
    .description("View or change the current mode (learning, guided, expert)")
    .action(async (newMode?: string) => {
      await modeCommand(newMode);
    });

  // Config command with subcommands
  const configCmd = program
    .command("config")
    .description("View or modify configuration")
    .option("-g, --global", "Use global configuration (~/.vibe/config.json)")
    .action(async (opts: { global?: boolean }) => {
      const options: ConfigOptions = { global: opts.global };
      await configCommand(options);
    });

  configCmd
    .command("get <key>")
    .description("Get a specific configuration value")
    .option("-g, --global", "Get from global configuration")
    .action(async (key: string, opts: { global?: boolean }) => {
      const options: ConfigOptions = { global: opts.global };
      await configGetCommand(key, options);
    });

  configCmd
    .command("set <key> <value>")
    .description("Set a configuration value")
    .option("-g, --global", "Set in global configuration")
    .action(async (key: string, value: string, opts: { global?: boolean }) => {
      const options: ConfigOptions = { global: opts.global };
      await configSetCommand(key, value, options);
    });

  // Doctor command - diagnose and fix issues
  program
    .command("doctor")
    .description("Diagnose and fix issues with Claude Code setup")
    .option("--fix", "Attempt to fix issues automatically")
    .option("--json", "Output results as JSON")
    .action(async (opts: { fix?: boolean; json?: boolean }) => {
      const options: DoctorOptions = {
        fix: opts.fix,
        json: opts.json,
      };
      await doctorCommand(options);
    });

  // Setup command - interactive setup wizard
  program
    .command("setup")
    .description("Interactive setup wizard for Claude Code")
    .option("--check", "Only check installation status")
    .action(async (opts: { check?: boolean }) => {
      const options: SetupOptions = {
        check: opts.check,
      };
      await setupCommand(options);
    });

  // Placeholder commands - will be implemented in subsequent bricks
  program
    .command("audit [path]")
    .description("Run security audit on existing code")
    .action(() => {
      process.stdout.write(
        chalk.yellow("Command 'audit' not yet implemented.\n")
      );
      process.exit(ExitCode.SUCCESS);
    });

  // Template command
  program
    .command("template [name]")
    .description("Scaffold a project from a secure template")
    .option("-d, --directory <dir>", "Target directory for the project")
    .option("-f, --force", "Overwrite existing files")
    .option("-y, --yes", "Skip prompts and use defaults")
    .action(async (name?: string, opts?: { directory?: string; force?: boolean; yes?: boolean }) => {
      const options: TemplateOptions = {
        directory: opts?.directory,
        force: opts?.force,
        yes: opts?.yes,
      };
      await templateCommand(name, options);
    });

  return program;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const program = createProgram();
    await program.parseAsync(process.argv);
  } catch (error: unknown) {
    // Safe error handling - don't leak sensitive info
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    process.stderr.write(chalk.red(`Error: ${message}\n`));
    process.exit(ExitCode.GENERAL_ERROR);
  }
}

// Execute
void main();
