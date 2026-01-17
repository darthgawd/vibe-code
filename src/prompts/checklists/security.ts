/**
 * Security Checklist Prompts
 *
 * Checklists that can be appended to CLAUDE.md to enforce
 * security verification before and after code generation.
 *
 * These are designed to be modular - include what you need.
 */

/**
 * Pre-response checklist - Claude verifies BEFORE writing code
 */
export const PRE_RESPONSE_CHECKLIST = `## 🔒 Pre-Response Security Checklist

Before providing ANY code, mentally verify each item. Do not skip this step.

### Input Handling
- [ ] All external inputs identified (user input, API params, file contents, env vars)
- [ ] Validation schema defined for each input
- [ ] Validation happens at trust boundary, not deep in code

### Injection Prevention
- [ ] No string concatenation in SQL queries
- [ ] No string concatenation in shell commands
- [ ] No user input in file paths without validation
- [ ] No user input in URLs without encoding
- [ ] No dangerouslySetInnerHTML or innerHTML with user data

### Authentication & Authorization
- [ ] Auth check present where required
- [ ] Authz check present where required
- [ ] Auth happens before authz
- [ ] Authz happens before action

### Data Protection
- [ ] No secrets in code
- [ ] No secrets in logs
- [ ] Sensitive data not exposed in errors
- [ ] PII handled according to requirements

### Error Handling
- [ ] Errors caught and handled
- [ ] Error messages don't leak internals
- [ ] Failed operations don't leave partial state
`;

/**
 * Post-implementation checklist - verify after code is written
 */
export const POST_IMPLEMENTATION_CHECKLIST = `## ✅ Post-Implementation Security Audit

After writing code, verify:

### Code Review Points
- [ ] No TODO comments hiding security work
- [ ] No commented-out security checks
- [ ] No \`any\` types bypassing validation
- [ ] No \`eslint-disable\` hiding security warnings
- [ ] No \`@ts-ignore\` hiding type safety

### Dependency Check
- [ ] New dependencies audited (\`npm audit\`)
- [ ] Dependencies pinned to exact versions
- [ ] No unnecessary dependencies added

### Test Coverage
- [ ] Happy path tested
- [ ] Invalid input tested (malformed, missing, oversized)
- [ ] Boundary conditions tested
- [ ] Auth/authz failures tested
- [ ] Error conditions tested

### Configuration
- [ ] No hardcoded URLs, ports, or hosts
- [ ] Environment-specific values in env vars
- [ ] Defaults are secure (deny by default)
`;

/**
 * OWASP Top 10 focused checklist
 */
export const OWASP_CHECKLIST = `## 🛡️ OWASP Top 10 Verification

Check code against current OWASP Top 10:

### A01: Broken Access Control
- [ ] Access control enforced server-side
- [ ] Deny by default
- [ ] CORS properly configured
- [ ] Directory listing disabled
- [ ] JWT/session properly validated

### A02: Cryptographic Failures
- [ ] Data classified (public, internal, confidential)
- [ ] Sensitive data encrypted at rest
- [ ] Sensitive data encrypted in transit (TLS)
- [ ] No deprecated crypto (MD5, SHA1 for security)
- [ ] Keys/passwords not hardcoded

### A03: Injection
- [ ] Parameterized queries for SQL
- [ ] ORM used safely (no raw queries with user input)
- [ ] Command execution uses arrays, not strings
- [ ] LDAP/XPath queries parameterized

### A04: Insecure Design
- [ ] Threat modeling done for feature
- [ ] Trust boundaries documented
- [ ] Rate limiting in place
- [ ] Resource limits defined

### A05: Security Misconfiguration
- [ ] No default credentials
- [ ] Error handling doesn't expose stack traces
- [ ] Security headers configured
- [ ] Unnecessary features disabled

### A06: Vulnerable Components
- [ ] Dependencies up to date
- [ ] No known vulnerabilities (\`npm audit\`)
- [ ] Components from trusted sources
- [ ] Unused dependencies removed

### A07: Auth Failures
- [ ] Strong password policy enforced
- [ ] Brute force protection (rate limiting, lockout)
- [ ] Session properly managed
- [ ] MFA available for sensitive operations

### A08: Data Integrity Failures
- [ ] CI/CD pipeline secure
- [ ] Dependencies verified (checksums/signatures)
- [ ] Serialized data validated
- [ ] Critical data has integrity checks

### A09: Logging Failures
- [ ] Security events logged
- [ ] Logs don't contain sensitive data
- [ ] Log injection prevented
- [ ] Alerting configured for attacks

### A10: SSRF
- [ ] URL inputs validated
- [ ] Internal resources not accessible via user URLs
- [ ] Allowlist for external services
- [ ] Response handling doesn't leak internals
`;

/**
 * Frontend-specific security checklist
 */
