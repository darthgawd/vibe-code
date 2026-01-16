/**
 * vibe init Command
 *
 * Initializes a project with vibe-code configuration.
 * Creates .vibe/config.json and generates CLAUDE.md.
 *
 * Security notes:
 * - Only writes to current directory
 * - No network requests
 * - User input validated via Zod
 */

import { resolve } from "path";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import {
  isProjectInitialized,
  initProject,
  loadConfig,
  getProjectConfigPath,
} from "../core/config-manager.js";
import { buildClaudeMd, getClaudeMdPath } from "../core/prompt-builder.js";
import {
  AVAILABLE_MODES,
  MODE_INFO,
  formatMode,
} from "../core/mode-manager.js";
import { type Mode, type ProjectConfig, ExitCode } from "../types/index.js";

/**
 * Options for the init command
 */
export interface InitOptions {
  mode?: Mode | undefined;
  force?: boolean | undefined;
  yes?: boolean | undefined;
}

/**
 * Prompt user to select a mode
 */
async function promptForMode(): Promise<Mode> {
  const choices = AVAILABLE_MODES.map((mode) => {
    const info = MODE_INFO[mode];
    return {
      name: `${info.icon} ${info.name.padEnd(10)} - ${info.description}`,
      value: mode,
      short: info.name,
    };
  });

  const { selectedMode } = await inquirer.prompt<{ selectedMode: Mode }>([
    {
      type: "list",
      name: "selectedMode",
      message: "Select your development mode:",
      choices,
      default: "guided",
    },
  ]);

  return selectedMode;
}

/**
 * Prompt user to confirm initialization
 */
async function confirmInit(projectPath: string): Promise<boolean> {
  const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
    {
      type: "confirm",
      name: "confirmed",
      message: `Initialize vibe-code in ${projectPath}?`,
      default: true,
    },
  ]);

  return confirmed;
}

/**
 * Prompt user to confirm overwrite
 */
async function confirmOverwrite(): Promise<boolean> {
  const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
    {
      type: "confirm",
      name: "confirmed",
      message: chalk.yellow(
        "Project already initialized. Overwrite configuration?"
      ),
      default: false,
    },
  ]);

  return confirmed;
}

/**
 * Display success message
 */
function displaySuccess(
  mode: Mode,
  configPath: string,
  claudeMdPath: string
): void {
  const info = MODE_INFO[mode];

  process.stdout.write("\n");
  process.stdout.write(chalk.green.bold("✓ vibe-code initialized!\n\n"));

  process.stdout.write(chalk.white("Created files:\n"));
  process.stdout.write(chalk.gray(`  • ${configPath}\n`));
  process.stdout.write(chalk.gray(`  • ${claudeMdPath}\n\n`));

  process.stdout.write(chalk.white("Mode: ") + formatMode(mode) + "\n");
  process.stdout.write(chalk.gray(`  ${info.description}\n\n`));

  process.stdout.write(chalk.white("Next steps:\n"));
  process.stdout.write(chalk.cyan("  1. ") + "Review CLAUDE.md to see your prompt configuration\n");
  process.stdout.write(chalk.cyan("  2. ") + "Run " + chalk.yellow("vibe start") + " to launch Claude Code\n");
  process.stdout.write(chalk.cyan("  3. ") + "Use " + chalk.yellow("vibe mode <mode>") + " to switch modes\n");
  process.stdout.write("\n");
}

/**
 * Execute the init command
 */
export async function initCommand(options: InitOptions = {}): Promise<void> {
  const projectRoot = resolve(".");
  const configPath = getProjectConfigPath(projectRoot);
  const claudeMdPath = getClaudeMdPath(projectRoot);

  // Check if already initialized
  const alreadyInitialized = await isProjectInitialized(projectRoot);

  if (alreadyInitialized && options.force !== true) {
    if (options.yes === true) {
      process.stdout.write(
        chalk.yellow("Project already initialized. Use --force to overwrite.\n")
      );
      process.exit(ExitCode.GENERAL_ERROR);
      return;
    }

    const shouldOverwrite = await confirmOverwrite();
    if (!shouldOverwrite) {
      process.stdout.write(chalk.gray("Initialization cancelled.\n"));
      process.exit(ExitCode.SUCCESS);
      return;
    }
  }

  // Determine mode
  let mode: Mode;
  if (options.mode !== undefined) {
    mode = options.mode;
  } else if (options.yes === true) {
    mode = "guided"; // Default mode for non-interactive
  } else {
    // Show project path and confirm
    const shouldContinue = await confirmInit(projectRoot);
    if (!shouldContinue) {
      process.stdout.write(chalk.gray("Initialization cancelled.\n"));
      process.exit(ExitCode.SUCCESS);
      return;
    }

    mode = await promptForMode();
  }

  // Initialize project
  const spinner = ora("Initializing project...").start();

  const projectConfig: Partial<ProjectConfig> = {
    mode,
  };

  const initResult = await initProject(projectRoot, projectConfig);
  if (!initResult.success) {
    spinner.fail("Failed to create configuration");
    process.stderr.write(chalk.red(`Error: ${initResult.error.message}\n`));
    process.exit(ExitCode.CONFIG_ERROR);
    return;
  }

  spinner.text = "Generating CLAUDE.md...";

  // Load merged config and build CLAUDE.md
  const configResult = await loadConfig(projectRoot);
  if (!configResult.success) {
    spinner.fail("Failed to load configuration");
    process.stderr.write(chalk.red(`Error: ${configResult.error.message}\n`));
    process.exit(ExitCode.CONFIG_ERROR);
    return;
  }

  const buildResult = await buildClaudeMd(configResult.data, projectRoot);
  if (!buildResult.success) {
    spinner.fail("Failed to generate CLAUDE.md");
    process.stderr.write(chalk.red(`Error: ${buildResult.error.message}\n`));
    process.exit(ExitCode.GENERAL_ERROR);
    return;
  }

  spinner.succeed("Project initialized");

  // Display success message
  displaySuccess(mode, configPath, claudeMdPath);

  process.exit(ExitCode.SUCCESS);
}
