# Module Structure

## Overview

The Bus Station Management System (Quanlybenxe) uses a modular architecture with clear separation of concerns. The system is split into a React frontend and an Express backend using Firebase Realtime Database.

## Backend Structure

```
server/src/
├── modules/
│   ├── dispatch/              # Dispatch operations module
│   │   ├── controllers/
│   │   │   └── dispatch.controller.ts
│   │   ├── __tests__/
│   │   │   └── dispatch-validation.test.ts
│   │   ├── dispatch-validation.ts
│   │   ├── dispatch-helpers.ts
│   │   ├── dispatch-repository.ts
│   │   ├── dispatch.routes.ts
│   │   └── index.ts
│   │
│   ├── fleet/                 # Vehicle & Driver management
│   │   ├── controllers/
│   │   │   ├── vehicle.controller.ts
│   │   │   └── driver.controller.ts
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── __tests__/
│   │   │   └── fleet-validation.test.ts
│   │   ├── fleet-validation.ts
│   │   ├── fleet.routes.ts
│   │   └── index.ts
│   │
│   ├── operator/              # Operator management
│   ├── route/                 # Route management
│   ├── shift/                 # Shift management
│   ├── user/                  # User authentication & management
│   └── vehicle-type/          # Vehicle type definitions
│
├── shared/
│   ├── database/              # Base repository pattern
│   │   └── base-repository.ts
│   ├── errors/                # Custom error classes
│   ├── mappers/               # Entity mappers (DB <-> API)
│   ├── response/              # API response helpers
│   ├── services/              # Base service class
│   └── validation/            # Common validation (status, etc.)
│
├── types/
│   ├── api-contracts.ts       # API request/response types
│   ├── database.ts            # Database schema types
│   └── index.ts               # All type exports
│
├── middleware/                # Express middleware
├── config/                    # App configuration
└── db/                        # Firebase initialization
```

## Module Pattern

Each module follows this layered pattern:

### 1. Controller Layer (Thin)
- HTTP request/response handling only
- Delegates to validation and helpers
- Never contains business logic
- Target: < 200 lines per controller

### 2. Validation Layer
- Zod schemas for input validation
- Type-safe parsing of request bodies
- Reusable validation functions

### 3. Helper Layer
- Business logic functions
- Data transformation
- Utility functions specific to the module

### 4. Repository Layer
- Database operations
- Extends BaseRepository for common CRUD
- Firebase-specific operations

### 5. Routes Layer
- Express route definitions
- Middleware application
- Path configuration

## Frontend Structure

```
client/src/
├── components/
│   ├── dispatch/              # Dispatch-related components
│   │   ├── icons/             # Extracted icon components
│   │   ├── VehicleEntryModal.tsx
│   │   ├── DispatchTable.tsx
│   │   └── ...
│   ├── fleet/                 # Vehicle & driver components
│   ├── ui/                    # Shared UI components
│   └── ...
│
├── services/                  # API client services
│   ├── dispatch.service.ts
│   ├── fleet.service.ts
│   └── ...
│
├── pages/                     # Route pages
│   ├── dispatch/
│   │   └── DieuDo.tsx        # Main dispatch page
│   └── ...
│
├── lib/
│   ├── cache.ts              # Client-side caching utility
│   └── ...
│
└── types/                    # TypeScript types
```

## Data Flow

```
Request Flow:
┌─────────────────────────────────────────────────────────────────┐
│  Client Request                                                 │
│       ↓                                                         │
│  Routes (dispatch.routes.ts)                                    │
│       ↓                                                         │
│  Middleware (auth, validation)                                  │
│       ↓                                                         │
│  Controller (dispatch.controller.ts)                            │
│       ↓                                                         │
│  Validation (dispatch-validation.ts) → Zod schema parsing       │
│       ↓                                                         │
│  Helper (dispatch-helpers.ts) → Business logic                  │
│       ↓                                                         │
│  Repository (dispatch-repository.ts) → Database operations      │
│       ↓                                                         │
│  Firebase Realtime Database                                     │
│       ↓                                                         │
│  Response Mapper → Client Response                              │
└─────────────────────────────────────────────────────────────────┘
```

## Adding a New Module

1. Create directory: `server/src/modules/[name]/`

2. Create required files:
   - `[name]-validation.ts` - Zod schemas
   - `[name]-helpers.ts` - Business logic
   - `[name]-repository.ts` - Database operations
   - `controllers/[name].controller.ts` - HTTP handling
   - `[name].routes.ts` - Route definitions
   - `index.ts` - Module exports

3. Add tests in `__tests__/` directory

4. Register routes in main app:
   ```typescript
   import { nameRoutes } from './modules/name/name.routes.js';
   app.use('/api/name', nameRoutes);
   ```

## Key Design Decisions

### Denormalized Dispatch Data
Dispatch records store denormalized copies of related entity data (vehicle plate, driver name, etc.) for:
- Faster queries without joins
- Historical accuracy (data as it was at dispatch time)
- Reduced database reads

### Status-Based Workflow
Dispatch operations follow a strict status flow:
```
entered → passengers_dropped → permit_issued → paid → departure_ordered → departed → exited
                            ↘ permit_rejected
```

### Repository Pattern
All database operations go through repositories extending `BaseRepository`:
- Consistent error handling
- Type-safe operations
- Centralized query optimization

### Validation-First
All API inputs are validated through Zod schemas before processing:
- Type inference from schemas
- Clear error messages
- Runtime type safety
