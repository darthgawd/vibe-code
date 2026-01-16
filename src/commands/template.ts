/**
 * vibe template Command
 *
 * Scaffold projects from secure starter templates.
 *
 * Usage:
 *   vibe template              - List available templates
 *   vibe template <name>       - Scaffold from template
 *   vibe template <name> -d <dir>  - Scaffold to specific directory
 *
 * Security notes:
 * - Template paths validated
 * - No arbitrary code execution
 */

import { resolve, basename } from "path";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import {
  listTemplates,
  getTemplate,
  scaffoldProject,
  type TemplateInfo,
} from "../core/template-engine.js";
import { initProject, loadConfig } from "../core/config-manager.js";
import { buildClaudeMd } from "../core/prompt-builder.js";
import { ExitCode, type Mode } from "../types/index.js";

/**
 * Options for the template command
 */
export interface TemplateOptions {
  directory?: string | undefined;
  force?: boolean | undefined;
  yes?: boolean | undefined;
}

/**
 * Display available templates
 */
async function showTemplateList(): Promise<void> {
  const result = await listTemplates();

  if (!result.success) {
    process.stderr.write(chalk.red(`Error: ${result.error.message}\n`));
    process.exit(ExitCode.GENERAL_ERROR);
    return;
  }

  const templates = result.data;

  if (templates.length === 0) {
    process.stdout.write(chalk.yellow("No templates available.\n"));
    process.exit(ExitCode.SUCCESS);
    return;
  }

  process.stdout.write("\n");
  process.stdout.write(chalk.white.bold("Available Templates\n"));
  process.stdout.write(chalk.gray("─".repeat(60) + "\n\n"));

  for (const template of templates) {
    process.stdout.write(chalk.cyan.bold(`  ${template.id}\n`));
    process.stdout.write(chalk.white(`    ${template.name}\n`));
    process.stdout.write(chalk.gray(`    ${template.description}\n`));
    process.stdout.write(chalk.gray(`    Version: ${template.version}\n\n`));
  }

  process.stdout.write(chalk.gray("Usage: ") + chalk.yellow("vibe template <name> [--directory <dir>]\n\n"));
}

/**
 * Prompt user for project name
 */
async function promptProjectName(defaultName: string): Promise<string> {
  const { projectName } = await inquirer.prompt<{ projectName: string }>([
    {
      type: "input",
      name: "projectName",
      message: "Project name:",
      default: defaultName,
      validate: (input: string): string | boolean => {
        if (input.trim().length === 0) {
          return "Project name is required";
        }
        if (!/^[a-zA-Z0-9-_\s]+$/.test(input)) {
          return "Project name can only contain letters, numbers, dashes, underscores, and spaces";
        }
        return true;
      },
    },
  ]);

  return projectName;
}

/**
 * Prompt user to select a template
 */
async function promptTemplateSelection(templates: TemplateInfo[]): Promise<string> {
  const choices = templates.map((t) => ({
    name: `${t.id.padEnd(12)} - ${t.description}`,
    value: t.id,
    short: t.id,
  }));

  const { templateId } = await inquirer.prompt<{ templateId: string }>([
    {
      type: "list",
      name: "templateId",
      message: "Select a template:",
      choices,
    },
  ]);

  return templateId;
}

/**
 * Scaffold a project from a template
 */
