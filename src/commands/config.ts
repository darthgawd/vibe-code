/**
 * vibe config Command
 *
 * View or modify configuration settings.
 *
 * Usage:
 *   vibe config                    - Show merged config
 *   vibe config --global           - Show global config
 *   vibe config get <key>          - Get specific value
 *   vibe config set <key> <value>  - Set a value
 *   vibe config set <key> <value> --global  - Set global value
 *
 * Security notes:
 * - Config values validated via Zod
 * - No secrets should be stored in config
 * - File paths validated
 */

import { resolve } from "path";
import chalk from "chalk";
import {
  loadConfig,
  readGlobalConfig,
  readProjectConfig,
  writeGlobalConfig,
  writeProjectConfig,
  isProjectInitialized,
  getGlobalConfigPath,
  getProjectConfigPath,
} from "../core/config-manager.js";
import {
  ModeSchema,
  ChecklistTypeSchema,
  StandardTypeSchema,
  type GlobalConfig,
  type ProjectConfig,
  ExitCode,
} from "../types/index.js";

/**
 * Options for the config command
 */
export interface ConfigOptions {
  global?: boolean | undefined;
}

/**
 * Valid config keys that can be set
 */
const VALID_KEYS = {
  global: ["defaultMode", "editor", "claudeCodePath", "includeSecurityChecklist", "includeStandards"],
  project: ["mode", "projectName", "includeSecurityChecklist", "includeStandards"],
} as const;

/**
 * Format a config value for display
 */
function formatValue(value: unknown): string {
  if (value === undefined) {
    return chalk.gray("(not set)");
  }
  if (Array.isArray(value)) {
    return chalk.cyan(JSON.stringify(value));
  }
  if (typeof value === "string") {
    return chalk.cyan(`"${value}"`);
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return chalk.cyan(String(value));
  }
  // For objects and other types, use JSON
  return chalk.cyan(JSON.stringify(value));
}

/**
 * Display configuration in a formatted table
 */
function displayConfig(
  config: Record<string, unknown>,
  title: string,
  configPath: string
): void {
  process.stdout.write("\n");
  process.stdout.write(chalk.white.bold(`${title}\n`));
  process.stdout.write(chalk.gray(`${configPath}\n`));
  process.stdout.write(chalk.gray("─".repeat(50) + "\n"));

  const entries = Object.entries(config);
  if (entries.length === 0) {
    process.stdout.write(chalk.gray("  (empty)\n"));
  } else {
    for (const [key, value] of entries) {
      const keyStr = chalk.white(key.padEnd(25));
      const valueStr = formatValue(value);
      process.stdout.write(`  ${keyStr} ${valueStr}\n`);
    }
  }
  process.stdout.write("\n");
}

/**
 * Show merged configuration
 */
async function showMergedConfig(projectRoot: string): Promise<void> {
  const initialized = await isProjectInitialized(projectRoot);

  if (!initialized) {
    process.stderr.write(
      chalk.yellow("Project not initialized. Showing global config only.\n")
    );
    process.stderr.write(
      chalk.gray("Run 'vibe init' to create project config.\n\n")
    );

    const globalResult = await readGlobalConfig();
    if (!globalResult.success) {
      process.stderr.write(chalk.red(`Error: ${globalResult.error.message}\n`));
      process.exit(ExitCode.CONFIG_ERROR);
      return;
    }

    displayConfig(
      globalResult.data as unknown as Record<string, unknown>,
      "Global Configuration",
      getGlobalConfigPath()
    );
    return;
  }

  const configResult = await loadConfig(projectRoot);
  if (!configResult.success) {
    process.stderr.write(chalk.red(`Error: ${configResult.error.message}\n`));
    process.exit(ExitCode.CONFIG_ERROR);
    return;
  }

  displayConfig(
    configResult.data as unknown as Record<string, unknown>,
    "Merged Configuration (Global + Project)",
    `${getGlobalConfigPath()} + ${getProjectConfigPath(projectRoot)}`
  );

  process.stdout.write(chalk.gray("Use --global to view/edit global config only.\n"));
  process.stdout.write(chalk.gray("Without --global, 'set' modifies project config.\n\n"));
}

/**
 * Show global configuration only
 */
async function showGlobalConfig(): Promise<void> {
  const globalResult = await readGlobalConfig();
  if (!globalResult.success) {
    process.stderr.write(chalk.red(`Error: ${globalResult.error.message}\n`));
    process.exit(ExitCode.CONFIG_ERROR);
    return;
  }

  displayConfig(
    globalResult.data as unknown as Record<string, unknown>,
    "Global Configuration",
    getGlobalConfigPath()
  );

  process.stdout.write(chalk.gray("Set values with: vibe config set <key> <value> --global\n\n"));
}

/**
 * Get a specific config value
 */
async function getConfigValue(
  projectRoot: string,
  key: string,
  isGlobal: boolean
): Promise<void> {
  let config: Record<string, unknown>;

  if (isGlobal) {
    const result = await readGlobalConfig();
    if (!result.success) {
      process.stderr.write(chalk.red(`Error: ${result.error.message}\n`));
      process.exit(ExitCode.CONFIG_ERROR);
      return;
    }
    config = result.data as unknown as Record<string, unknown>;
  } else {
    const result = await loadConfig(projectRoot);
    if (!result.success) {
      process.stderr.write(chalk.red(`Error: ${result.error.message}\n`));
      process.exit(ExitCode.CONFIG_ERROR);
      return;
    }
    config = result.data as unknown as Record<string, unknown>;
  }

  if (!(key in config)) {
    process.stderr.write(chalk.red(`Unknown config key: ${key}\n`));
    process.exit(ExitCode.INVALID_ARGUMENT);
    return;
  }

  const value = config[key];
  if (value === undefined) {
    process.stdout.write(chalk.gray("(not set)\n"));
  } else if (Array.isArray(value)) {
    process.stdout.write(JSON.stringify(value) + "\n");
  } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    process.stdout.write(String(value) + "\n");
  } else {
    process.stdout.write(JSON.stringify(value) + "\n");
  }
}

