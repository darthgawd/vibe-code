/**
 * vibe setup Command
 *
 * Interactive setup wizard for Claude Code installation and configuration.
 *
 * Usage:
 *   vibe setup             - Run interactive setup
 *   vibe setup --check     - Only check installation status
 *
 * Security notes:
 * - All installation steps require user confirmation
 * - No automatic downloads without consent
 * - Credentials are never stored by vibe-code
 */

import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import {
  getClaudeInstallInfo,
  installClaudeCode,
  getInstallInstructions,
  checkForUpdates,
  getUpdateInstructions,
  isClaudeAuthenticated,
  type InstallMethod,
} from "../core/claude-integration.js";
import { ExitCode } from "../types/index.js";

/**
 * Options for the setup command
 */
export interface SetupOptions {
  check?: boolean | undefined;
}

/**
 * Display setup header
 */
function displayHeader(): void {
  process.stdout.write("\n");
  process.stdout.write(chalk.cyan.bold("╔════════════════════════════════════════════╗\n"));
  process.stdout.write(chalk.cyan.bold("║") + chalk.white.bold("       vibe-code Setup Wizard              ") + chalk.cyan.bold("║\n"));
  process.stdout.write(chalk.cyan.bold("║") + chalk.gray("   Configure Claude Code integration       ") + chalk.cyan.bold("║\n"));
  process.stdout.write(chalk.cyan.bold("╚════════════════════════════════════════════╝\n"));
  process.stdout.write("\n");
}

/**
 * Display current installation status
 */
async function displayStatus(): Promise<boolean> {
  const spinner = ora("Checking Claude Code installation...").start();

  const info = await getClaudeInstallInfo();

  spinner.stop();

  process.stdout.write(chalk.white.bold("Current Status:\n"));
  process.stdout.write(chalk.gray("─".repeat(40) + "\n"));

  // Installation status
  if (info.installed) {
    process.stdout.write(chalk.green("  ✓ Claude Code installed\n"));
    process.stdout.write(chalk.gray(`    Path: ${info.path}\n`));
    process.stdout.write(chalk.gray(`    Version: ${info.version ?? "unknown"}\n`));
    process.stdout.write(chalk.gray(`    Method: ${info.installMethod}\n`));
  } else {
    process.stdout.write(chalk.red("  ✗ Claude Code not installed\n"));
  }

  // Compatibility status
  if (info.installed) {
    if (info.isRecommended) {
      process.stdout.write(chalk.green("  ✓ Version is recommended or newer\n"));
    } else if (info.isCompatible) {
      process.stdout.write(chalk.yellow("  ⚠ Version is compatible but upgrade recommended\n"));
    } else {
      process.stdout.write(chalk.red("  ✗ Version is not compatible\n"));
    }
  }

  // Authentication status
  if (info.installed) {
    if (info.authenticated) {
      process.stdout.write(chalk.green("  ✓ Authenticated with Anthropic\n"));
    } else {
      process.stdout.write(chalk.red("  ✗ Not authenticated\n"));
    }
  }

  process.stdout.write("\n");

  return info.installed && info.isCompatible && info.authenticated;
}

/**
 * Install Claude Code interactively
 */
