/**
 * Vibe Code CLI - Type Definitions
 *
 * All shared types used across the CLI.
 * Security note: These types enforce structure but validation
 * must still occur at runtime boundaries.
 */

import { z } from "zod";

/**
 * Available modes for vibe-code
 * - learning: Maximum explanation, beginner-friendly
 * - guided: Brick-by-brick with approval gates
 * - expert: Fast execution with security defaults
 */
export type Mode = "learning" | "guided" | "expert";

export const ModeSchema = z.enum(["learning", "guided", "expert"]);

/**
 * Available security checklists
 */
export type ChecklistType = "pre" | "post" | "owasp" | "api" | "full" | "none";

export const ChecklistTypeSchema = z.enum([
  "pre",
  "post",
  "owasp",
  "api",
  "full",
  "none",
]);

/**
 * Standards to include in prompts
 */
export type StandardType = "typescript" | "api";

export const StandardTypeSchema = z.enum(["typescript", "api"]);

/**
 * Global configuration stored in ~/.vibe/config.json
 * These are user-level defaults that apply to all projects
 */
export interface GlobalConfig {
  defaultMode: Mode;
  editor?: string | undefined;
  claudeCodePath?: string | undefined;
  includeSecurityChecklist?: ChecklistType | undefined;
  includeStandards?: StandardType[] | undefined;
}

export const GlobalConfigSchema = z.object({
  defaultMode: ModeSchema.default("guided"),
  editor: z.string().optional(),
  claudeCodePath: z.string().optional(),
  includeSecurityChecklist: ChecklistTypeSchema.default("pre"),
  includeStandards: z.array(StandardTypeSchema).default(["typescript"]),
});

/**
 * Project configuration stored in .vibe/config.json
 * These override global settings for this specific project
 */
export interface ProjectConfig {
  mode?: Mode | undefined;
  projectName?: string | undefined;
  template?: string | undefined;
  customPrompts?: string[] | undefined;
  includeSecurityChecklist?: ChecklistType | undefined;
  includeStandards?: StandardType[] | undefined;
}

export const ProjectConfigSchema = z.object({
  mode: ModeSchema.optional(),
  projectName: z.string().optional(),
  template: z.string().optional(),
  customPrompts: z.array(z.string()).optional(),
  includeSecurityChecklist: ChecklistTypeSchema.optional(),
  includeStandards: z.array(StandardTypeSchema).optional(),
});

/**
 * Merged configuration (project overrides global)
 * This is what the application actually uses at runtime
 */
export interface MergedConfig {
  mode: Mode;
  editor?: string | undefined;
  claudeCodePath?: string | undefined;
  projectName?: string | undefined;
  template?: string | undefined;
  customPrompts: string[];
  includeSecurityChecklist: ChecklistType;
  includeStandards: StandardType[];
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: MergedConfig = {
  mode: "guided",
  customPrompts: [],
  includeSecurityChecklist: "pre",
  includeStandards: ["typescript"],
};

/**
 * Result type for operations that can fail
 * Used instead of throwing to make error handling explicit
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * CLI exit codes
 * Following standard Unix conventions
 */
export const ExitCode = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  INVALID_ARGUMENT: 2,
  CONFIG_ERROR: 3,
  NOT_FOUND: 4,
  PERMISSION_DENIED: 5,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

/**
 * Version information
 */
export interface VersionInfo {
  version: string;
  nodeVersion: string;
  platform: string;
  arch: string;
}
