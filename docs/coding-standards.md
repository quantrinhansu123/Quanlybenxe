# Coding Standards for Smart Refactoring

**Created:** 2024-12-19
**Last Updated:** 2024-12-19

---

## Overview

This document establishes coding standards for the Bus Station Management System (Quanlybenxe) refactoring effort. These standards balance code quality with pragmatic development velocity.

---

## Controller Guidelines

### Line Limits
- **Maximum:** 200 lines per controller file
- **Target:** 100-150 lines for maintainability
- **Exceptions:** Complex CRUD operations may exceed slightly if well-organized

### Controller Responsibilities
Controllers should ONLY handle:
- HTTP request parsing (params, body, query)
- HTTP response formatting
- Input validation (basic)
- Calling services/helpers for business logic
- Error handling delegation

Controllers should NOT contain:
- Complex business logic
- Direct database operations (use repository pattern)
- Multiple nested loops or conditionals
- Data transformation logic

### Example Structure
```typescript
// Good: Controller delegates to helpers/services
export async function createDispatch(req: Request, res: Response) {
  const input = validateDispatchInput(req.body);  // Validation helper
  const record = await dispatchService.create(input);  // Service layer
  return ApiResponse.success(res, record);
}

// Bad: Fat controller with embedded logic
export async function createDispatch(req: Request, res: Response) {
  // 50+ lines of validation
  // 30+ lines of database operations
  // 20+ lines of business calculations
  // ...
}
```

---

## Service Layer Pattern (Simplified)

### When to Use Services
- Complex business logic spanning multiple entities
- Operations requiring transactions or multiple DB calls
- Reusable business operations called from multiple controllers

### When NOT to Use Services
- Simple CRUD operations (keep in controller or use repository directly)
- Single database operations
- Simple data transformations

### Service Structure
```typescript
// server/src/modules/[name]/[name].service.ts
export class DispatchService {
  constructor(private repository: DispatchRepository) {}

  async processWorkflow(id: string, action: WorkflowAction): Promise<DispatchRecord> {
    // Complex business logic here
  }
}
```

---

## Helper Extraction Pattern

### File Organization
For each module, extract helpers into dedicated files:

```
server/src/modules/[name]/
├── [name].controller.ts    # HTTP handling only
├── [name].service.ts       # Complex business logic (optional)
├── [name].repository.ts    # Database operations
├── [name].validation.ts    # Input validation
├── [name].helpers.ts       # Utility functions
├── [name].types.ts         # TypeScript types
└── index.ts                # Module exports
```

### When to Extract
Extract to helper when:
- Function is > 20 lines
- Function is reused in multiple places
- Function contains pure business logic
- Function can be unit tested in isolation

---

## Type Safety Guidelines

### Avoid `any`
- Never use `: any` for function parameters
- Never use `: any` for return types
- Use `unknown` when type is truly unknown, then narrow with type guards

### Prefer Specific Types
```typescript
// Bad
function process(data: any): any { ... }

// Good
function process(data: DispatchInput): DispatchRecord { ... }

// For unknown external data
function parseExternal(data: unknown): DispatchRecord {
  if (!isValidDispatchRecord(data)) {
    throw new AppError('Invalid data format');
  }
  return data;
}
```

### Type Guards
```typescript
function isDispatchRecord(obj: unknown): obj is DispatchRecord {
  return typeof obj === 'object' && obj !== null && 'id' in obj;
}
```

---

## Error Handling

### Use AppError Class
```typescript
import { AppError } from '@/shared/errors';

// Validation errors (400)
throw new AppError('Invalid vehicle ID', 400);

// Not found errors (404)
throw new AppError('Dispatch record not found', 404);

// Business logic errors (422)
throw new AppError('Cannot transition from entered to departed', 422);
```

### Error Messages
- Be specific about what failed
- Include relevant IDs or values
- Don't expose internal implementation details

---

## Naming Conventions

### Files
- Controllers: `[entity].controller.ts`
- Services: `[entity].service.ts`
- Repositories: `[entity].repository.ts`
- Types: `[entity].types.ts`
- Validation: `[entity].validation.ts`

### Functions
- Controllers: `getAll`, `getById`, `create`, `update`, `delete`
- Services: `processWorkflow`, `calculateFees`, `validateTransition`
- Helpers: `formatDate`, `parseInput`, `buildQuery`

### Variables
- Use camelCase for variables and functions
- Use PascalCase for classes and types
- Use UPPER_SNAKE_CASE for constants

---

## Import Organization

```typescript
// 1. Node built-ins
import { Router } from 'express';

// 2. External packages
import { z } from 'zod';

// 3. Internal shared modules
import { AppError, ApiResponse } from '@/shared';

// 4. Internal module imports
import { dispatchService } from './dispatch.service';
import type { DispatchInput } from './dispatch.types';
```

---

## Comments

### When to Comment
- Complex business logic that isn't self-explanatory
- Workarounds or non-obvious solutions
- API documentation (JSDoc for public methods)

### When NOT to Comment
- Self-explanatory code
- Obvious operations
- Every function (only document complex or public APIs)

---

## Testing Standards

### Unit Tests
- Test services and helpers in isolation
- Mock external dependencies
- Cover edge cases and error scenarios

### Integration Tests
- Test API endpoints end-to-end
- Use test database
- Verify response structure

### Coverage Targets
- Services: 80%+ coverage
- Helpers: 90%+ coverage
- Controllers: Integration tests preferred over unit tests

---

## Performance Guidelines

### Database Operations
- Avoid N+1 queries (use joins or batch fetches)
- Use indexes for frequently queried fields
- Limit result sets with pagination

### API Responses
- Return only necessary fields
- Use pagination for lists
- Consider caching for frequently accessed data

---

## Review Checklist

Before submitting code for review:
- [ ] Controller < 200 lines
- [ ] No `: any` types added
- [ ] Business logic extracted to services/helpers
- [ ] Error handling uses AppError
- [ ] No console.log in production code
- [ ] Tests added for new functionality