async function interactiveInstall(): Promise<boolean> {
  process.stdout.write(chalk.white.bold("\n📦 Install Claude Code\n"));
  process.stdout.write(chalk.gray("─".repeat(40) + "\n"));

  const { shouldInstall } = await inquirer.prompt<{ shouldInstall: boolean }>([
    {
      type: "confirm",
      name: "shouldInstall",
      message: "Would you like to install Claude Code now?",
      default: true,
    },
  ]);

  if (!shouldInstall) {
    process.stdout.write(chalk.gray("\nSkipping installation.\n"));
    process.stdout.write(chalk.gray("You can install manually:\n"));
    process.stdout.write(getInstallInstructions());
    return false;
  }

  // Determine platform and offer appropriate options
  const platform = process.platform;
  const choices: Array<{ name: string; value: InstallMethod }> = [
    { name: "npm (Node Package Manager) - Recommended", value: "npm" },
  ];

  if (platform === "darwin") {
    choices.push({ name: "Homebrew (macOS package manager)", value: "brew" });
  }

  choices.push({ name: "Manual installation (I'll do it myself)", value: "manual" });

  const { installMethod } = await inquirer.prompt<{ installMethod: InstallMethod }>([
    {
      type: "list",
      name: "installMethod",
      message: "Choose installation method:",
      choices,
      default: "npm",
    },
  ]);

  if (installMethod === "manual") {
    process.stdout.write(chalk.white("\nManual Installation Instructions:\n"));
    process.stdout.write(getInstallInstructions());
    return false;
  }

  // Check prerequisites
  if (installMethod === "npm") {
    const spinner = ora("Checking npm...").start();
    const { spawn } = await import("child_process");

    const npmExists = await new Promise<boolean>((resolve) => {
      const proc = spawn("npm", ["--version"], { stdio: "ignore" });
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });

    if (!npmExists) {
      spinner.fail("npm not found");
      process.stdout.write(chalk.red("\nnpm is required for this installation method.\n"));
      process.stdout.write(chalk.gray("Install Node.js from https://nodejs.org\n"));
      return false;
    }
    spinner.succeed("npm is available");
  }

  if (installMethod === "brew") {
    const spinner = ora("Checking Homebrew...").start();
    const { spawn } = await import("child_process");

    const brewExists = await new Promise<boolean>((resolve) => {
      const proc = spawn("brew", ["--version"], { stdio: "ignore" });
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });

    if (!brewExists) {
      spinner.fail("Homebrew not found");
      process.stdout.write(chalk.red("\nHomebrew is required for this installation method.\n"));
      process.stdout.write(chalk.gray("Install from https://brew.sh\n"));
      return false;
    }
    spinner.succeed("Homebrew is available");
  }

  // Perform installation
  const spinner = ora("Installing Claude Code... (this may take a minute)").start();

  const result = await installClaudeCode(installMethod as "npm" | "brew");

  if (result.success) {
    spinner.succeed("Claude Code installed successfully!");
    return true;
  } else {
    spinner.fail("Installation failed");
    process.stdout.write(chalk.red(`\nError: ${result.error.message}\n`));
    process.stdout.write(chalk.gray("\nTry manual installation:\n"));
    process.stdout.write(getInstallInstructions());
    return false;
  }
}

/**
 * Guide user through authentication
 */
async function interactiveAuth(): Promise<boolean> {
  process.stdout.write(chalk.white.bold("\n🔐 Authentication\n"));
  process.stdout.write(chalk.gray("─".repeat(40) + "\n"));

  // Check current auth status
  const authenticated = await isClaudeAuthenticated();

  if (authenticated) {
    process.stdout.write(chalk.green("✓ Already authenticated with Anthropic.\n"));
    return true;
  }

  process.stdout.write(chalk.white("Claude Code requires authentication with your Anthropic account.\n\n"));

  const { authMethod } = await inquirer.prompt<{ authMethod: "browser" | "api-key" | "skip" }>([
    {
      type: "list",
      name: "authMethod",
      message: "How would you like to authenticate?",
      choices: [
        { name: "Browser login (recommended)", value: "browser" },
        { name: "API key (for CI/automation)", value: "api-key" },
        { name: "Skip for now", value: "skip" },
      ],
      default: "browser",
    },
  ]);

  if (authMethod === "skip") {
    process.stdout.write(chalk.yellow("\n⚠ Skipping authentication.\n"));
    process.stdout.write(chalk.gray("You'll need to run 'claude auth login' before using Claude Code.\n"));
    return false;
  }

  if (authMethod === "browser") {
    process.stdout.write(chalk.white("\nStarting browser authentication...\n"));
    process.stdout.write(chalk.gray("A browser window will open for you to log in.\n\n"));

    const { spawn } = await import("child_process");

    return new Promise<boolean>((resolve) => {
      const proc = spawn("claude", ["auth", "login"], {
        stdio: "inherit",
      });

      proc.on("close", async (code) => {
        if (code === 0) {
          // Verify authentication
          const verified = await isClaudeAuthenticated();
          if (verified) {
            process.stdout.write(chalk.green("\n✓ Authentication successful!\n"));
            resolve(true);
          } else {
            process.stdout.write(chalk.yellow("\n⚠ Authentication may not have completed.\n"));
            process.stdout.write(chalk.gray("Run 'claude auth login' to try again.\n"));
            resolve(false);
          }
        } else {
          process.stdout.write(chalk.red("\n✗ Authentication failed.\n"));
          resolve(false);
        }
      });

      proc.on("error", () => {
        process.stdout.write(chalk.red("\n✗ Failed to start authentication.\n"));
        process.stdout.write(chalk.gray("Run 'claude auth login' manually.\n"));
        resolve(false);
      });
    });
  }

  if (authMethod === "api-key") {
    process.stdout.write(chalk.white("\nAPI Key Authentication\n"));
    process.stdout.write(chalk.gray("Get your API key from https://console.anthropic.com\n\n"));

    process.stdout.write(chalk.yellow("⚠ Note: vibe-code does not store your API key.\n"));
    process.stdout.write(chalk.gray("You'll need to set the ANTHROPIC_API_KEY environment variable.\n\n"));

    process.stdout.write(chalk.white("Add to your shell profile (~/.bashrc, ~/.zshrc, etc.):\n"));
    process.stdout.write(chalk.cyan('  export ANTHROPIC_API_KEY="your-api-key-here"\n\n'));

    const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
      {
        type: "confirm",
        name: "confirmed",
        message: "Have you set up your API key?",
        default: false,
      },
    ]);

    return confirmed;
  }

  return false;
}

