/**
 * Template Engine
 *
 * Handles project scaffolding from secure starter templates.
 * Copies template files and replaces placeholders.
 *
 * Security notes:
 * - Template paths validated to stay within templates directory
 * - No dynamic code execution
 * - Placeholders are simple string replacement (no eval)
 */

import { readdir, readFile, writeFile, mkdir, stat, copyFile } from "fs/promises";
import { join, dirname, resolve, relative } from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import type { Result, Mode } from "../types/index.js";

/**
 * Get the templates directory path
 */
function getTemplatesDir(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = dirname(currentFile);
  // In dist/, go up to project root, then to src/templates
  // In development, templates are in src/templates
  return resolve(currentDir, "..", "templates");
}

/**
 * Template metadata schema
 */
const TemplateMetaSchema = z.object({
  name: z.string(),
  description: z.string(),
  version: z.string(),
  author: z.string().optional(),
  dependencies: z.record(z.string()).optional(),
  devDependencies: z.record(z.string()).optional(),
  scripts: z.record(z.string()).optional(),
  defaultMode: z.enum(["learning", "guided", "expert"]).optional(),
});

type TemplateMeta = z.infer<typeof TemplateMetaSchema>;

/**
 * Template info for listing
 */
export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  version: string;
  path: string;
}

/**
 * Options for scaffolding
 */
export interface ScaffoldOptions {
  projectName: string;
  targetDir: string;
  mode?: Mode | undefined;
  overwrite?: boolean | undefined;
}

/**
 * Placeholder values for template processing
 */
interface PlaceholderValues {
  projectName: string;
  projectNameKebab: string;
  projectNamePascal: string;
  year: string;
}

/**
 * Convert string to kebab-case
 */
function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

/**
 * Convert string to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c: string | undefined) => (c !== undefined && c !== "" ? c.toUpperCase() : ""))
    .replace(/^(.)/, (c) => c.toUpperCase());
}

/**
 * Replace placeholders in content
 */
function replacePlaceholders(content: string, values: PlaceholderValues): string {
  return content
    .replace(/\{\{projectName\}\}/g, values.projectName)
    .replace(/\{\{projectNameKebab\}\}/g, values.projectNameKebab)
    .replace(/\{\{projectNamePascal\}\}/g, values.projectNamePascal)
    .replace(/\{\{year\}\}/g, values.year);
}

/**
 * Check if a path exists
 */
async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * List all available templates
 */
export async function listTemplates(): Promise<Result<TemplateInfo[]>> {
  const templatesDir = getTemplatesDir();

  try {
    const exists = await pathExists(templatesDir);
    if (!exists) {
      return { success: true, data: [] };
    }

    const entries = await readdir(templatesDir, { withFileTypes: true });
    const templates: TemplateInfo[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const templatePath = join(templatesDir, entry.name);
      const metaPath = join(templatePath, "template.json");

      const metaExists = await pathExists(metaPath);
      if (!metaExists) continue;

      try {
        const metaContent = await readFile(metaPath, "utf-8");
        const metaJson: unknown = JSON.parse(metaContent);
        const meta = TemplateMetaSchema.parse(metaJson);

        templates.push({
          id: entry.name,
          name: meta.name,
          description: meta.description,
          version: meta.version,
          path: templatePath,
        });
      } catch {
        // Skip invalid templates
        continue;
      }
    }

    return { success: true, data: templates };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list templates";
    return { success: false, error: new Error(message) };
  }
}

/**
 * Get a specific template by ID
 */
