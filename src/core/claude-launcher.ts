/**
 * Claude Launcher
 *
 * Spawns Claude Code as a subprocess.
 * Handles process lifecycle and signal forwarding.
 *
 * Security notes:
 * - Uses execFile with array args (no shell injection)
 * - Validates Claude Code path exists
 * - Forwards signals for clean shutdown
 * - No user input in command construction
 */

import { spawn, type ChildProcess } from "child_process";
import { access, constants } from "fs/promises";
import { resolve } from "path";
import type { Result } from "../types/index.js";

/**
 * Default Claude Code command
 */
const DEFAULT_CLAUDE_COMMAND = "claude";

/**
 * Check if a command exists in PATH or is an executable file
 */
async function commandExists(command: string): Promise<boolean> {
  // If it's an absolute path, check if file exists and is executable
  if (command.startsWith("/")) {
    try {
      await access(command, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  // For commands in PATH, try to find them using 'which'
  return new Promise((resolve) => {
    const which = spawn("which", [command], { stdio: "ignore" });
    which.on("close", (code) => {
      resolve(code === 0);
    });
    which.on("error", () => {
      resolve(false);
    });
  });
}

/**
 * Options for launching Claude Code
 */
export interface LaunchOptions {
  /** Custom path to Claude Code executable */
  claudePath?: string | undefined;
  /** Working directory for Claude Code */
  cwd?: string | undefined;
  /** Additional arguments to pass to Claude Code */
  args?: string[] | undefined;
  /** Environment variables to pass */
  env?: Record<string, string> | undefined;
}

/**
 * Result of launching Claude Code
 */
export interface LaunchResult {
  /** The spawned process */
  process: ChildProcess;
  /** The command that was executed */
  command: string;
  /** Arguments passed to the command */
  args: string[];
}

/**
 * Find the Claude Code executable
 */
export async function findClaudeCode(
  customPath?: string
): Promise<Result<string>> {
  // If custom path provided, validate it
  if (customPath !== undefined && customPath !== "") {
    const resolvedPath = resolve(customPath);
    const exists = await commandExists(resolvedPath);
    if (!exists) {
      return {
        success: false,
        error: new Error(`Claude Code not found at: ${resolvedPath}`),
      };
    }
    return { success: true, data: resolvedPath };
  }

  // Try default command
  const exists = await commandExists(DEFAULT_CLAUDE_COMMAND);
  if (exists) {
    return { success: true, data: DEFAULT_CLAUDE_COMMAND };
  }

  // Not found
  return {
    success: false,
    error: new Error(
      `Claude Code not found. Please install it or specify path with --claude-path.\n` +
        `Install: npm install -g @anthropic-ai/claude-code`
    ),
  };
}

/**
 * Launch Claude Code as a subprocess
 */
export async function launchClaudeCode(
  options: LaunchOptions = {}
): Promise<Result<LaunchResult>> {
  // Find Claude Code executable
  const findResult = await findClaudeCode(options.claudePath);
  if (!findResult.success) {
    return findResult;
  }

  const command = findResult.data;
  const args = options.args ?? [];
  const cwd = options.cwd ?? process.cwd();

  // Merge environment variables
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    ...(options.env ?? {}),
  };

  // Spawn Claude Code
  // Using spawn with stdio: 'inherit' to connect directly to terminal
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: "inherit", // Connect directly to parent's stdio
    // Don't use shell to avoid injection
  });

  // Forward termination signals to child
  const signalHandler = (signal: NodeJS.Signals): void => {
    child.kill(signal);
  };

  process.on("SIGINT", signalHandler);
  process.on("SIGTERM", signalHandler);
  process.on("SIGHUP", signalHandler);

  // Clean up signal handlers when child exits
  child.on("exit", () => {
    process.removeListener("SIGINT", signalHandler);
    process.removeListener("SIGTERM", signalHandler);
    process.removeListener("SIGHUP", signalHandler);
  });

  return {
    success: true,
    data: {
      process: child,
      command,
      args,
    },
  };
}

/**
 * Wait for Claude Code process to exit
 */
export function waitForExit(child: ChildProcess): Promise<number> {
  return new Promise((resolve) => {
    child.on("exit", (code) => {
      resolve(code ?? 0);
    });

    child.on("error", () => {
      resolve(1);
    });
  });
}

/**
 * Launch Claude Code and wait for it to exit
 */
export async function runClaudeCode(
  options: LaunchOptions = {}
): Promise<Result<number>> {
  const launchResult = await launchClaudeCode(options);
  if (!launchResult.success) {
    return launchResult;
  }

  const exitCode = await waitForExit(launchResult.data.process);
  return { success: true, data: exitCode };
}
