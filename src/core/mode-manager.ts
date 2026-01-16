/**
 * Mode Manager
 *
 * Handles mode state management and transitions.
 * When mode changes, automatically regenerates CLAUDE.md.
 *
 * Available modes:
 * - learning: Maximum explanation, beginner-friendly
 * - guided: Brick-by-brick with approval gates
 * - expert: Fast execution with security defaults
 *
 * Security notes:
 * - Mode values validated via Zod schema
 * - No arbitrary code execution on mode switch
 */

import {
  loadConfig,
  readProjectConfig,
  writeProjectConfig,
  isProjectInitialized,
} from "./config-manager.js";
import { buildClaudeMd } from "./prompt-builder.js";
import { ModeSchema, type Mode, type Result } from "../types/index.js";

/**
 * Mode descriptions for display
 */
export const MODE_INFO: Record<
  Mode,
  { name: string; description: string; icon: string }
> = {
  learning: {
    name: "Learning",
    description: "Maximum explanation, beginner-friendly. Explains concepts and shows examples.",
    icon: "📚",
  },
  guided: {
    name: "Guided",
    description: "Brick-by-brick methodology. Plans before building, requires approval at each step.",
    icon: "🧱",
  },
  expert: {
    name: "Expert",
    description: "Speed mode for experienced developers. Concise output, security baked in silently.",
    icon: "⚡",
  },
};

/**
 * All available modes in recommended order
 */
export const AVAILABLE_MODES: Mode[] = ["learning", "guided", "expert"];

/**
 * Validate a mode string
 */
export function isValidMode(value: unknown): value is Mode {
  const result = ModeSchema.safeParse(value);
  return result.success;
}

/**
 * Parse and validate a mode string, returning a Result
 */
export function parseMode(value: string): Result<Mode> {
  const result = ModeSchema.safeParse(value);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: new Error(
      `Invalid mode: "${value}". Valid modes: ${AVAILABLE_MODES.join(", ")}`
    ),
  };
}

/**
 * Get the current mode for a project
 */
export async function getCurrentMode(projectRoot: string): Promise<Result<Mode>> {
  const initialized = await isProjectInitialized(projectRoot);
  if (!initialized) {
    return {
      success: false,
      error: new Error(
        "Project not initialized. Run 'vibe init' first."
      ),
    };
  }

  const configResult = await loadConfig(projectRoot);
  if (!configResult.success) {
    return configResult;
  }

  return { success: true, data: configResult.data.mode };
}

/**
 * Get mode info for display
 */
export function getModeInfo(mode: Mode): {
  name: string;
  description: string;
  icon: string;
} {
  return MODE_INFO[mode];
}

/**
 * Format mode for display (with icon and name)
 */
export function formatMode(mode: Mode): string {
  const info = MODE_INFO[mode];
  return `${info.icon} ${info.name}`;
}

/**
 * Format all modes for display (e.g., for help text)
 */
export function formatAllModes(currentMode?: Mode): string {
  return AVAILABLE_MODES.map((mode) => {
    const info = MODE_INFO[mode];
    const current = mode === currentMode ? " (current)" : "";
    return `  ${info.icon} ${mode.padEnd(10)} - ${info.description}${current}`;
  }).join("\n");
}

/**
 * Switch to a new mode
 * Updates project config and regenerates CLAUDE.md
 */
export async function switchMode(
  projectRoot: string,
  newMode: Mode
): Promise<Result<{ previousMode: Mode; newMode: Mode; claudeMdPath: string }>> {
  // Check if project is initialized
  const initialized = await isProjectInitialized(projectRoot);
  if (!initialized) {
    return {
      success: false,
      error: new Error(
        "Project not initialized. Run 'vibe init' first."
      ),
    };
  }

  // Get current config to find previous mode
  const configResult = await loadConfig(projectRoot);
  if (!configResult.success) {
    return configResult;
  }
  const previousMode = configResult.data.mode;

  // If same mode, no change needed but still regenerate CLAUDE.md
  // (in case prompts were updated)

  // Read existing project config
  const projectConfigResult = await readProjectConfig(projectRoot);
  if (!projectConfigResult.success) {
    return projectConfigResult;
  }

  // Update mode in project config
  const updatedConfig = {
    ...(projectConfigResult.data ?? {}),
    mode: newMode,
  };

  const writeResult = await writeProjectConfig(projectRoot, updatedConfig);
  if (!writeResult.success) {
    return writeResult;
  }

  // Reload merged config with new mode
  const newConfigResult = await loadConfig(projectRoot);
  if (!newConfigResult.success) {
    return newConfigResult;
  }

  // Regenerate CLAUDE.md with new mode
  const buildResult = await buildClaudeMd(newConfigResult.data, projectRoot);
  if (!buildResult.success) {
    return buildResult;
  }

  return {
    success: true,
    data: {
      previousMode,
      newMode,
      claudeMdPath: buildResult.data,
    },
  };
}

/**
 * Get a comparison of modes for display
 */
export function compareModes(): string {
  const header = "Mode Comparison:\n";
  const divider = "─".repeat(60) + "\n";

  const rows = [
    ["Feature", "Learning", "Guided", "Expert"],
    ["─".repeat(15), "─".repeat(12), "─".repeat(12), "─".repeat(12)],
    ["Explanations", "Detailed", "Moderate", "Minimal"],
    ["Code Comments", "Heavy", "Moderate", "Essential only"],
    ["Approval Gates", "No", "Yes", "No"],
    ["Planning", "Inline", "Brick plan", "Implicit"],
    ["Speed", "Slower", "Moderate", "Fast"],
    ["Best For", "Learning", "Teams/Review", "Experienced"],
  ];

  const table = rows
    .map((row) =>
      row.map((cell, i) => cell.padEnd(i === 0 ? 15 : 12)).join(" ")
    )
    .join("\n");

  return header + divider + table;
}

/**
 * Suggest a mode based on user context
 */
export function suggestMode(context: {
  isNewToSecurity?: boolean;
  needsReview?: boolean;
  wantsSpeed?: boolean;
}): Mode {
  if (context.isNewToSecurity === true) {
    return "learning";
  }
  if (context.needsReview === true) {
    return "guided";
  }
  if (context.wantsSpeed === true) {
    return "expert";
  }
  // Default to guided as the balanced option
  return "guided";
}