export async function getTemplate(templateId: string): Promise<Result<TemplateInfo & { meta: TemplateMeta }>> {
  const templatesDir = getTemplatesDir();
  const templatePath = join(templatesDir, templateId);

  // Security: Ensure template path is within templates directory
  const resolvedPath = resolve(templatePath);
  const resolvedTemplatesDir = resolve(templatesDir);
  if (!resolvedPath.startsWith(resolvedTemplatesDir)) {
    return {
      success: false,
      error: new Error(`Invalid template ID: ${templateId}`),
    };
  }

  const exists = await pathExists(templatePath);
  if (!exists) {
    return {
      success: false,
      error: new Error(`Template not found: ${templateId}`),
    };
  }

  const metaPath = join(templatePath, "template.json");
  const metaExists = await pathExists(metaPath);
  if (!metaExists) {
    return {
      success: false,
      error: new Error(`Invalid template (missing template.json): ${templateId}`),
    };
  }

  try {
    const metaContent = await readFile(metaPath, "utf-8");
    const metaJson: unknown = JSON.parse(metaContent);
    const meta = TemplateMetaSchema.parse(metaJson);

    return {
      success: true,
      data: {
        id: templateId,
        name: meta.name,
        description: meta.description,
        version: meta.version,
        path: templatePath,
        meta,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read template";
    return { success: false, error: new Error(message) };
  }
}

/**
 * Recursively get all files in a directory
 */
async function getAllFiles(dir: string, baseDir: string = dir): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const subFiles = await getAllFiles(fullPath, baseDir);
      files.push(...subFiles);
    } else {
      files.push(relative(baseDir, fullPath));
    }
  }

  return files;
}

/**
 * Scaffold a project from a template
 */
export async function scaffoldProject(
  templateId: string,
  options: ScaffoldOptions
): Promise<Result<{ files: string[]; targetDir: string }>> {
  // Get template info
  const templateResult = await getTemplate(templateId);
  if (!templateResult.success) {
    return templateResult;
  }

  const template = templateResult.data;
  const filesDir = join(template.path, "files");

  // Check if files directory exists
  const filesExist = await pathExists(filesDir);
  if (!filesExist) {
    return {
      success: false,
      error: new Error(`Template has no files directory: ${templateId}`),
    };
  }

  // Check if target directory exists
  const targetExists = await pathExists(options.targetDir);
  if (targetExists && options.overwrite !== true) {
    // Check if directory is empty
    const entries = await readdir(options.targetDir);
    if (entries.length > 0) {
      return {
        success: false,
        error: new Error(
          `Target directory is not empty: ${options.targetDir}. Use --force to overwrite.`
        ),
      };
    }
  }

  // Create target directory
  await mkdir(options.targetDir, { recursive: true });

  // Get all template files
  const templateFiles = await getAllFiles(filesDir);

  // Prepare placeholder values
  const placeholders: PlaceholderValues = {
    projectName: options.projectName,
    projectNameKebab: toKebabCase(options.projectName),
    projectNamePascal: toPascalCase(options.projectName),
    year: new Date().getFullYear().toString(),
  };

  const createdFiles: string[] = [];

  // Process each file
  for (const relPath of templateFiles) {
    const sourcePath = join(filesDir, relPath);
    const targetPath = join(options.targetDir, relPath);

    // Create directory if needed
    const targetDir = dirname(targetPath);
    await mkdir(targetDir, { recursive: true });

    // Check if file should be processed (text files) or copied (binary)
    const isTextFile = /\.(ts|js|json|md|txt|yml|yaml|html|css|env\.example)$/i.test(relPath);

    if (isTextFile) {
      // Read, process placeholders, and write
      const content = await readFile(sourcePath, "utf-8");
      const processed = replacePlaceholders(content, placeholders);
      await writeFile(targetPath, processed, "utf-8");
    } else {
      // Copy binary file as-is
      await copyFile(sourcePath, targetPath);
    }

    createdFiles.push(relPath);
  }

  return {
    success: true,
    data: {
      files: createdFiles,
      targetDir: options.targetDir,
    },
  };
}

/**
 * Get template dependencies merged with base vibe-code deps
 */
export function getTemplateDependencies(meta: TemplateMeta): {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
} {
  return {
    dependencies: {
      zod: "^3.23.8", // Always include Zod for validation
      ...(meta.dependencies ?? {}),
    },
    devDependencies: {
      typescript: "^5.5.0",
      "@types/node": "^20.14.0",
      ...(meta.devDependencies ?? {}),
    },
    scripts: {
      build: "tsc",
      dev: "tsc --watch",
      typecheck: "tsc --noEmit",
      ...(meta.scripts ?? {}),
    },
  };
}
