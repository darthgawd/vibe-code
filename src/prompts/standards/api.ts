/**
 * API Standards Prompt
 *
 * Design patterns for building secure, consistent REST APIs.
 * Opinionated conventions for HTTP APIs.
 */

export const API_STANDARDS_PROMPT = `# API Design Standards

These are the API design standards for this project. Follow them for all HTTP endpoints.

## URL Structure

### Resource Naming
\`\`\`
# Nouns, plural, lowercase, kebab-case
GET    /users              # List users
POST   /users              # Create user
GET    /users/:id          # Get user
PATCH  /users/:id          # Update user
DELETE /users/:id          # Delete user

# Nested resources for relationships
GET    /users/:id/posts    # User's posts
POST   /users/:id/posts    # Create post for user

# Multi-word resources
GET    /user-profiles      # kebab-case
GET    /order-items        # Not orderItems or order_items
\`\`\`

### Query Parameters
\`\`\`
# Filtering
GET /users?role=admin&status=active

# Sorting (prefix with - for descending)
GET /users?sort=createdAt      # Ascending
GET /users?sort=-createdAt     # Descending
GET /users?sort=-createdAt,name # Multiple

# Pagination
GET /users?page=2&limit=20
GET /users?cursor=abc123&limit=20  # Cursor-based

# Field selection
GET /users?fields=id,name,email

# Search
GET /users?q=john
\`\`\`

## HTTP Methods

| Method | Purpose | Idempotent | Body |
|--------|---------|------------|------|
| GET | Read resource(s) | Yes | No |
| POST | Create resource | No | Yes |
| PUT | Replace entire resource | Yes | Yes |
| PATCH | Partial update | Yes | Yes |
| DELETE | Remove resource | Yes | No |

### Method Selection
\`\`\`typescript
// Creating new resource → POST
app.post("/users", createUser);

// Full replacement → PUT (rarely used)
app.put("/users/:id", replaceUser);

// Partial update → PATCH (common)
app.patch("/users/:id", updateUser);

// Actions that don't fit REST → POST with verb
app.post("/users/:id/verify-email", verifyEmail);
app.post("/auth/login", login);
app.post("/auth/logout", logout);
\`\`\`

## Request Validation

### Schema Per Endpoint
\`\`\`typescript
// schemas/user.schema.ts
import { z } from "zod";

export const CreateUserSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(128),
  name: z.string().min(1).max(100),
});

export const UpdateUserSchema = CreateUserSchema.partial();

export const UserParamsSchema = z.object({
  id: z.string().uuid(),
});

export const ListUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(["user", "admin"]).optional(),
  sort: z.string().optional(),
});
\`\`\`

### Validate Everything
\`\`\`typescript
app.patch("/users/:id", async (req, res) => {
  // Validate params
  const { id } = UserParamsSchema.parse(req.params);

  // Validate body
  const updates = UpdateUserSchema.parse(req.body);

  // Validate query (if needed)
  const query = SomeQuerySchema.parse(req.query);

  // Now all inputs are safe and typed
  const user = await userService.update(id, updates);
  res.json(user);
});
\`\`\`

## Response Format

### Success Responses
\`\`\`typescript
// Single resource
{
  "data": {
    "id": "123",
    "email": "user@example.com",
    "name": "John"
  }
}

// Collection
{
  "data": [
    { "id": "123", "name": "John" },
    { "id": "456", "name": "Jane" }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}

// Empty collection (NOT null, NOT omitted)
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
\`\`\`

### Error Responses
\`\`\`typescript
// Standard error format
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      { "field": "email", "message": "Invalid email format" },
      { "field": "password", "message": "Must be at least 12 characters" }
    ]
  }
}

// Simple error
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found"
  }
}
\`\`\`

### HTTP Status Codes
\`\`\`typescript
// Success
200 OK           // GET, PATCH, DELETE (with body)
201 Created      // POST (include Location header)
204 No Content   // DELETE (no body)

// Client errors
400 Bad Request  // Validation failed
401 Unauthorized // Not authenticated
403 Forbidden    // Authenticated but not authorized
404 Not Found    // Resource doesn't exist
409 Conflict     // Duplicate, version conflict
422 Unprocessable // Valid syntax but semantic error
429 Too Many Requests // Rate limited

// Server errors
500 Internal     // Unexpected error (log it!)
503 Unavailable  // Maintenance, overloaded
\`\`\`

## Authentication

### JWT Pattern
\`\`\`typescript
// Header format
Authorization: Bearer <token>

// Middleware
export const authenticate: Middleware = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Missing token" }
    });
  }

  const token = header.slice(7);
  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Invalid token" }
    });
  }
};
\`\`\`

### Token Response
\`\`\`typescript
// Login response
{
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 900,       // seconds
    "tokenType": "Bearer"
  }
}
\`\`\`

## Authorization

### Resource Ownership
\`\`\`typescript
// Always verify the user can access the resource
app.get("/users/:id", authenticate, async (req, res) => {
  const { id } = UserParamsSchema.parse(req.params);

  // Users can only access their own data (unless admin)
  if (req.user.id !== id && req.user.role !== "admin") {
    return res.status(403).json({
      error: { code: "FORBIDDEN", message: "Access denied" }
    });
  }

  const user = await userService.getById(id);
  res.json({ data: user });
});
\`\`\`

### Role-Based Access
\`\`\`typescript
// Middleware factory
export function requireRole(...roles: UserRole[]): Middleware {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Authentication required" }
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "Insufficient permissions" }
      });
    }

    next();
  };
}

// Usage
app.delete("/users/:id", authenticate, requireRole("admin"), deleteUser);
\`\`\`

## Rate Limiting

### Configuration
\`\`\`typescript
// Different limits for different endpoints
const rateLimits = {
  // Strict for auth endpoints (prevent brute force)
  auth: { windowMs: 15 * 60 * 1000, max: 5 },     // 5 per 15 min

  // Moderate for write operations
  write: { windowMs: 60 * 1000, max: 30 },        // 30 per minute

  // Relaxed for reads
  read: { windowMs: 60 * 1000, max: 100 },        // 100 per minute
};

app.post("/auth/login", rateLimit(rateLimits.auth), login);
app.post("/users", rateLimit(rateLimits.write), createUser);
app.get("/users", rateLimit(rateLimits.read), listUsers);
\`\`\`

### Response Headers
\`\`\`
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
\`\`\`

## Pagination

### Offset-Based (Simple)
\`\`\`typescript
// Request
GET /users?page=2&limit=20

// Implementation
const offset = (page - 1) * limit;
const [users, total] = await Promise.all([
  db.users.findMany({ skip: offset, take: limit }),
  db.users.count(),
]);

// Response
{
  "data": [...],
  "meta": {
    "page": 2,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
\`\`\`

### Cursor-Based (Scalable)
\`\`\`typescript
// Request
GET /users?cursor=abc123&limit=20

// Implementation
const users = await db.users.findMany({
  take: limit + 1, // Fetch one extra to check if more exist
  cursor: cursor ? { id: cursor } : undefined,
  skip: cursor ? 1 : 0,
});

const hasMore = users.length > limit;
const data = hasMore ? users.slice(0, -1) : users;
const nextCursor = hasMore ? data[data.length - 1].id : null;

// Response
{
  "data": [...],
  "meta": {
    "nextCursor": "xyz789",
    "hasMore": true
  }
}
\`\`\`

## Security Headers

### Required Headers
\`\`\`typescript
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");

  // Prevent MIME sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // XSS protection (legacy browsers)
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Strict transport security (HTTPS only)
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  // Content Security Policy
  res.setHeader("Content-Security-Policy", "default-src 'self'");

  next();
});
\`\`\`

### CORS Configuration
\`\`\`typescript
// Be explicit about allowed origins
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      "https://app.example.com",
      "https://admin.example.com",
    ];

    // Allow requests with no origin (mobile apps, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
\`\`\`

## Error Handling

### Global Error Handler
\`\`\`typescript
import { ZodError } from "zod";

app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        details: err.errors.map(e => ({
          field: e.path.join("."),
          message: e.message,
        })),
      },
    });
  }

  // Application errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
  }

  // Unknown errors - don't leak details
  console.error("Unhandled error:", err);
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
  });
});
\`\`\`

## API Versioning

### URL Path Versioning (Recommended)
\`\`\`
/api/v1/users
/api/v2/users
\`\`\`

### Router Organization
\`\`\`typescript
// routes/v1/index.ts
const v1Router = express.Router();
v1Router.use("/users", userRoutes);
v1Router.use("/posts", postRoutes);

// routes/v2/index.ts
const v2Router = express.Router();
v2Router.use("/users", userRoutesV2);
v2Router.use("/posts", postRoutes); // Same as v1

// app.ts
app.use("/api/v1", v1Router);
app.use("/api/v2", v2Router);
\`\`\`
`;

/**
 * Get the API standards prompt
 */
export function getApiStandardsPrompt(): string {
  return API_STANDARDS_PROMPT;
}

/**
 * Prompt metadata
 */
export const API_STANDARDS_META = {
  name: "api-standards",
  description: "REST API design patterns for secure, consistent HTTP APIs",
  version: "1.0.0",
  topics: [
    "URL structure and naming",
    "HTTP methods",
    "Request validation with Zod",
    "Response format (data/error/meta)",
    "HTTP status codes",
    "JWT authentication",
    "Role-based authorization",
    "Rate limiting",
    "Pagination (offset and cursor)",
    "Security headers and CORS",
    "Error handling",
    "API versioning",
  ],
} as const;
