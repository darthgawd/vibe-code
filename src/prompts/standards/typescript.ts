/**
 * TypeScript Standards Prompt
 *
 * Coding standards that enforce type safety and secure patterns.
 * These are opinionated rules for writing safe, maintainable TypeScript.
 */

export const TYPESCRIPT_STANDARDS_PROMPT = `# TypeScript Standards

These are the TypeScript coding standards for this project. Follow them strictly.

## Type Safety

### No \`any\` - Ever
\`\`\`typescript
// ❌ NEVER
function process(data: any) { ... }
const result = response as any;
// @ts-ignore
someCall();

// ✅ ALWAYS
function process(data: unknown) { ... }
const result = ResponseSchema.parse(response);
// Fix the actual type issue
\`\`\`

### Use \`unknown\` for Uncertain Types
\`\`\`typescript
// For data from external sources (API, user input, files)
function handleApiResponse(data: unknown): User {
  return UserSchema.parse(data); // Validate and type in one step
}

// For catch blocks
try {
  await riskyOperation();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  throw new AppError(message);
}
\`\`\`

### Strict Null Checks
\`\`\`typescript
// ❌ Don't assume values exist
const name = user.profile.name; // Might be undefined!

// ✅ Handle null/undefined explicitly
const name = user.profile?.name ?? "Anonymous";

// Or assert with runtime check
if (!user.profile?.name) {
  throw new ValidationError("Profile name required");
}
const name = user.profile.name; // Now TypeScript knows it exists
\`\`\`

### Exhaustive Switch Statements
\`\`\`typescript
type Status = "pending" | "active" | "completed";

function handleStatus(status: Status): string {
  switch (status) {
    case "pending":
      return "Waiting...";
    case "active":
      return "In progress";
    case "completed":
      return "Done";
    default:
      // This ensures we handle all cases
      const _exhaustive: never = status;
      throw new Error(\`Unhandled status: \${_exhaustive}\`);
  }
}
\`\`\`

## Runtime Validation with Zod

### Schema First
\`\`\`typescript
import { z } from "zod";

// Define schema
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().max(254),
  name: z.string().min(1).max(100),
  role: z.enum(["user", "admin"]),
  createdAt: z.coerce.date(),
});

// Derive type from schema (single source of truth)
type User = z.infer<typeof UserSchema>;

// Use for validation
function createUser(input: unknown): User {
  return UserSchema.parse(input);
}
\`\`\`

### Validate at Boundaries
\`\`\`typescript
// API route handler
app.post("/users", async (req, res) => {
  // Validate immediately at the boundary
  const input = CreateUserSchema.parse(req.body);

  // From here, input is fully typed and validated
  const user = await userService.create(input);
  res.json(user);
});
\`\`\`

### Transform and Validate Together
\`\`\`typescript
const ConfigSchema = z.object({
  port: z.coerce.number().int().min(1).max(65535),
  host: z.string().default("localhost"),
  debug: z.enum(["true", "false"]).transform(v => v === "true"),
  timeout: z.coerce.number().positive().default(30000),
});

// Parse from environment (all strings become correct types)
const config = ConfigSchema.parse(process.env);
\`\`\`

## Error Handling

### Custom Error Classes
\`\`\`typescript
// Base application error
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = "AppError";
  }
}

// Specific errors
class ValidationError extends AppError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
  }
}

class NotFoundError extends AppError {
  constructor(resource: string) {
    super(\`\${resource} not found\`, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, "UNAUTHORIZED", 401);
    this.name = "UnauthorizedError";
  }
}
\`\`\`

### Error Handling Pattern
\`\`\`typescript
// In services - throw specific errors
async function getUser(id: string): Promise<User> {
  const user = await db.users.findUnique({ where: { id } });
  if (!user) {
    throw new NotFoundError("User");
  }
  return user;
}

// In handlers - catch and respond appropriately
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
  }

  // Unknown errors - log details, return generic message
  console.error("Unhandled error:", err);
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
  });
});
\`\`\`

## Async Patterns

### Always Await or Return
\`\`\`typescript
// ❌ Floating promise (error silently ignored)
async function bad() {
  riskyOperation(); // Missing await!
}

// ✅ Properly awaited
async function good() {
  await riskyOperation();
}

// ✅ Or explicitly handle
async function alsoGood() {
  riskyOperation().catch(err => logger.error(err));
}
\`\`\`

### Parallel When Possible
\`\`\`typescript
// ❌ Sequential (slow)
const user = await getUser(id);
const posts = await getPosts(id);
const comments = await getComments(id);

// ✅ Parallel (fast)
const [user, posts, comments] = await Promise.all([
  getUser(id),
  getPosts(id),
  getComments(id),
]);
\`\`\`

### Promise.allSettled for Resilience
\`\`\`typescript
// When some operations can fail without breaking everything
const results = await Promise.allSettled([
  notifyEmail(user),
  notifySlack(user),
  notifySms(user),
]);

const failures = results
  .filter((r): r is PromiseRejectedResult => r.status === "rejected")
  .map(r => r.reason);

if (failures.length > 0) {
  logger.warn("Some notifications failed:", failures);
}
\`\`\`

## Naming Conventions

### Files and Folders
\`\`\`
src/
  routes/
    user.routes.ts      # kebab-case with suffix
  services/
    user.service.ts
  schemas/
    user.schema.ts
  types/
    user.types.ts
  utils/
    string.utils.ts
\`\`\`

### Variables and Functions
\`\`\`typescript
// camelCase for variables and functions
const userId = "123";
function getUserById(id: string) { ... }

// PascalCase for types, interfaces, classes
type UserRole = "admin" | "user";
interface UserConfig { ... }
class UserService { ... }

// SCREAMING_SNAKE_CASE for constants
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 30000;
\`\`\`

### Boolean Naming
\`\`\`typescript
// Prefix with is, has, can, should
const isActive = true;
const hasPermission = user.role === "admin";
const canEdit = isOwner || isAdmin;
const shouldRetry = attempts < MAX_RETRY_ATTEMPTS;
\`\`\`

## Imports

### Order and Organization
\`\`\`typescript
// 1. Node built-ins
import { readFile } from "fs/promises";
import { join } from "path";

// 2. External packages
import { z } from "zod";
import express from "express";

// 3. Internal modules (absolute paths)
import { UserService } from "@/services/user.service";
import { UserSchema } from "@/schemas/user.schema";

// 4. Relative imports
import { formatDate } from "./utils";
import type { Config } from "./types";
\`\`\`

### Type-Only Imports
\`\`\`typescript
// Use type imports for types only (better tree-shaking)
import type { User, UserRole } from "./types";
import { UserSchema } from "./schemas"; // Runtime import
\`\`\`

## Functions

### Single Responsibility
\`\`\`typescript
// ❌ Does too much
async function processUser(data: unknown) {
  const validated = UserSchema.parse(data);
  const hashed = await hashPassword(validated.password);
  const user = await db.users.create({ ...validated, password: hashed });
  await sendWelcomeEmail(user);
  await notifySlack(user);
  return user;
}

// ✅ Each function does one thing
async function createUser(input: CreateUserInput): Promise<User> {
  const hashedPassword = await hashPassword(input.password);
  return db.users.create({ ...input, password: hashedPassword });
}

async function onUserCreated(user: User): Promise<void> {
  await Promise.allSettled([
    sendWelcomeEmail(user),
    notifySlack(user),
  ]);
}
\`\`\`

### Explicit Return Types
\`\`\`typescript
// ❌ Implicit return type
async function getUser(id: string) {
  return db.users.findUnique({ where: { id } });
}

// ✅ Explicit return type (documents contract, catches errors)
async function getUser(id: string): Promise<User | null> {
  return db.users.findUnique({ where: { id } });
}
\`\`\`
`;

/**
 * Get the TypeScript standards prompt
 */
export function getTypeScriptStandardsPrompt(): string {
  return TYPESCRIPT_STANDARDS_PROMPT;
}

/**
 * Prompt metadata
 */
export const TYPESCRIPT_STANDARDS_META = {
  name: "typescript-standards",
  description: "Strict TypeScript coding standards for type safety and security",
  version: "1.0.0",
  topics: [
    "Type safety (no any, use unknown)",
    "Strict null checks",
    "Zod for runtime validation",
    "Error handling patterns",
    "Async patterns",
    "Naming conventions",
    "Import organization",
    "Function design",
  ],
} as const;