export const FRONTEND_SECURITY_CHECKLIST = `## 🖥️ Frontend Security Checklist

For any frontend/client-side code:

### XSS Prevention
- [ ] No \`innerHTML\` with user-controlled data
- [ ] No \`dangerouslySetInnerHTML\` without sanitization
- [ ] No \`document.write()\` with dynamic content
- [ ] No \`eval()\`, \`Function()\`, or \`setTimeout/setInterval\` with strings
- [ ] User input escaped before rendering
- [ ] DOMPurify or similar used for HTML sanitization
- [ ] Template literals not used to build HTML

### Content Security Policy (CSP)
- [ ] CSP header configured and enforced
- [ ] No \`unsafe-inline\` for scripts (use nonces/hashes)
- [ ] No \`unsafe-eval\` allowed
- [ ] Script sources explicitly allowlisted
- [ ] Report-uri configured for violations
- [ ] Frame-ancestors restricts embedding

### Secure Communication
- [ ] All requests over HTTPS
- [ ] No mixed content (HTTP resources on HTTPS page)
- [ ] HSTS header enabled
- [ ] Secure WebSocket (wss://) used
- [ ] Certificate pinning for mobile apps

### Authentication & Session
- [ ] Tokens stored in httpOnly cookies (not localStorage for sensitive tokens)
- [ ] Session tokens not exposed in URLs
- [ ] Logout clears all client-side auth state
- [ ] Auto-logout on inactivity for sensitive apps
- [ ] CSRF tokens used for state-changing requests
- [ ] SameSite cookie attribute set appropriately

### Sensitive Data Handling
- [ ] No secrets/API keys in client-side code
- [ ] No sensitive data in localStorage/sessionStorage
- [ ] Sensitive form fields use \`autocomplete="off"\` where appropriate
- [ ] Password fields use \`type="password"\`
- [ ] Sensitive data cleared from memory when no longer needed
- [ ] No sensitive data in URL parameters

### Input Validation
- [ ] Client-side validation (for UX, not security)
- [ ] Server-side validation (actual security)
- [ ] File upload type/size validated
- [ ] Rich text editors configured with safe defaults
- [ ] URL inputs validated before use in links/redirects

### Third-Party Dependencies
- [ ] Dependencies from trusted sources (npm, CDN with SRI)
- [ ] Subresource Integrity (SRI) for external scripts/styles
- [ ] No inline event handlers (\`onclick\`, etc.) in HTML
- [ ] Third-party scripts sandboxed where possible
- [ ] Dependency vulnerabilities checked (\`npm audit\`)

### Clickjacking Protection
- [ ] X-Frame-Options header set
- [ ] frame-ancestors CSP directive configured
- [ ] Sensitive actions require re-authentication
- [ ] UI elements not easily overlayable

### Open Redirect Prevention
- [ ] Redirect URLs validated against allowlist
- [ ] No user-controlled redirect destinations
- [ ] Relative URLs preferred for internal redirects
- [ ] Warning shown before external redirects

### DOM Security
- [ ] No \`location.href\` assignment with user input
- [ ] No \`window.open()\` with user-controlled URLs
- [ ] postMessage origin validated
- [ ] postMessage data validated
- [ ] Blob URLs properly revoked after use

### React/Framework Specific
- [ ] No \`dangerouslySetInnerHTML\` without sanitization
- [ ] Prop types/TypeScript for component inputs
- [ ] Keys not using array index for dynamic lists (where order changes)
- [ ] No sensitive data in React state exposed to dev tools
- [ ] Error boundaries don't leak sensitive info
- [ ] Server components don't expose secrets to client

### Mobile Web / PWA
- [ ] Service worker scope minimized
- [ ] Cache doesn't store sensitive data
- [ ] Credential storage uses platform secure storage
- [ ] Deep links validated
- [ ] Biometric auth properly implemented
`;

/**
 * API-specific security checklist
 */
export const API_SECURITY_CHECKLIST = `## 🌐 API Security Checklist

For any API endpoint:

### Request Handling
- [ ] Input validation on all parameters
- [ ] Content-Type validated
- [ ] Request size limits configured
- [ ] Rate limiting per client/IP

### Response Handling
- [ ] No sensitive data in responses unless required
- [ ] Consistent error response format
- [ ] No stack traces in production errors
- [ ] Appropriate HTTP status codes

### Authentication
- [ ] Auth required for non-public endpoints
- [ ] Tokens validated on every request
- [ ] Token expiration enforced
- [ ] Refresh token rotation implemented

### Authorization
- [ ] Resource ownership verified
- [ ] Role-based access enforced
- [ ] No IDOR (Insecure Direct Object Reference)
- [ ] Bulk operations check per-item access

### Headers
- [ ] CORS restricted to allowed origins
- [ ] Security headers set (CSP, X-Frame-Options, etc.)
- [ ] Sensitive headers not exposed
- [ ] Cache-Control appropriate for data sensitivity
`;

/**
 * Combined checklist for comprehensive review
 */
export const FULL_SECURITY_CHECKLIST = `${PRE_RESPONSE_CHECKLIST}

${POST_IMPLEMENTATION_CHECKLIST}

${OWASP_CHECKLIST}

${FRONTEND_SECURITY_CHECKLIST}
`;

/**
 * Get a specific checklist by name
 */
export function getSecurityChecklist(
  type: "pre" | "post" | "owasp" | "api" | "frontend" | "full"
): string {
  switch (type) {
    case "pre":
      return PRE_RESPONSE_CHECKLIST;
    case "post":
      return POST_IMPLEMENTATION_CHECKLIST;
    case "owasp":
      return OWASP_CHECKLIST;
    case "api":
      return API_SECURITY_CHECKLIST;
    case "frontend":
      return FRONTEND_SECURITY_CHECKLIST;
    case "full":
      return FULL_SECURITY_CHECKLIST;
  }
}

/**
 * Checklist metadata
 */
export const SECURITY_CHECKLIST_META = {
  name: "security-checklists",
  description: "Modular security checklists for pre/post code review",
  version: "1.0.0",
  checklists: [
    { id: "pre", name: "Pre-Response", items: 17 },
    { id: "post", name: "Post-Implementation", items: 15 },
    { id: "owasp", name: "OWASP Top 10", items: 40 },
    { id: "api", name: "API Security", items: 20 },
    { id: "frontend", name: "Frontend Security", items: 52 },
    { id: "full", name: "Full (Combined)", items: 124 },
  ],
} as const;