async function scaffoldFromTemplate(
  templateId: string,
  options: TemplateOptions
): Promise<void> {
  // Get template info
  const templateResult = await getTemplate(templateId);
  if (!templateResult.success) {
    process.stderr.write(chalk.red(`${templateResult.error.message}\n`));
    process.exit(ExitCode.NOT_FOUND);
    return;
  }

  const template = templateResult.data;

  process.stdout.write("\n");
  process.stdout.write(chalk.cyan.bold(`Template: ${template.name}\n`));
  process.stdout.write(chalk.gray(`${template.description}\n\n`));

  // Determine target directory
  let targetDir: string;
  if (options.directory !== undefined && options.directory !== "") {
    targetDir = resolve(options.directory);
  } else if (options.yes === true) {
    targetDir = resolve(".", templateId);
  } else {
    const { dir } = await inquirer.prompt<{ dir: string }>([
      {
        type: "input",
        name: "dir",
        message: "Target directory:",
        default: `./${templateId}`,
      },
    ]);
    targetDir = resolve(dir);
  }

  // Get project name
  const defaultProjectName = basename(targetDir);
  const projectName = options.yes === true
    ? defaultProjectName
    : await promptProjectName(defaultProjectName);

  // Confirm
  if (options.yes !== true) {
    process.stdout.write("\n");
    process.stdout.write(chalk.white("Summary:\n"));
    process.stdout.write(chalk.gray(`  Template:    ${template.name}\n`));
    process.stdout.write(chalk.gray(`  Project:     ${projectName}\n`));
    process.stdout.write(chalk.gray(`  Directory:   ${targetDir}\n\n`));

    const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
      {
        type: "confirm",
        name: "confirmed",
        message: "Create project?",
        default: true,
      },
    ]);

    if (!confirmed) {
      process.stdout.write(chalk.gray("Cancelled.\n"));
      process.exit(ExitCode.SUCCESS);
      return;
    }
  }

  // Scaffold project
  const spinner = ora("Creating project files...").start();

  const scaffoldResult = await scaffoldProject(templateId, {
    projectName,
    targetDir,
    overwrite: options.force,
  });

  if (!scaffoldResult.success) {
    spinner.fail("Failed to create project");
    process.stderr.write(chalk.red(`Error: ${scaffoldResult.error.message}\n`));
    process.exit(ExitCode.GENERAL_ERROR);
    return;
  }

  spinner.succeed(`Created ${String(scaffoldResult.data.files.length)} files`);

  // Initialize vibe config
  spinner.start("Initializing vibe-code...");

  const defaultMode: Mode = template.meta.defaultMode ?? "guided";

  const initResult = await initProject(targetDir, {
    mode: defaultMode,
    projectName,
    template: templateId,
  });

  if (!initResult.success) {
    spinner.fail("Failed to initialize vibe-code");
    process.stderr.write(chalk.red(`Error: ${initResult.error.message}\n`));
    process.exit(ExitCode.CONFIG_ERROR);
    return;
  }

  // Generate CLAUDE.md
  const configResult = await loadConfig(targetDir);
  if (configResult.success) {
    await buildClaudeMd(configResult.data, targetDir);
  }

  spinner.succeed("Initialized vibe-code");

  // Success message
  process.stdout.write("\n");
  process.stdout.write(chalk.green.bold("✓ Project created successfully!\n\n"));

  process.stdout.write(chalk.white("Next steps:\n"));
  process.stdout.write(chalk.cyan("  1. ") + `cd ${targetDir}\n`);
  process.stdout.write(chalk.cyan("  2. ") + "npm install\n");
  process.stdout.write(chalk.cyan("  3. ") + "vibe start\n");
  process.stdout.write("\n");
}

/**
 * Execute the template command
 */
export async function templateCommand(
  templateId?: string,
  options: TemplateOptions = {}
): Promise<void> {
  // If no template specified, show list or prompt
  if (templateId === undefined || templateId === "") {
    if (options.yes === true) {
      // Non-interactive: just show list
      await showTemplateList();
      process.exit(ExitCode.SUCCESS);
      return;
    }

    // Interactive: let user select
    const listResult = await listTemplates();
    if (!listResult.success) {
      process.stderr.write(chalk.red(`Error: ${listResult.error.message}\n`));
      process.exit(ExitCode.GENERAL_ERROR);
      return;
    }

    if (listResult.data.length === 0) {
      process.stdout.write(chalk.yellow("No templates available.\n"));
      process.exit(ExitCode.SUCCESS);
      return;
    }

    templateId = await promptTemplateSelection(listResult.data);
  }

  await scaffoldFromTemplate(templateId, options);
  process.exit(ExitCode.SUCCESS);
}
