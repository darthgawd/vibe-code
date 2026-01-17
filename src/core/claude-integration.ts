/**
 * Claude Code Integration
 *
 * Comprehensive integration with Claude Code including:
 * - Installation detection and validation
 * - Version checking and compatibility
 * - Installation guidance
 * - Health checks and diagnostics
 *
 * Security notes:
 * - No shell execution with user input
 * - Version strings validated before use
 * - No automatic code execution from external sources
 */

import { spawn } from "child_process";
import { access, constants, readFile, writeFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import type { Result } from "../types/index.js";

/**
 * Minimum supported Claude Code version
 */
export const MIN_CLAUDE_VERSION = "1.0.0";

/**
 * Recommended Claude Code version
 */
export const RECOMMENDED_CLAUDE_VERSION = "1.5.0";

/**
 * Claude Code installation methods
 */
export type InstallMethod = "npm" | "brew" | "manual" | "unknown";

/**
 * Claude Code installation info
 */
export interface ClaudeInstallInfo {
  installed: boolean;
  path: string | null;
  version: string | null;
  installMethod: InstallMethod;
  isCompatible: boolean;
  isRecommended: boolean;
  configPath: string | null;
  authenticated: boolean;
}

/**
 * Diagnostic result for a single check
 */
export interface DiagnosticCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
  details?: string | undefined;
  fix?: string | undefined;
}

/**
 * Full diagnostic report
 */
export interface DiagnosticReport {
  timestamp: Date;
  checks: DiagnosticCheck[];
  overallStatus: "healthy" | "degraded" | "unhealthy";
  claudeInfo: ClaudeInstallInfo;
}

/**
 * Parse a semantic version string
 */
function parseVersion(version: string): { major: number; minor: number; patch: number } | null {
  const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match || !match[1] || !match[2] || !match[3]) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Compare two version strings
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
  const vA = parseVersion(a);
  const vB = parseVersion(b);

  if (!vA || !vB) return 0;

  if (vA.major !== vB.major) return vA.major > vB.major ? 1 : -1;
  if (vA.minor !== vB.minor) return vA.minor > vB.minor ? 1 : -1;
  if (vA.patch !== vB.patch) return vA.patch > vB.patch ? 1 : -1;
  return 0;
}

/**
 * Execute a command and capture output
 */
async function execCommand(
  command: string,
  args: string[],
  timeout = 10000
): Promise<Result<string>> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const proc = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      timeout,
    });

    const timeoutId = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
    }, timeout);

    proc.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      clearTimeout(timeoutId);
      if (timedOut) {
        resolve({ success: false, error: new Error("Command timed out") });
      } else if (code === 0) {
        resolve({ success: true, data: stdout.trim() });
      } else {
        resolve({ success: false, error: new Error(stderr || `Exit code: ${code}`) });
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timeoutId);
      resolve({ success: false, error: err });
    });
  });
}

/**
 * Find Claude Code executable path
 */
export async function findClaudePath(): Promise<string | null> {
  // Try 'which' on Unix-like systems
  const whichResult = await execCommand("which", ["claude"]);
  if (whichResult.success && whichResult.data) {
    return whichResult.data;
  }

  // Try common installation paths
  const commonPaths = [
    join(homedir(), ".npm-global", "bin", "claude"),
    join(homedir(), ".local", "bin", "claude"),
    "/usr/local/bin/claude",
    "/usr/bin/claude",
    "/opt/homebrew/bin/claude",
  ];

  for (const path of commonPaths) {
    try {
      await access(path, constants.X_OK);
      return path;
    } catch {
      // Continue to next path
    }
  }

  return null;
}

/**
 * Get Claude Code version
 */
export async function getClaudeVersion(claudePath?: string): Promise<string | null> {
  const path = claudePath ?? "claude";
  const result = await execCommand(path, ["--version"]);

  if (!result.success) return null;

  // Parse version from output (e.g., "claude 1.5.0" or "v1.5.0")
  const match = result.data.match(/v?(\d+\.\d+\.\d+)/);
  return match && match[1] ? match[1] : null;
}

/**
 * Detect how Claude Code was installed
 */
export async function detectInstallMethod(claudePath: string | null): Promise<InstallMethod> {
  if (!claudePath) return "unknown";

  // Check if it's an npm global install
  if (claudePath.includes(".npm") || claudePath.includes("node_modules")) {
    return "npm";
  }

  // Check if it's a Homebrew install
  if (claudePath.includes("homebrew") || claudePath.includes("Cellar")) {
    return "brew";
  }

  // Check if npm knows about it
  const npmResult = await execCommand("npm", ["list", "-g", "@anthropic-ai/claude-code"]);
  if (npmResult.success && !npmResult.data.includes("empty")) {
    return "npm";
  }

  // Check if brew knows about it
  const brewResult = await execCommand("brew", ["list", "claude-code"]);
  if (brewResult.success) {
    return "brew";
  }

  return "manual";
}

/**
 * Check if Claude Code is authenticated
 */
