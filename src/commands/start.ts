/**
 * vibe start Command
 *
 * Launches Claude Code with vibe-code configuration.
 * Ensures CLAUDE.md is up to date before launching.
 *
 * Security notes:
 * - Validates project is initialized
 * - Regenerates CLAUDE.md if config changed
 * - Uses safe process spawning (no shell)
 */

import { resolve } from "path";
import { stat } from "fs/promises";
import chalk from "chalk";
import ora from "ora";
import {
  isProjectInitialized,
  loadConfig,
  getProjectConfigPath,
} from "../core/config-manager.js";
import {
  buildClaudeMd,
  getClaudeMdPath,
} from "../core/prompt-builder.js";
import { switchMode, formatMode } from "../core/mode-manager.js";
import { runClaudeCode } from "../core/claude-launcher.js";
import { type Mode, ModeSchema, ExitCode } from "../types/index.js";

/**
 * Options for the start command
 */
export interface StartOptions {
  mode?: Mode | undefined;
  claudePath?: string | undefined;
  regenerate?: boolean | undefined;
}

/**
 * Check if CLAUDE.md needs to be regenerated
 * Returns true if config is newer than CLAUDE.md
 */
async function needsRegeneration(projectRoot: string): Promise<boolean> {
  const configPath = getProjectConfigPath(projectRoot);
  const claudeMdPath = getClaudeMdPath(projectRoot);

  try {
    const [configStat, claudeMdStat] = await Promise.all([
      stat(configPath),
      stat(claudeMdPath),
    ]);

    // If config is newer than CLAUDE.md, regenerate
    return configStat.mtime > claudeMdStat.mtime;
  } catch {
    // If either file doesn't exist, needs regeneration
    return true;
  }
}

/**
 * Execute the start command
 */
export async function startCommand(options: StartOptions = {}): Promise<void> {
  const projectRoot = resolve(".");

  // Check if project is initialized
  const initialized = await isProjectInitialized(projectRoot);
  if (!initialized) {
    process.stderr.write(
      chalk.red("Project not initialized. Run 'vibe init' first.\n")
    );
    process.exit(ExitCode.CONFIG_ERROR);
    return;
  }

  // Handle mode change if specified
  if (options.mode !== undefined) {
    const spinner = ora(`Switching to ${formatMode(options.mode)} mode...`).start();

    const switchResult = await switchMode(projectRoot, options.mode);
    if (!switchResult.success) {
      spinner.fail("Failed to switch mode");
      process.stderr.write(chalk.red(`Error: ${switchResult.error.message}\n`));
      process.exit(ExitCode.CONFIG_ERROR);
      return;
    }

    spinner.succeed(`Switched to ${formatMode(options.mode)} mode`);
  }

  // Load configuration
  const configResult = await loadConfig(projectRoot);
  if (!configResult.success) {
    process.stderr.write(
      chalk.red(`Failed to load configuration: ${configResult.error.message}\n`)
    );
    process.exit(ExitCode.CONFIG_ERROR);
    return;
  }

  const config = configResult.data;

  // Check if CLAUDE.md needs regeneration
  const shouldRegenerate =
    options.regenerate === true || (await needsRegeneration(projectRoot));

  if (shouldRegenerate) {
    const spinner = ora("Updating CLAUDE.md...").start();

    const buildResult = await buildClaudeMd(config, projectRoot);
    if (!buildResult.success) {
      spinner.fail("Failed to update CLAUDE.md");
      process.stderr.write(chalk.red(`Error: ${buildResult.error.message}\n`));
      process.exit(ExitCode.GENERAL_ERROR);
      return;
    }

    spinner.succeed("CLAUDE.md updated");
  }

  // Display current mode
  process.stdout.write(
    chalk.gray(`Mode: ${formatMode(config.mode)}\n`)
  );
  process.stdout.write(chalk.gray("Starting Claude Code...\n\n"));

  // Launch Claude Code
  const launchResult = await runClaudeCode({
    claudePath: config.claudeCodePath,
    cwd: projectRoot,
  });

  if (!launchResult.success) {
    process.stderr.write(chalk.red(`Error: ${launchResult.error.message}\n`));
    process.exit(ExitCode.GENERAL_ERROR);
    return;
  }

  // Exit with Claude Code's exit code
  process.exit(launchResult.data);
}

/**
 * Validate mode option from CLI
 */
export function validateModeOption(
  modeStr: string | undefined
): Mode | undefined {
  if (modeStr === undefined) {
    return undefined;
  }

  const result = ModeSchema.safeParse(modeStr);
  if (!result.success) {
    process.stderr.write(
      chalk.red(
        `Invalid mode: "${modeStr}". Valid modes: learning, guided, expert\n`
      )
    );
    process.exit(ExitCode.INVALID_ARGUMENT);
  }

  return result.data;
}