/**
 * Check for and offer updates
 */
async function checkAndOfferUpdate(): Promise<void> {
  const spinner = ora("Checking for updates...").start();

  const result = await checkForUpdates();

  if (!result.success) {
    spinner.warn("Unable to check for updates");
    return;
  }

  const { current, latest, updateAvailable } = result.data;

  if (!updateAvailable) {
    spinner.succeed(`Claude Code is up to date (v${current})`);
    return;
  }

  spinner.warn(`Update available: v${current} → v${latest}`);

  const { shouldUpdate } = await inquirer.prompt<{ shouldUpdate: boolean }>([
    {
      type: "confirm",
      name: "shouldUpdate",
      message: `Would you like to update to v${latest}?`,
      default: true,
    },
  ]);

  if (shouldUpdate) {
    const info = await getClaudeInstallInfo();
    const updateCmd = getUpdateInstructions(info.installMethod);

    process.stdout.write(chalk.white("\nTo update, run:\n"));
    process.stdout.write(chalk.cyan(`  ${updateCmd}\n\n`));
  }
}

/**
 * Display setup summary
 */
function displaySummary(installed: boolean, authenticated: boolean): void {
  process.stdout.write(chalk.white.bold("\n📋 Setup Summary\n"));
  process.stdout.write(chalk.gray("─".repeat(40) + "\n"));

  if (installed && authenticated) {
    process.stdout.write(chalk.green.bold("✓ Setup complete! You're ready to use vibe-code.\n\n"));
    process.stdout.write(chalk.white("Next steps:\n"));
    process.stdout.write(chalk.gray("  1. Navigate to your project directory\n"));
    process.stdout.write(chalk.gray("  2. Run ") + chalk.cyan("vibe init") + chalk.gray(" to initialize\n"));
    process.stdout.write(chalk.gray("  3. Run ") + chalk.cyan("vibe start") + chalk.gray(" to launch Claude Code\n"));
  } else {
    process.stdout.write(chalk.yellow("⚠ Setup incomplete.\n\n"));

    if (!installed) {
      process.stdout.write(chalk.white("Still needed:\n"));
      process.stdout.write(chalk.gray("  • Install Claude Code: ") + chalk.cyan("npm install -g @anthropic-ai/claude-code\n"));
    }

    if (!authenticated) {
      process.stdout.write(chalk.gray("  • Authenticate: ") + chalk.cyan("claude auth login\n"));
    }
  }

  process.stdout.write("\n");
}

/**
 * Execute the setup command
 */
export async function setupCommand(options: SetupOptions = {}): Promise<void> {
  displayHeader();

  // Check-only mode
  if (options.check) {
    const ready = await displayStatus();
    process.exit(ready ? ExitCode.SUCCESS : ExitCode.GENERAL_ERROR);
    return;
  }

  // Display current status
  const alreadyReady = await displayStatus();

  if (alreadyReady) {
    process.stdout.write(chalk.green.bold("✓ Everything is set up correctly!\n\n"));

    // Still offer to check for updates
    await checkAndOfferUpdate();

    process.stdout.write(chalk.gray("\nRun 'vibe init' in your project to get started.\n\n"));
    process.exit(ExitCode.SUCCESS);
    return;
  }

  // Interactive setup
  const info = await getClaudeInstallInfo();

  let installed = info.installed && info.isCompatible;
  let authenticated = info.authenticated;

  // Step 1: Install if needed
  if (!installed) {
    installed = await interactiveInstall();
  }

  // Step 2: Authenticate if needed
  if (installed && !authenticated) {
    authenticated = await interactiveAuth();
  }

  // Step 3: Check for updates if already installed
  if (info.installed && info.isCompatible) {
    await checkAndOfferUpdate();
  }

  // Display summary
  displaySummary(installed, authenticated);

  process.exit(installed && authenticated ? ExitCode.SUCCESS : ExitCode.GENERAL_ERROR);
}