export async function isClaudeAuthenticated(claudePath?: string): Promise<boolean> {
  const path = claudePath ?? "claude";

  // Check for authentication by running a minimal command
  // Claude Code typically stores auth in ~/.config/claude-code or similar
  const configPaths = [
    join(homedir(), ".config", "claude-code", "config.json"),
    join(homedir(), ".claude-code", "config.json"),
    join(homedir(), ".config", "anthropic", "credentials.json"),
  ];

  for (const configPath of configPaths) {
    try {
      const content = await readFile(configPath, "utf-8");
      const config = JSON.parse(content);
      // Check for API key or auth token
      if (config.apiKey || config.authToken || config.authenticated) {
        return true;
      }
    } catch {
      // Continue to next path
    }
  }

  // Try running claude with a check command if available
  const result = await execCommand(path, ["auth", "status"], 5000);
  if (result.success && result.data.toLowerCase().includes("authenticated")) {
    return true;
  }

  return false;
}

/**
 * Get Claude Code config path
 */
export async function getClaudeConfigPath(): Promise<string | null> {
  const configPaths = [
    join(homedir(), ".config", "claude-code"),
    join(homedir(), ".claude-code"),
  ];

  for (const path of configPaths) {
    try {
      await access(path, constants.R_OK);
      return path;
    } catch {
      // Continue
    }
  }

  return null;
}

/**
 * Get comprehensive Claude Code installation info
 */
export async function getClaudeInstallInfo(): Promise<ClaudeInstallInfo> {
  const path = await findClaudePath();
  const installed = path !== null;

  if (!installed) {
    return {
      installed: false,
      path: null,
      version: null,
      installMethod: "unknown",
      isCompatible: false,
      isRecommended: false,
      configPath: null,
      authenticated: false,
    };
  }

  const version = await getClaudeVersion(path);
  const installMethod = await detectInstallMethod(path);
  const configPath = await getClaudeConfigPath();
  const authenticated = await isClaudeAuthenticated(path);

  const isCompatible = version ? compareVersions(version, MIN_CLAUDE_VERSION) >= 0 : false;
  const isRecommended = version ? compareVersions(version, RECOMMENDED_CLAUDE_VERSION) >= 0 : false;

  return {
    installed,
    path,
    version,
    installMethod,
    isCompatible,
    isRecommended,
    configPath,
    authenticated,
  };
}

/**
 * Get installation instructions based on platform
 */
export function getInstallInstructions(): string {
  const platform = process.platform;

  const npmInstructions = `
  Using npm (recommended):
    npm install -g @anthropic-ai/claude-code

  After installation, authenticate:
    claude auth login
`;

  const brewInstructions = `
  Using Homebrew (macOS):
    brew install anthropic/tap/claude-code

  Or using npm:
    npm install -g @anthropic-ai/claude-code

  After installation, authenticate:
    claude auth login
`;

  const linuxInstructions = `
  Using npm:
    npm install -g @anthropic-ai/claude-code

  Or download from:
    https://github.com/anthropics/claude-code/releases

  After installation, authenticate:
    claude auth login
`;

  switch (platform) {
    case "darwin":
      return brewInstructions;
    case "linux":
      return linuxInstructions;
    default:
      return npmInstructions;
  }
}

/**
 * Get update instructions based on install method
 */
export function getUpdateInstructions(installMethod: InstallMethod): string {
  switch (installMethod) {
    case "npm":
      return "npm update -g @anthropic-ai/claude-code";
    case "brew":
      return "brew upgrade claude-code";
    case "manual":
      return "Download latest version from https://github.com/anthropics/claude-code/releases";
    default:
      return "npm update -g @anthropic-ai/claude-code";
  }
}

/**
 * Run comprehensive diagnostics
 */
