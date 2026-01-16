/**
 * vibe mode Command
 *
 * View or switch between modes.
 * Regenerates CLAUDE.md when switching modes.
 *
 * Usage:
 *   vibe mode          - Show current mode and list all modes
 *   vibe mode <name>   - Switch to a new mode
 *
 * Security notes:
 * - Mode values validated via Zod
 * - No arbitrary code execution
 */

import { resolve } from "path";
import chalk from "chalk";
import ora from "ora";
import { isProjectInitialized } from "../core/config-manager.js";
import {
  getCurrentMode,
  switchMode,
  formatAllModes,
  parseMode,
  MODE_INFO,
  AVAILABLE_MODES,
} from "../core/mode-manager.js";
import { ExitCode } from "../types/index.js";

/**
 * Display current mode information
 */
async function showCurrentMode(projectRoot: string): Promise<void> {
  const modeResult = await getCurrentMode(projectRoot);
  if (!modeResult.success) {
    process.stderr.write(chalk.red(`Error: ${modeResult.error.message}\n`));
    process.exit(ExitCode.CONFIG_ERROR);
    return;
  }

  const mode = modeResult.data;
  const info = MODE_INFO[mode];

  process.stdout.write("\n");
  process.stdout.write(chalk.white.bold("Current Mode\n"));
  process.stdout.write(chalk.gray("─".repeat(40) + "\n"));
  process.stdout.write(`${info.icon} ${chalk.cyan.bold(info.name)}\n`);
  process.stdout.write(chalk.gray(`   ${info.description}\n`));
  process.stdout.write("\n");

  process.stdout.write(chalk.white.bold("Available Modes\n"));
  process.stdout.write(chalk.gray("─".repeat(40) + "\n"));

  for (const m of AVAILABLE_MODES) {
    const mInfo = MODE_INFO[m];
    const isCurrent = m === mode;
    const marker = isCurrent ? chalk.green(" ← current") : "";
    const name = isCurrent ? chalk.cyan.bold(mInfo.name) : chalk.white(mInfo.name);
    process.stdout.write(`${mInfo.icon} ${name.padEnd(20)}${marker}\n`);
    process.stdout.write(chalk.gray(`   ${mInfo.description}\n`));
  }

  process.stdout.write("\n");
  process.stdout.write(
    chalk.gray("Switch mode: ") + chalk.yellow("vibe mode <learning|guided|expert>\n")
  );
  process.stdout.write("\n");
}

/**
 * Switch to a new mode
 */
async function changeMode(projectRoot: string, newModeStr: string): Promise<void> {
  // Validate mode
  const parseResult = parseMode(newModeStr);
  if (!parseResult.success) {
    process.stderr.write(chalk.red(`${parseResult.error.message}\n`));
    process.exit(ExitCode.INVALID_ARGUMENT);
    return;
  }

  const newMode = parseResult.data;
  const newInfo = MODE_INFO[newMode];

  const spinner = ora(`Switching to ${newInfo.icon} ${newInfo.name} mode...`).start();

  const switchResult = await switchMode(projectRoot, newMode);
  if (!switchResult.success) {
    spinner.fail("Failed to switch mode");
    process.stderr.write(chalk.red(`Error: ${switchResult.error.message}\n`));
    process.exit(ExitCode.CONFIG_ERROR);
    return;
  }

  const { previousMode, newMode: resultMode } = switchResult.data;
  const prevInfo = MODE_INFO[previousMode];

  if (previousMode === resultMode) {
    spinner.succeed(`Already in ${newInfo.icon} ${newInfo.name} mode`);
    process.stdout.write(chalk.gray("CLAUDE.md regenerated.\n"));
  } else {
    spinner.succeed(`Switched from ${prevInfo.icon} ${prevInfo.name} to ${newInfo.icon} ${newInfo.name}`);
  }

  process.stdout.write("\n");
  process.stdout.write(chalk.gray(`${newInfo.description}\n`));
  process.stdout.write("\n");

  process.exit(ExitCode.SUCCESS);
}

/**
 * Execute the mode command
 */
export async function modeCommand(newMode?: string): Promise<void> {
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

  // If no mode specified, show current mode
  if (newMode === undefined || newMode === "") {
    await showCurrentMode(projectRoot);
    process.exit(ExitCode.SUCCESS);
    return;
  }

  // Switch to new mode
  await changeMode(projectRoot, newMode);
}

/**
 * Show a brief comparison of modes (for help text)
 */
export function getModeHelpText(): string {
  return formatAllModes();
}
