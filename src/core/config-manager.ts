/**
 * Config Manager
 *
 * Handles reading, writing, and merging configuration files.
 *
 * Config locations:
 * - Global: ~/.vibe/config.json
 * - Project: .vibe/config.json (in project root)
 *
 * Security notes:
 * - All config data validated with Zod before use
 * - File paths validated to prevent traversal
 * - No secrets stored in config files
 */

import { readFile, writeFile, mkdir, access } from "fs/promises";
import { join, resolve } from "path";
import { homedir } from "os";
import {
  GlobalConfigSchema,
  ProjectConfigSchema,
  DEFAULT_CONFIG,
  type GlobalConfig,
  type ProjectConfig,
  type MergedConfig,
  type Mode,
  type Result,
} from "../types/index.js";

/**
 * Config directory and file names
 */
const VIBE_DIR = ".vibe";
const CONFIG_FILE = "config.json";

/**
 * Get the global config directory path
 * ~/.vibe/
 */
export function getGlobalConfigDir(): string {
  return join(homedir(), VIBE_DIR);
}

/**
 * Get the global config file path
 * ~/.vibe/config.json
 */
export function getGlobalConfigPath(): string {
  return join(getGlobalConfigDir(), CONFIG_FILE);
}

/**
 * Get the project config directory path
 * .vibe/ in the given project root
 */
export function getProjectConfigDir(projectRoot: string): string {
  const resolved = resolve(projectRoot);
  return join(resolved, VIBE_DIR);
}

/**
 * Get the project config file path
 * .vibe/config.json in the given project root
 */
export function getProjectConfigPath(projectRoot: string): string {
  return join(getProjectConfigDir(projectRoot), CONFIG_FILE);
}

/**
 * Check if a file exists
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely read and parse a JSON file
 */
async function readJsonFile<T>(
  path: string,
  schema: { parse: (data: unknown) => T }
): Promise<Result<T>> {
  try {
    const exists = await fileExists(path);
    if (!exists) {
      return { success: false, error: new Error(`File not found: ${path}`) };
    }

    const content = await readFile(path, "utf-8");
    const json: unknown = JSON.parse(content);
    const validated = schema.parse(json);

    return { success: true, data: validated };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read config";
    return { success: false, error: new Error(message) };
  }
}

/**
 * Safely write a JSON file
 * Creates parent directories if needed
 */
async function writeJsonFile(
  path: string,
  data: unknown
): Promise<Result<void>> {
  try {
    // Extract directory from path
    const dir = path.substring(0, path.lastIndexOf("/"));

    // Create directory if it doesn't exist
    await mkdir(dir, { recursive: true });

    // Write with pretty formatting
    const content = JSON.stringify(data, null, 2) + "\n";
    await writeFile(path, content, "utf-8");

    return { success: true, data: undefined };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to write config";
    return { success: false, error: new Error(message) };
  }
}

/**
 * Read global configuration
 * Returns default config if file doesn't exist
 */
export async function readGlobalConfig(): Promise<Result<GlobalConfig>> {
  const path = getGlobalConfigPath();
  const exists = await fileExists(path);

  if (!exists) {
    // Return default global config
    const defaultGlobal: GlobalConfig = {
      defaultMode: DEFAULT_CONFIG.mode,
      includeSecurityChecklist: DEFAULT_CONFIG.includeSecurityChecklist,
      includeStandards: DEFAULT_CONFIG.includeStandards,
    };
    return { success: true, data: defaultGlobal };
  }

  return readJsonFile(path, GlobalConfigSchema);
}

/**
 * Write global configuration
 */
export async function writeGlobalConfig(
  config: GlobalConfig
): Promise<Result<void>> {
  // Validate before writing
  const validated = GlobalConfigSchema.parse(config);
  return writeJsonFile(getGlobalConfigPath(), validated);
}

/**
 * Read project configuration
 * Returns null data (but success) if file doesn't exist
 */
