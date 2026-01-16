/**
 * Base Security Prompt
 *
 * This prompt is ALWAYS included in CLAUDE.md regardless of mode.
 * It establishes the security-first mindset for all code generation.
 *
 * Security notes:
 * - Contains no secrets or sensitive data
 * - Pure string content, no dynamic execution
 * - Reviewed for prompt injection resistance
 */

export const BASE_PROMPT = `# Security-First Development

You are operating in a security-first development environment. Every line of code you write must be defensible in a security review.

## Core Principles

### 1. Trust Nothing
- All external input is hostile until validated
- All external services may be compromised
- All dependencies are potential attack vectors
- All environments may be misconfigured

### 2. Validate Everything
- Validate input at system boundaries (user input, API requests, file reads, environment variables)
- Use allowlists over denylists
- Validate type, length, format, and range
- Reject invalid input; don't try to "fix" it

### 3. Fail Securely
- Errors should not leak sensitive information
- Default to deny, not allow
- Log security events but never log secrets
- Graceful degradation should not bypass security

### 4. Least Privilege
- Request minimum permissions needed
- Don't store data you don't need
- Don't expose APIs you don't need
- Scope access as narrowly as possible

## Mandatory Practices

### Input Validation
\`\`\`typescript
// ALWAYS validate external input with a schema
import { z } from "zod";

const UserInputSchema = z.object({
  email: z.string().email().max(254),
  name: z.string().min(1).max(100).regex(/^[a-zA-Z\\s-']+$/),
  age: z.number().int().min(0).max(150),
});

// Parse throws on invalid input - don't catch and continue
const validated = UserInputSchema.parse(untrustedInput);
\`\`\`

### SQL Injection Prevention
\`\`\`typescript
// NEVER concatenate user input into queries
// BAD: db.query(\`SELECT * FROM users WHERE id = \${userId}\`)

// ALWAYS use parameterized queries
const user = await db.query(
  "SELECT * FROM users WHERE id = $1",
  [userId]
);
\`\`\`

### XSS Prevention
\`\`\`typescript
// NEVER insert untrusted data into HTML without encoding
// BAD: element.innerHTML = userInput

// ALWAYS use safe methods or encode
element.textContent = userInput;
// Or use a trusted sanitization library
\`\`\`

### Command Injection Prevention
\`\`\`typescript
// NEVER pass user input to shell commands
// BAD: exec(\`git clone \${userUrl}\`)

// ALWAYS use parameterized APIs
import { execFile } from "child_process";
execFile("git", ["clone", "--", userUrl], options);
\`\`\`

### Path Traversal Prevention
\`\`\`typescript
// NEVER use user input directly in file paths
// BAD: fs.readFile(\`./uploads/\${filename}\`)

// ALWAYS validate and resolve paths
import { resolve, relative } from "path";

const SAFE_DIR = resolve("./uploads");
const requested = resolve(SAFE_DIR, filename);
const rel = relative(SAFE_DIR, requested);

if (rel.startsWith("..") || resolve(rel) !== requested) {
  throw new Error("Invalid path");
}
\`\`\`

### Secret Management
\`\`\`typescript
// NEVER hardcode secrets
// BAD: const apiKey = "sk-1234567890"

// ALWAYS use environment variables with validation
const apiKey = process.env.API_KEY;
if (!apiKey || apiKey.length < 20) {
  throw new Error("API_KEY environment variable is required");
}

// NEVER log secrets
console.log("Connecting to API..."); // Good
console.log(\`Using key: \${apiKey}\`); // BAD - never do this
\`\`\`

### Authentication & Authorization
\`\`\`typescript
// ALWAYS check authentication before authorization
// ALWAYS check authorization before action

async function deleteUser(requesterId: string, targetId: string) {
  // 1. Verify requester is authenticated (done in middleware)

  // 2. Check authorization
  const requester = await getUser(requesterId);
  if (requester.role !== "admin" && requesterId !== targetId) {
    throw new ForbiddenError("Not authorized to delete this user");
  }

  // 3. Perform action
  await db.users.delete(targetId);
}
\`\`\`

### Dependency Hygiene
- Pin exact versions in package.json (no ^ or ~)
- Run \`npm audit\` before adding dependencies
- Prefer well-maintained packages with security policies
- Fewer dependencies = smaller attack surface

## Trust Boundaries

Before writing any code, identify:
1. **What enters the system?** (user input, API responses, file contents, env vars)
2. **What leaves the system?** (API responses, logs, files, database writes)
3. **Who has access?** (authenticated users, admins, public, services)
4. **What can go wrong?** (malformed input, network failures, race conditions)

Document trust boundaries in comments when they're not obvious.

## Security Checklist (Pre-Response)

Before providing code, mentally verify:
- [ ] All inputs are validated at trust boundaries
- [ ] No SQL/command/path injection vectors
- [ ] No XSS vectors in output
- [ ] No hardcoded secrets
- [ ] Errors don't leak sensitive information
- [ ] Authentication checked before authorization
- [ ] Authorization checked before action
- [ ] Logging doesn't include secrets
- [ ] Dependencies are necessary and audited
`;

/**
 * Get the base security prompt
 * This function exists for future extensibility (e.g., versioning)
 */
export function getBasePrompt(): string {
  return BASE_PROMPT;
}

/**
 * Prompt metadata for documentation and tooling
 */
export const BASE_PROMPT_META = {
  name: "base",
  description: "Core security-first development guidelines",
  version: "1.0.0",
  alwaysInclude: true,
} as const;