/**
 * Parse and validate a config value
 */
function parseConfigValue(key: string, value: string): unknown {
  // Handle mode
  if (key === "mode" || key === "defaultMode") {
    const result = ModeSchema.safeParse(value);
    if (!result.success) {
      throw new Error(`Invalid mode: "${value}". Valid: learning, guided, expert`);
    }
    return result.data;
  }

  // Handle checklist type
  if (key === "includeSecurityChecklist") {
    const result = ChecklistTypeSchema.safeParse(value);
    if (!result.success) {
      throw new Error(`Invalid checklist: "${value}". Valid: pre, post, owasp, api, full, none`);
    }
    return result.data;
  }

  // Handle standards array
  if (key === "includeStandards") {
    // Parse as JSON array or comma-separated
    let values: string[];
    if (value.startsWith("[")) {
      try {
        values = JSON.parse(value) as string[];
      } catch {
        throw new Error(`Invalid JSON array: ${value}`);
      }
    } else {
      values = value.split(",").map((v) => v.trim());
    }

    // Validate each value
    for (const v of values) {
      const result = StandardTypeSchema.safeParse(v);
      if (!result.success) {
        throw new Error(`Invalid standard: "${v}". Valid: typescript, api`);
      }
    }
    return values;
  }

  // String values
  return value;
}

/**
 * Set a config value
 */
async function setConfigValue(
  projectRoot: string,
  key: string,
  value: string,
  isGlobal: boolean
): Promise<void> {
  const validKeys: readonly string[] = isGlobal ? VALID_KEYS.global : VALID_KEYS.project;

  if (!validKeys.includes(key)) {
    process.stderr.write(chalk.red(`Invalid key for ${isGlobal ? "global" : "project"} config: ${key}\n`));
    process.stderr.write(chalk.gray(`Valid keys: ${validKeys.join(", ")}\n`));
    process.exit(ExitCode.INVALID_ARGUMENT);
    return;
  }

  // Parse and validate value
  let parsedValue: unknown;
  try {
    parsedValue = parseConfigValue(key, value);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid value";
    process.stderr.write(chalk.red(`${message}\n`));
    process.exit(ExitCode.INVALID_ARGUMENT);
    return;
  }

  if (isGlobal) {
    // Update global config
    const result = await readGlobalConfig();
    if (!result.success) {
      process.stderr.write(chalk.red(`Error: ${result.error.message}\n`));
      process.exit(ExitCode.CONFIG_ERROR);
      return;
    }

    const updated: GlobalConfig = {
      ...result.data,
      [key]: parsedValue,
    };

    const writeResult = await writeGlobalConfig(updated);
    if (!writeResult.success) {
      process.stderr.write(chalk.red(`Error: ${writeResult.error.message}\n`));
      process.exit(ExitCode.CONFIG_ERROR);
      return;
    }

    process.stdout.write(chalk.green(`✓ Set global ${key} = ${formatValue(parsedValue)}\n`));
  } else {
    // Check if project is initialized
    const initialized = await isProjectInitialized(projectRoot);
    if (!initialized) {
      process.stderr.write(
        chalk.red("Project not initialized. Run 'vibe init' first.\n")
      );
      process.stderr.write(
        chalk.gray("Or use --global to set global config.\n")
      );
      process.exit(ExitCode.CONFIG_ERROR);
      return;
    }

    // Update project config
    const result = await readProjectConfig(projectRoot);
    if (!result.success) {
      process.stderr.write(chalk.red(`Error: ${result.error.message}\n`));
      process.exit(ExitCode.CONFIG_ERROR);
      return;
    }

    const updated: ProjectConfig = {
      ...(result.data ?? {}),
      [key]: parsedValue,
    };

    const writeResult = await writeProjectConfig(projectRoot, updated);
    if (!writeResult.success) {
      process.stderr.write(chalk.red(`Error: ${writeResult.error.message}\n`));
      process.exit(ExitCode.CONFIG_ERROR);
      return;
    }

    process.stdout.write(chalk.green(`✓ Set project ${key} = ${formatValue(parsedValue)}\n`));
    process.stdout.write(chalk.gray("Run 'vibe start' to regenerate CLAUDE.md with new config.\n"));
  }
}

/**
 * Execute the config command (show config)
 */
export async function configCommand(options: ConfigOptions = {}): Promise<void> {
  const projectRoot = resolve(".");

  if (options.global === true) {
    await showGlobalConfig();
  } else {
    await showMergedConfig(projectRoot);
  }

  process.exit(ExitCode.SUCCESS);
}

/**
 * Execute config get subcommand
 */
export async function configGetCommand(
  key: string,
  options: ConfigOptions = {}
): Promise<void> {
  const projectRoot = resolve(".");
  await getConfigValue(projectRoot, key, options.global === true);
  process.exit(ExitCode.SUCCESS);
}

/**
 * Execute config set subcommand
 */
export async function configSetCommand(
  key: string,
  value: string,
  options: ConfigOptions = {}
): Promise<void> {
  const projectRoot = resolve(".");
  await setConfigValue(projectRoot, key, value, options.global === true);
  process.exit(ExitCode.SUCCESS);
}