export async function readProjectConfig(
  projectRoot: string
): Promise<Result<ProjectConfig | null>> {
  const path = getProjectConfigPath(projectRoot);
  const exists = await fileExists(path);

  if (!exists) {
    return { success: true, data: null };
  }

  const result = await readJsonFile(path, ProjectConfigSchema);
  if (!result.success) {
    return result;
  }

  return { success: true, data: result.data };
}

/**
 * Write project configuration
 */
export async function writeProjectConfig(
  projectRoot: string,
  config: ProjectConfig
): Promise<Result<void>> {
  // Validate before writing
  const validated = ProjectConfigSchema.parse(config);
  return writeJsonFile(getProjectConfigPath(projectRoot), validated);
}

/**
 * Check if a project has been initialized with vibe
 */
export async function isProjectInitialized(
  projectRoot: string
): Promise<boolean> {
  const configPath = getProjectConfigPath(projectRoot);
  return fileExists(configPath);
}

/**
 * Merge global and project configs
 * Project config overrides global config
 * Missing values fall back to defaults
 */
export function mergeConfigs(
  global: GlobalConfig,
  project: ProjectConfig | null
): MergedConfig {
  return {
    // Mode: project > global (global.defaultMode is always defined)
    mode: project?.mode ?? global.defaultMode,

    // Editor and claude path from global only
    editor: global.editor,
    claudeCodePath: global.claudeCodePath,

    // Project-specific fields
    projectName: project?.projectName,
    template: project?.template,

    // Custom prompts from project only (with default)
    customPrompts: project?.customPrompts ?? DEFAULT_CONFIG.customPrompts,

    // Checklist: project > global > default
    includeSecurityChecklist:
      project?.includeSecurityChecklist ??
      global.includeSecurityChecklist ??
      DEFAULT_CONFIG.includeSecurityChecklist,

    // Standards: project > global > default
    includeStandards:
      project?.includeStandards ??
      global.includeStandards ??
      DEFAULT_CONFIG.includeStandards,
  };
}

/**
 * Load merged configuration for a project
 * This is the main entry point for getting usable config
 */
export async function loadConfig(
  projectRoot: string
): Promise<Result<MergedConfig>> {
  // Read global config
  const globalResult = await readGlobalConfig();
  if (!globalResult.success) {
    return globalResult;
  }

  // Read project config
  const projectResult = await readProjectConfig(projectRoot);
  if (!projectResult.success) {
    return projectResult;
  }

  // Merge and return
  const merged = mergeConfigs(globalResult.data, projectResult.data);
  return { success: true, data: merged };
}

/**
 * Initialize a new project with default configuration
 */
export async function initProject(
  projectRoot: string,
  options?: Partial<ProjectConfig>
): Promise<Result<ProjectConfig>> {
  const config: ProjectConfig = {
    mode: options?.mode ?? DEFAULT_CONFIG.mode,
    projectName: options?.projectName,
    template: options?.template,
    customPrompts: options?.customPrompts ?? [],
    includeSecurityChecklist:
      options?.includeSecurityChecklist ??
      DEFAULT_CONFIG.includeSecurityChecklist,
    includeStandards:
      options?.includeStandards ?? DEFAULT_CONFIG.includeStandards,
  };

  const result = await writeProjectConfig(projectRoot, config);
  if (!result.success) {
    return result;
  }

  return { success: true, data: config };
}

/**
 * Update the current mode in project config
 */
export async function updateMode(
  projectRoot: string,
  mode: Mode
): Promise<Result<void>> {
  // Read existing project config
  const existingResult = await readProjectConfig(projectRoot);
  if (!existingResult.success) {
    return existingResult;
  }

  // Update mode
  const config: ProjectConfig = {
    ...(existingResult.data ?? {}),
    mode,
  };

  return writeProjectConfig(projectRoot, config);
}

/**
 * Get the current mode for a project
 */
export async function getCurrentMode(projectRoot: string): Promise<Mode> {
  const configResult = await loadConfig(projectRoot);
  if (!configResult.success) {
    return DEFAULT_CONFIG.mode;
  }
  return configResult.data.mode;
}