export async function runDiagnostics(): Promise<DiagnosticReport> {
  const checks: DiagnosticCheck[] = [];
  const claudeInfo = await getClaudeInstallInfo();

  // Check 1: Claude Code installed
  checks.push({
    name: "Claude Code Installation",
    status: claudeInfo.installed ? "pass" : "fail",
    message: claudeInfo.installed
      ? `Claude Code found at ${claudeInfo.path}`
      : "Claude Code not installed",
    details: claudeInfo.installed ? undefined : "Claude Code is required for vibe-code to work",
    fix: claudeInfo.installed ? undefined : getInstallInstructions(),
  });

  // Check 2: Version compatibility
  if (claudeInfo.installed) {
    checks.push({
      name: "Version Compatibility",
      status: claudeInfo.isCompatible
        ? claudeInfo.isRecommended
          ? "pass"
          : "warn"
        : "fail",
      message: claudeInfo.version
        ? `Version ${claudeInfo.version} installed`
        : "Unable to determine version",
      details: claudeInfo.isCompatible
        ? claudeInfo.isRecommended
          ? "Running recommended version"
          : `Minimum version is ${MIN_CLAUDE_VERSION}, recommended is ${RECOMMENDED_CLAUDE_VERSION}`
        : `Version ${claudeInfo.version} is below minimum ${MIN_CLAUDE_VERSION}`,
      fix: claudeInfo.isCompatible ? undefined : getUpdateInstructions(claudeInfo.installMethod),
    });
  }

  // Check 3: Authentication
  if (claudeInfo.installed) {
    checks.push({
      name: "Authentication",
      status: claudeInfo.authenticated ? "pass" : "fail",
      message: claudeInfo.authenticated
        ? "Claude Code is authenticated"
        : "Claude Code is not authenticated",
      details: claudeInfo.authenticated
        ? undefined
        : "Authentication is required to use Claude Code",
      fix: claudeInfo.authenticated ? undefined : "Run: claude auth login",
    });
  }

  // Check 4: Node.js version
  const nodeVersion = process.version;
  const nodeVersionParts = nodeVersion.slice(1).split(".");
  const nodeMajor = parseInt(nodeVersionParts[0] ?? "0", 10);
  checks.push({
    name: "Node.js Version",
    status: nodeMajor >= 18 ? "pass" : nodeMajor >= 16 ? "warn" : "fail",
    message: `Node.js ${nodeVersion} installed`,
    details:
      nodeMajor >= 18
        ? undefined
        : nodeMajor >= 16
          ? "Node.js 18+ is recommended for best compatibility"
          : "Node.js 18+ is required",
    fix: nodeMajor >= 18 ? undefined : "Update Node.js to version 18 or later",
  });

  // Check 5: Config directory permissions
  const configPath = claudeInfo.configPath;
  if (configPath) {
    try {
      await access(configPath, constants.R_OK | constants.W_OK);
      checks.push({
        name: "Config Directory",
        status: "pass",
        message: `Config directory accessible at ${configPath}`,
      });
    } catch {
      checks.push({
        name: "Config Directory",
        status: "warn",
        message: `Config directory not writable: ${configPath}`,
        fix: `chmod 755 ${configPath}`,
      });
    }
  }

  // Check 6: PATH configuration
  const pathResult = await execCommand("which", ["claude"]);
  checks.push({
    name: "PATH Configuration",
    status: pathResult.success ? "pass" : "warn",
    message: pathResult.success
      ? "Claude Code is in PATH"
      : "Claude Code not found in PATH",
    details: pathResult.success
      ? undefined
      : claudeInfo.path
        ? `Found at ${claudeInfo.path} but not in PATH`
        : undefined,
    fix: pathResult.success
      ? undefined
      : 'Add Claude Code to PATH or use --claude-path option',
  });

  // Determine overall status
  const hasFailure = checks.some((c) => c.status === "fail");
  const hasWarning = checks.some((c) => c.status === "warn");
  const overallStatus = hasFailure ? "unhealthy" : hasWarning ? "degraded" : "healthy";

  return {
    timestamp: new Date(),
    checks,
    overallStatus,
    claudeInfo,
  };
}

/**
 * Check if Claude Code needs updating
 */
export async function checkForUpdates(): Promise<Result<{ current: string; latest: string; updateAvailable: boolean }>> {
  const info = await getClaudeInstallInfo();

  if (!info.installed || !info.version) {
    return {
      success: false,
      error: new Error("Claude Code is not installed or version unknown"),
    };
  }

  // Check npm for latest version
  const result = await execCommand("npm", ["view", "@anthropic-ai/claude-code", "version"]);

  if (!result.success) {
    return {
      success: false,
      error: new Error("Unable to check for updates. Check your internet connection."),
    };
  }

  const latest = result.data.trim();
  const updateAvailable = compareVersions(latest, info.version) > 0;

  return {
    success: true,
    data: {
      current: info.version,
      latest,
      updateAvailable,
    },
  };
}

/**
 * Attempt to install Claude Code (with user confirmation)
 */
export async function installClaudeCode(method: "npm" | "brew" = "npm"): Promise<Result<void>> {
  if (method === "npm") {
    const result = await execCommand("npm", ["install", "-g", "@anthropic-ai/claude-code"], 120000);
    if (!result.success) {
      return {
        success: false,
        error: new Error(`Installation failed: ${result.error.message}`),
      };
    }
    return { success: true, data: undefined };
  }

  if (method === "brew") {
    // First tap the repository
    await execCommand("brew", ["tap", "anthropic/tap"], 60000);
    const result = await execCommand("brew", ["install", "claude-code"], 120000);
    if (!result.success) {
      return {
        success: false,
        error: new Error(`Installation failed: ${result.error.message}`),
      };
    }
    return { success: true, data: undefined };
  }

  return {
    success: false,
    error: new Error(`Unknown install method: ${method}`),
  };
}

/**
 * Sync vibe-code settings to Claude Code config
 */
export async function syncSettingsToClaudeCode(settings: {
  projectRoot: string;
  mode: string;
}): Promise<Result<void>> {
  const configPath = await getClaudeConfigPath();

  if (!configPath) {
    return {
      success: false,
      error: new Error("Claude Code config directory not found"),
    };
  }

  const vibeSettingsPath = join(configPath, "vibe-settings.json");

  try {
    await writeFile(vibeSettingsPath, JSON.stringify(settings, null, 2), "utf-8");
    return { success: true, data: undefined };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error("Failed to write settings"),
    };
  }
}
