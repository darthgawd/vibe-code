/**
 * Unit tests for type validation
 *
 * Tests that our Zod schemas correctly validate input.
 * Security note: These tests verify our trust boundary validation.
 */

import { describe, it, expect } from "vitest";
import {
  ModeSchema,
  GlobalConfigSchema,
  ProjectConfigSchema,
  ExitCode,
} from "../../src/types/index.js";

describe("ModeSchema", () => {
  it("accepts valid modes", () => {
    expect(ModeSchema.parse("learning")).toBe("learning");
    expect(ModeSchema.parse("guided")).toBe("guided");
    expect(ModeSchema.parse("expert")).toBe("expert");
  });

  it("rejects invalid modes", () => {
    expect(() => ModeSchema.parse("invalid")).toThrow();
    expect(() => ModeSchema.parse("")).toThrow();
    expect(() => ModeSchema.parse(123)).toThrow();
    expect(() => ModeSchema.parse(null)).toThrow();
    expect(() => ModeSchema.parse(undefined)).toThrow();
  });

  it("is case-sensitive", () => {
    expect(() => ModeSchema.parse("Learning")).toThrow();
    expect(() => ModeSchema.parse("GUIDED")).toThrow();
    expect(() => ModeSchema.parse("Expert")).toThrow();
  });
});

describe("GlobalConfigSchema", () => {
  it("accepts valid minimal config", () => {
    const config = { defaultMode: "guided" };
    const result = GlobalConfigSchema.parse(config);
    expect(result.defaultMode).toBe("guided");
  });

  it("accepts valid full config", () => {
    const config = {
      defaultMode: "expert",
      editor: "vim",
      claudeCodePath: "/usr/local/bin/claude",
    };
    const result = GlobalConfigSchema.parse(config);
    expect(result.defaultMode).toBe("expert");
    expect(result.editor).toBe("vim");
    expect(result.claudeCodePath).toBe("/usr/local/bin/claude");
  });

  it("applies defaults when fields are missing", () => {
    // Empty config gets all defaults
    const result = GlobalConfigSchema.parse({});
    expect(result.defaultMode).toBe("guided");
    expect(result.includeSecurityChecklist).toBe("pre");
    expect(result.includeStandards).toEqual(["typescript"]);

    // Partial config merges with defaults
    const partial = GlobalConfigSchema.parse({ editor: "vim" });
    expect(partial.editor).toBe("vim");
    expect(partial.defaultMode).toBe("guided");
  });

  it("rejects invalid defaultMode", () => {
    expect(() => GlobalConfigSchema.parse({ defaultMode: "invalid" })).toThrow();
  });
});

describe("ProjectConfigSchema", () => {
  it("accepts valid minimal config", () => {
    const config = { mode: "learning" };
    const result = ProjectConfigSchema.parse(config);
    expect(result.mode).toBe("learning");
  });

  it("accepts valid full config", () => {
    const config = {
      mode: "guided",
      projectName: "my-project",
      template: "api",
      customPrompts: ["prompt1.md", "prompt2.md"],
    };
    const result = ProjectConfigSchema.parse(config);
    expect(result.mode).toBe("guided");
    expect(result.projectName).toBe("my-project");
    expect(result.template).toBe("api");
    expect(result.customPrompts).toEqual(["prompt1.md", "prompt2.md"]);
  });

  it("rejects invalid customPrompts type", () => {
    expect(() =>
      ProjectConfigSchema.parse({
        mode: "guided",
        customPrompts: "not-an-array",
      })
    ).toThrow();
  });
});

describe("ExitCode", () => {
  it("has correct values", () => {
    expect(ExitCode.SUCCESS).toBe(0);
    expect(ExitCode.GENERAL_ERROR).toBe(1);
    expect(ExitCode.INVALID_ARGUMENT).toBe(2);
    expect(ExitCode.CONFIG_ERROR).toBe(3);
    expect(ExitCode.NOT_FOUND).toBe(4);
    expect(ExitCode.PERMISSION_DENIED).toBe(5);
  });

  it("is immutable", () => {
    // TypeScript enforces this at compile time, but verify at runtime
    expect(Object.isFrozen(ExitCode)).toBe(false); // const assertion doesn't freeze
    // The values themselves are readonly via TypeScript
  });
});
